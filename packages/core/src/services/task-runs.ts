/**
 * Task execution lifecycle used by the worker process. All functions are idempotent with respect
 * to (taskId, runNumber): a duplicated or stale job never moves a task that belongs to another run.
 */
import { type Agent, type AgentVersion, type Approval, agents, agentVersions, approvals, type Database, type Task, tasks } from "@vc/db";
import { and, eq, lt } from "drizzle-orm";
import { writeAudit } from "../audit";
import { WORKER_ACTOR } from "../auth/permissions";
import type { TaskError } from "@vc/db";
import { applyTransition, lockTask, recordTaskEvent } from "./tasks";

export type RunRef = { taskId: string; runNumber: number };

export type RunContext = {
  task: Task;
  agent: Agent | null;
  agentVersion: AgentVersion | null;
  /** Approvals already decided for this task (most recent first). */
  approvals: Approval[];
  resumed: boolean;
};

/**
 * queued → in_progress. Returns null when this job must not run (task cancelled, already finished,
 * or the job belongs to an older run). A stalled job of the same run may resume an in_progress task.
 */
export async function beginTaskRun(db: Database, ref: RunRef): Promise<RunContext | null> {
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, ref.taskId).catch(() => null);
    if (!task || task.runCount !== ref.runNumber) return null;

    let current: Task;
    let resumed = false;
    if (task.status === "queued") {
      current = await applyTransition(
        tx,
        WORKER_ACTOR,
        task,
        "in_progress",
        { type: "started", message: `Execução iniciada (tentativa ${task.attempts + 1})`, data: { runNumber: ref.runNumber } },
        { attempts: task.attempts + 1, startedAt: task.startedAt ?? new Date() },
      );
    } else if (task.status === "in_progress") {
      // Job was stalled (worker crash) and BullMQ handed it to us again.
      resumed = true;
      const [updated] = await tx
        .update(tasks)
        .set({ attempts: task.attempts + 1 })
        .where(eq(tasks.id, task.id))
        .returning();
      current = updated!;
      await recordTaskEvent(tx, WORKER_ACTOR, task.id, {
        type: "started",
        message: "Execução retomada após interrupção do worker",
        data: { runNumber: ref.runNumber, resumed: true },
      });
    } else {
      return null;
    }

    const agent = current.assignedAgentId
      ? ((await tx.select().from(agents).where(eq(agents.id, current.assignedAgentId)))[0] ?? null)
      : null;
    const agentVersion = current.agentVersionId
      ? ((await tx.select().from(agentVersions).where(eq(agentVersions.id, current.agentVersionId)))[0] ?? null)
      : null;
    const decided = await tx.query.approvals.findMany({
      where: (a, { and, eq, ne }) => and(eq(a.taskId, current.id), ne(a.status, "pending")),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    return { task: current, agent, agentVersion, approvals: decided, resumed };
  });
}

export async function getTaskStatus(db: Database, taskId: string) {
  const [row] = await db.select({ status: tasks.status, runCount: tasks.runCount }).from(tasks).where(eq(tasks.id, taskId));
  return row ?? null;
}

/** True when the run must stop (task cancelled or superseded by a newer run). */
export async function isRunAborted(db: Database, ref: RunRef) {
  const row = await getTaskStatus(db, ref.taskId);
  return !row || row.status !== "in_progress" || row.runCount !== ref.runNumber;
}

export async function recordRunProgress(db: Database, ref: RunRef, message: string, data: Record<string, unknown> = {}) {
  await db.transaction(async (tx) => {
    const task = await lockTask(tx, ref.taskId);
    if (task.status !== "in_progress" || task.runCount !== ref.runNumber) return;
    await recordTaskEvent(tx, WORKER_ACTOR, ref.taskId, { type: "progress", message, data });
  });
}

type FinishOutcome = "applied" | "discarded";

async function discard(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], task: Task, ref: RunRef, reason: string) {
  await recordTaskEvent(tx, WORKER_ACTOR, task.id, {
    type: "result_discarded",
    message: reason,
    data: { runNumber: ref.runNumber, statusAtFinish: task.status },
  });
}

export async function completeTaskRun(db: Database, ref: RunRef, result: Record<string, unknown>): Promise<FinishOutcome> {
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, ref.taskId);
    if (task.status !== "in_progress" || task.runCount !== ref.runNumber) {
      await discard(tx, task, ref, "Resultado descartado: a tarefa mudou de estado durante a execução");
      return "discarded";
    }
    await applyTransition(tx, WORKER_ACTOR, task, "completed", { type: "completed", message: "Tarefa concluída" }, {
      result,
      error: null,
      finishedAt: new Date(),
    });
    await writeAudit(tx, WORKER_ACTOR, { action: "task.complete", entityType: "task", entityId: task.id, changes: { runNumber: ref.runNumber } });
    return "applied";
  });
}

export type ApprovalRequest = {
  kind: string;
  title: string;
  summary?: string;
  payload?: Record<string, unknown>;
};

/** in_progress → waiting_approval and creates the approval request (one pending per task). */
export async function requestTaskApproval(
  db: Database,
  ref: RunRef,
  request: ApprovalRequest,
  partialResult?: Record<string, unknown>,
): Promise<FinishOutcome> {
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, ref.taskId);
    if (task.status !== "in_progress" || task.runCount !== ref.runNumber) {
      await discard(tx, task, ref, "Solicitação de aprovação descartada: a tarefa mudou de estado");
      return "discarded";
    }
    const [existing] = await tx
      .select({ id: approvals.id })
      .from(approvals)
      .where(and(eq(approvals.taskId, task.id), eq(approvals.status, "pending")));
    const approvalId =
      existing?.id ??
      (
        await tx
          .insert(approvals)
          .values({
            taskId: task.id,
            agentId: task.assignedAgentId,
            kind: request.kind,
            title: request.title,
            summary: request.summary ?? "",
            payload: request.payload ?? {},
            requestedByType: "worker",
          })
          .returning({ id: approvals.id })
      )[0]!.id;

    await applyTransition(
      tx,
      WORKER_ACTOR,
      task,
      "waiting_approval",
      { type: "approval_requested", message: request.title, data: { approvalId } },
      partialResult ? { result: partialResult } : {},
    );
    await writeAudit(tx, WORKER_ACTOR, {
      action: "approval.request",
      entityType: "approval",
      entityId: approvalId,
      changes: { taskId: task.id, kind: request.kind, title: request.title },
    });
    return "applied";
  });
}

/**
 * Records a failed attempt. When `willRetry` the task goes back to "queued" while BullMQ
 * applies backoff; otherwise it becomes "failed".
 */
export async function failTaskRun(
  db: Database,
  ref: RunRef,
  error: TaskError,
  willRetry: boolean,
): Promise<FinishOutcome> {
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, ref.taskId);
    if (task.status !== "in_progress" || task.runCount !== ref.runNumber) {
      await discard(tx, task, ref, `Falha descartada: ${error.message}`);
      return "discarded";
    }
    if (willRetry) {
      await applyTransition(
        tx,
        WORKER_ACTOR,
        task,
        "queued",
        { type: "retry_scheduled", message: error.message, data: { code: error.code, attempt: error.attempt } },
        { error },
      );
    } else {
      await applyTransition(tx, WORKER_ACTOR, task, "failed", { type: "failed", message: error.message, data: { code: error.code } }, {
        error,
        finishedAt: new Date(),
      });
      await writeAudit(tx, WORKER_ACTOR, { action: "task.fail", entityType: "task", entityId: task.id, changes: { error } });
    }
    return "applied";
  });
}

/** in_progress tasks without recent activity: candidates for the "worker lost" check. */
export async function findStaleInProgressTasks(db: Database, olderThanMs: number, limit = 50) {
  return db
    .select({ id: tasks.id, runCount: tasks.runCount })
    .from(tasks)
    .where(and(eq(tasks.status, "in_progress"), lt(tasks.updatedAt, new Date(Date.now() - olderThanMs))))
    .limit(limit);
}
