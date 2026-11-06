import { agentPresence, approvals, taskEvents } from "@vc/db";
import { getTasksQueue, taskRunJobId } from "@vc/queue";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  beginTaskRun,
  cancelTask,
  completeTaskRun,
  createTask,
  decideApproval,
  dispatchTask,
  failTaskRun,
  getTask,
  requestTaskApproval,
} from "../../src";
import { ctxFor, db, makeAgent, resetState } from "../helpers";

beforeEach(resetState);

async function setup() {
  const ctx = await ctxFor("owner");
  const { agent } = await makeAgent(ctx);
  return { ctx, agent };
}

describe("tasks", () => {
  it("creates a pending task and dispatches it to the queue with an idempotent job id", async () => {
    const { ctx, agent } = await setup();
    const { task } = await createTask(ctx, { title: "Pesquisa de concorrentes", type: "demo.lifecycle", assignedAgentId: agent.id });
    expect(task.status).toBe("pending");
    expect(task.isDemo).toBe(true);

    const { task: queued, enqueued } = await dispatchTask(ctx, task.id);
    expect(queued.status).toBe("queued");
    expect(queued.runCount).toBe(1);
    expect(enqueued).toBe(true);
    const job = await getTasksQueue().getJob(taskRunJobId(task.id, 1));
    expect(job?.data).toEqual({ taskId: task.id, runNumber: 1 });
  });

  it("is idempotent on idempotencyKey", async () => {
    const { ctx, agent } = await setup();
    const a = await createTask(ctx, { title: "Tarefa A", type: "demo.lifecycle", assignedAgentId: agent.id, idempotencyKey: "key-12345678" });
    const b = await createTask(ctx, { title: "Tarefa A", type: "demo.lifecycle", assignedAgentId: agent.id, idempotencyKey: "key-12345678" });
    expect(b.created).toBe(false);
    expect(b.task.id).toBe(a.task.id);
  });

  it("refuses to dispatch without an active agent", async () => {
    const { ctx } = await setup();
    const { task } = await createTask(ctx, { title: "Sem agente", type: "demo.lifecycle" });
    await expect(dispatchTask(ctx, task.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
    const paused = await makeAgent(ctx, { status: "paused" });
    await expect(
      createTask(ctx, { title: "Agente pausado", type: "demo.lifecycle", assignedAgentId: paused.agent.id, dispatch: true }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("cancels a queued task and removes its job", async () => {
    const { ctx, agent } = await setup();
    const { task } = await createTask(ctx, { title: "Cancelar", type: "demo.lifecycle", assignedAgentId: agent.id, dispatch: true });
    const cancelled = await cancelTask(ctx, task.id, "não é mais necessária");
    expect(cancelled.status).toBe("cancelled");
    expect(await getTasksQueue().getJob(taskRunJobId(task.id, 1))).toBeUndefined();
    await expect(cancelTask(ctx, task.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("operators can create tasks but viewers cannot", async () => {
    const { agent } = await setup();
    const op = await ctxFor("operator");
    await expect(createTask(op, { title: "Do operador", type: "demo.lifecycle", assignedAgentId: agent.id })).resolves.toBeTruthy();
    const viewer = await ctxFor("viewer");
    await expect(createTask(viewer, { title: "Do leitor", type: "demo.lifecycle" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("task runs (worker side)", () => {
  it("ignores stale or duplicate runs", async () => {
    const { ctx, agent } = await setup();
    const { task } = await createTask(ctx, { title: "Execução", type: "demo.lifecycle", assignedAgentId: agent.id, dispatch: true });
    expect(await beginTaskRun(db(), { taskId: task.id, runNumber: 99 })).toBeNull();
    const run = await beginTaskRun(db(), { taskId: task.id, runNumber: 1 });
    expect(run?.task.status).toBe("in_progress");
    const [presence] = await db().select().from(agentPresence).where(eq(agentPresence.agentId, agent.id));
    expect(presence!.state).toBe("working");
    expect(presence!.currentTaskId).toBe(task.id);

    expect(await completeTaskRun(db(), { taskId: task.id, runNumber: 1 }, { ok: true })).toBe("applied");
    // A duplicated job for the same run cannot restart a completed task.
    expect(await beginTaskRun(db(), { taskId: task.id, runNumber: 1 })).toBeNull();
    const [after] = await db().select().from(agentPresence).where(eq(agentPresence.agentId, agent.id));
    expect(after!.state).toBe("idle");
  });

  it("schedules retries and fails after the last attempt", async () => {
    const { ctx, agent } = await setup();
    const { task } = await createTask(ctx, { title: "Retry", type: "demo.lifecycle", assignedAgentId: agent.id, dispatch: true });
    const ref = { taskId: task.id, runNumber: 1 };
    await beginTaskRun(db(), ref);
    await failTaskRun(db(), ref, { code: "X", message: "boom" }, true);
    expect((await getTask(ctx, task.id)).status).toBe("queued");
    await beginTaskRun(db(), ref);
    await failTaskRun(db(), ref, { code: "X", message: "boom" }, false);
    const final = await getTask(ctx, task.id);
    expect(final.status).toBe("failed");
    expect(final.attempts).toBe(2);
    expect(final.events.map((e) => e.type)).toEqual(["created", "queued", "started", "retry_scheduled", "started", "failed"]);
  });

  it("discards results of a task cancelled mid-run", async () => {
    const { ctx, agent } = await setup();
    const { task } = await createTask(ctx, { title: "Cancel mid-run", type: "demo.lifecycle", assignedAgentId: agent.id, dispatch: true });
    const ref = { taskId: task.id, runNumber: 1 };
    await beginTaskRun(db(), ref);
    await cancelTask(ctx, task.id);
    expect(await completeTaskRun(db(), ref, { ok: true })).toBe("discarded");
    expect((await getTask(ctx, task.id)).status).toBe("cancelled");
  });
});

describe("approvals", () => {
  async function waitingTask() {
    const s = await setup();
    const { task } = await createTask(s.ctx, { title: "Precisa aprovação", type: "demo.lifecycle", assignedAgentId: s.agent.id, dispatch: true });
    const ref = { taskId: task.id, runNumber: 1 };
    await beginTaskRun(db(), ref);
    await requestTaskApproval(db(), ref, { kind: "task_output", title: "Aprovar" });
    // Idempotent: a second request for the same task never creates a second pending approval.
    const [approval] = await db().select().from(approvals).where(eq(approvals.taskId, task.id));
    return { ...s, task, approval: approval! };
  }

  it("approval re-queues the task in a new run", async () => {
    const { ctx, task, approval } = await waitingTask();
    expect((await getTask(ctx, task.id)).status).toBe("waiting_approval");
    const r = await decideApproval(ctx, approval.id, { decision: "approve", expectedVersion: approval.version, note: "ok" });
    expect(r.approval.status).toBe("approved");
    expect(r.task?.status).toBe("queued");
    expect(r.task?.runCount).toBe(2);
    expect(await getTasksQueue().getJob(taskRunJobId(task.id, 2))).toBeTruthy();
  });

  it("rejection fails the task", async () => {
    const { ctx, task, approval } = await waitingTask();
    await decideApproval(ctx, approval.id, { decision: "reject", expectedVersion: approval.version, note: "fora do tom" });
    const t = await getTask(ctx, task.id);
    expect(t.status).toBe("failed");
    expect(t.error?.code).toBe("APPROVAL_REJECTED");
  });

  it("only one of two concurrent decisions wins", async () => {
    const { ctx, approval } = await waitingTask();
    const other = await ctxFor("admin");
    const results = await Promise.allSettled([
      decideApproval(ctx, approval.id, { decision: "approve", expectedVersion: approval.version }),
      decideApproval(other, approval.id, { decision: "reject", expectedVersion: approval.version }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "CONFLICT" });
  });

  it("rejects stale versions and unauthorized roles", async () => {
    const { approval } = await waitingTask();
    const op = await ctxFor("operator");
    await expect(decideApproval(op, approval.id, { decision: "approve", expectedVersion: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await ctxFor("admin");
    await expect(decideApproval(admin, approval.id, { decision: "approve", expectedVersion: 5 })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("cancelling a task cancels its pending approval", async () => {
    const { ctx, task, approval } = await waitingTask();
    await cancelTask(ctx, task.id);
    const [a] = await db().select().from(approvals).where(eq(approvals.id, approval.id));
    expect(a!.status).toBe("cancelled");
    const events = await db().select().from(taskEvents).where(eq(taskEvents.taskId, task.id)).orderBy(asc(taskEvents.createdAt));
    expect(events.at(-1)?.type).toBe("cancelled");
  });
});
