import { createAgent, createDepartment, createTask, decideApproval, dispatchTask, getTask, hashPassword } from "@vc/core";
import type { ServiceContext, UserActor } from "@vc/core";
import { approvals, getDb, users } from "@vc/db";
import { createRedis, getTasksQueue, QUEUE_PREFIX, TASKS_QUEUE } from "@vc/queue";
import { UnrecoverableError, Worker } from "bullmq";
import { eq, sql } from "drizzle-orm";
import { setTimeout as sleep } from "node:timers/promises";
import { beforeEach, describe, expect, it } from "vitest";
import { processTaskJob } from "../src/run-task";

const db = () => getDb();

beforeEach(async () => {
  await db().execute(
    sql`TRUNCATE users, departments, agents, agent_versions, tasks, task_events, approvals, conversations, messages, audit_logs, agent_presence CASCADE`,
  );
  await getTasksQueue().obliterate({ force: true });
});

async function setup() {
  const [u] = await db()
    .insert(users)
    .values({ email: `owner-${Math.random()}@t.dev`, name: "Owner", role: "owner", passwordHash: await hashPassword("x") })
    .returning();
  const ctx: ServiceContext & { actor: UserActor } = {
    db: db(),
    actor: { type: "user", userId: u!.id, email: u!.email, role: "owner" },
  };
  const dept = await createDepartment(ctx, { name: `Dept ${Math.random()}` });
  const agent = await createAgent(ctx, {
    departmentId: dept.id,
    name: "Worker Agent",
    title: "Analista",
    specialty: "Testes",
    instructions: "Instruções de teste.",
  });
  return { ctx, agent };
}

const job = (taskId: string, runNumber: number, attemptsMade = 0, attempts = 3) => ({
  id: `j-${runNumber}-${attemptsMade}`,
  data: { taskId, runNumber },
  attemptsMade,
  opts: { attempts },
});

describe("processTaskJob", () => {
  it("runs the demo lifecycle through approval to completion", async () => {
    const { ctx, agent } = await setup();
    const { task } = await createTask(ctx, {
      title: "Demo com aprovação",
      type: "demo.lifecycle",
      assignedAgentId: agent.id,
      input: { steps: 2, requireApproval: true },
      dispatch: true,
    });
    expect(await processTaskJob(db(), job(task.id, 1))).toEqual({ status: "waiting_approval" });
    const [approval] = await db().select().from(approvals).where(eq(approvals.taskId, task.id));
    await decideApproval(ctx, approval!.id, { decision: "approve", expectedVersion: approval!.version });

    expect(await processTaskJob(db(), job(task.id, 2))).toEqual({ status: "completed" });
    const done = await getTask(ctx, task.id);
    expect(done.status).toBe("completed");
    expect(done.result).toMatchObject({ demo: true, approvalId: approval!.id });
    expect(done.events.filter((e) => e.type === "progress").length).toBeGreaterThanOrEqual(3);

    // Re-delivering an old job is a no-op.
    expect(await processTaskJob(db(), job(task.id, 1))).toEqual({ status: "skipped" });
  });

  it("retries a failing attempt and then succeeds", async () => {
    const { ctx, agent } = await setup();
    const { task } = await createTask(ctx, {
      title: "Falha uma vez",
      type: "demo.lifecycle",
      assignedAgentId: agent.id,
      input: { steps: 1, failTimes: 1 },
      dispatch: true,
    });
    await expect(processTaskJob(db(), job(task.id, 1, 0))).rejects.toThrow(/Falha simulada/);
    expect((await getTask(ctx, task.id)).status).toBe("queued");
    expect(await processTaskJob(db(), job(task.id, 1, 1))).toEqual({ status: "completed" });
    expect((await getTask(ctx, task.id)).attempts).toBe(2);
  });

  it("fails permanently when no attempts remain, and allows a manual retry", async () => {
    const { ctx, agent } = await setup();
    const { task } = await createTask(ctx, {
      title: "Sempre falha",
      type: "demo.lifecycle",
      assignedAgentId: agent.id,
      input: { steps: 1, failTimes: 1 },
      maxAttempts: 1,
      dispatch: true,
    });
    await expect(processTaskJob(db(), job(task.id, 1, 0, 1))).rejects.toThrow();
    expect((await getTask(ctx, task.id)).status).toBe("failed");
    const { task: retried } = await dispatchTask(ctx, task.id);
    expect(retried.runCount).toBe(2);
    expect(await processTaskJob(db(), job(task.id, 2, 0, 1))).toEqual({ status: "completed" });
  });

  it("fails immediately for task types without a processor", async () => {
    const { ctx, agent } = await setup();
    const { task } = await createTask(ctx, { title: "Sem processador", type: "demo.lifecycle", assignedAgentId: agent.id, dispatch: true });
    await expect(processTaskJob(db(), job(task.id, 1), () => undefined)).rejects.toBeInstanceOf(UnrecoverableError);
    const t = await getTask(ctx, task.id);
    expect(t.status).toBe("failed");
    expect(t.error?.code).toBe("PERMANENT_ERROR");
  });

  it("rejects invalid payloads", async () => {
    await expect(processTaskJob(db(), { data: { taskId: "nope" }, attemptsMade: 0, opts: {} })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });
});

describe("BullMQ integration", () => {
  it("a real worker processes a dispatched task with retry backoff", async () => {
    const { ctx, agent } = await setup();
    const worker = new Worker(TASKS_QUEUE, (j) => processTaskJob(db(), j), {
      connection: createRedis("worker"),
      prefix: QUEUE_PREFIX,
    });
    try {
      const { task } = await createTask(ctx, {
        title: "Via BullMQ",
        type: "demo.lifecycle",
        assignedAgentId: agent.id,
        input: { steps: 1, failTimes: 1 },
        dispatch: true,
      });
      let status = "";
      for (let i = 0; i < 100 && status !== "completed"; i++) {
        await sleep(100);
        status = (await getTask(ctx, task.id)).status;
      }
      expect(status).toBe("completed");
      const t = await getTask(ctx, task.id);
      expect(t.events.map((e) => e.type)).toContain("retry_scheduled");
    } finally {
      await worker.close();
    }
  });
});
