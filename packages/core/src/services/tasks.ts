import {
  agents,
  approvals,
  type DbExecutor,
  departments,
  type Task,
  type TaskStatus,
  taskEvents,
  tasks,
} from "@vc/db";
import { enqueueTaskRun, removeTaskRun } from "@vc/queue";
import { and, count, eq, inArray, lt, sql } from "drizzle-orm";
import { writeAudit } from "../audit";
import { type Actor, actorUserId, assertCan } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { conflict, invalidState, notFound } from "../errors";
import { logger } from "../logger";
import { canTransition, CANCELLABLE_STATUSES } from "../tasks/state-machine";
import { TASK_TYPES } from "../task-types";
import { idSchema, type TaskCreateInput, taskCreateSchema, type TaskListInput, taskListSchema } from "../validation";
import { isUniqueViolation } from "./departments";
import { syncAgentPresence } from "./presence";

export type TaskEventInput = { type: string; message?: string; data?: Record<string, unknown> };

/** Locks the task row for the rest of the transaction. */
export async function lockTask(tx: DbExecutor, taskId: string): Promise<Task> {
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).for("update");
  if (!task) throw notFound("Tarefa");
  return task;
}

export async function recordTaskEvent(
  tx: DbExecutor,
  actor: Actor,
  taskId: string,
  event: TaskEventInput & { fromStatus?: TaskStatus | null; toStatus?: TaskStatus | null },
) {
  await tx.insert(taskEvents).values({
    taskId,
    type: event.type,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus ?? null,
    actorType: actor.type,
    actorUserId: actorUserId(actor),
    message: event.message ?? "",
    data: event.data ?? {},
  });
}

/**
 * Applies a validated status transition to a task that is already locked by the caller.
 * Records the task event and resyncs the assigned agent's presence in the same transaction.
 */
export async function applyTransition(
  tx: DbExecutor,
  actor: Actor,
  task: Task,
  to: TaskStatus,
  event: TaskEventInput,
  patch: Partial<typeof tasks.$inferInsert> = {},
): Promise<Task> {
  if (!canTransition(task.status, to)) {
    throw invalidState(`Transição inválida: ${task.status} → ${to}.`, { from: task.status, to });
  }
  const [updated] = await tx
    .update(tasks)
    .set({ ...patch, status: to, version: sql`${tasks.version} + 1` })
    .where(and(eq(tasks.id, task.id), eq(tasks.version, task.version)))
    .returning();
  if (!updated) throw conflict("A tarefa foi modificada por outra operação. Recarregue e tente novamente.");
  await recordTaskEvent(tx, actor, task.id, { ...event, fromStatus: task.status, toStatus: to });
  const agentIds = new Set([task.assignedAgentId, updated.assignedAgentId].filter((v): v is string => !!v));
  for (const agentId of agentIds) await syncAgentPresence(tx, agentId);
  return updated;
}

/** Enqueues after commit. If Redis is unavailable the task stays "queued" and the worker reconciler re-enqueues it. */
export async function enqueueAfterCommit(task: Pick<Task, "id" | "runCount" | "priority" | "maxAttempts">) {
  try {
    await enqueueTaskRun(
      { taskId: task.id, runNumber: task.runCount },
      { priority: task.priority, attempts: task.maxAttempts },
    );
    return true;
  } catch (err) {
    logger.error("task.enqueue_failed", { taskId: task.id, runNumber: task.runCount, err });
    return false;
  }
}

async function loadDispatchableAgent(tx: DbExecutor, agentId: string) {
  const [row] = await tx
    .select({ agent: agents, departmentActive: departments.isActive })
    .from(agents)
    .innerJoin(departments, eq(departments.id, agents.departmentId))
    .where(eq(agents.id, agentId));
  if (!row) throw notFound("Funcionário");
  return row;
}

function assertAgentCanWork(row: Awaited<ReturnType<typeof loadDispatchableAgent>>) {
  if (row.agent.status !== "active") throw invalidState("O funcionário não está ativo.");
  if (!row.departmentActive) throw invalidState("O departamento do funcionário está inativo.");
}

/** Moves a locked task to "queued" with a new run number. Caller enqueues after commit. */
async function queueLockedTask(tx: DbExecutor, actor: Actor, task: Task, event: TaskEventInput): Promise<Task> {
  if (!task.assignedAgentId) throw invalidState("Atribua um funcionário antes de enviar a tarefa para a fila.");
  const row = await loadDispatchableAgent(tx, task.assignedAgentId);
  assertAgentCanWork(row);
  return applyTransition(tx, actor, task, "queued", event, {
    runCount: task.runCount + 1,
    queuedAt: new Date(),
    agentVersionId: row.agent.currentVersionId,
    departmentId: row.agent.departmentId,
    error: null,
    finishedAt: null,
  });
}

// ---------------------------------------------------------------- queries

export async function listTasks(ctx: ServiceContext, raw: TaskListInput = {}) {
  assertCan(ctx.actor, "tasks:read");
  const f = taskListSchema.parse(raw);
  const where = and(
    f.status ? eq(tasks.status, f.status) : undefined,
    f.agentId ? eq(tasks.assignedAgentId, f.agentId) : undefined,
    f.departmentId ? eq(tasks.departmentId, f.departmentId) : undefined,
  );
  const [items, [total]] = await Promise.all([
    ctx.db.query.tasks.findMany({
      where,
      with: {
        agent: { columns: { id: true, name: true, avatarSeed: true, avatarUrl: true } },
        department: { columns: { id: true, name: true, color: true } },
      },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: f.limit,
      offset: f.offset,
    }),
    ctx.db.select({ value: count() }).from(tasks).where(where),
  ]);
  return { items, total: total?.value ?? 0, limit: f.limit, offset: f.offset };
}

export async function getTask(ctx: ServiceContext, id: string) {
  assertCan(ctx.actor, "tasks:read");
  const task = await ctx.db.query.tasks.findFirst({
    where: eq(tasks.id, idSchema.parse(id)),
    with: {
      agent: { columns: { id: true, name: true, title: true, avatarSeed: true, avatarUrl: true, status: true } },
      department: { columns: { id: true, name: true, color: true } },
      events: { orderBy: (e, { asc }) => [asc(e.createdAt)] },
      approvals: { orderBy: (a, { desc }) => [desc(a.createdAt)] },
    },
  });
  if (!task) throw notFound("Tarefa");
  return task;
}

// ---------------------------------------------------------------- commands

export async function createTask(ctx: ServiceContext, raw: TaskCreateInput, opts: { isDemo?: boolean } = {}) {
  assertCan(ctx.actor, "tasks:write");
  const input = taskCreateSchema.parse(raw);
  const typeDef = TASK_TYPES[input.type];
  const parsedInput = typeDef.inputSchema.parse(input.input);

  if (input.idempotencyKey) {
    const [existing] = await ctx.db.select().from(tasks).where(eq(tasks.idempotencyKey, input.idempotencyKey));
    if (existing) return { task: existing, created: false, enqueued: false };
  }

  let result: { task: Task; queued: boolean };
  try {
    result = await ctx.db.transaction(async (tx) => {
      let departmentId: string | null = null;
      if (input.assignedAgentId) {
        const row = await loadDispatchableAgent(tx, input.assignedAgentId);
        if (row.agent.status === "archived") throw invalidState("Funcionário arquivado.");
        departmentId = row.agent.departmentId;
        if (input.dispatch) assertAgentCanWork(row);
      } else if (input.dispatch) {
        throw invalidState("Atribua um funcionário para enviar a tarefa para a fila.");
      }

      const [created] = await tx
        .insert(tasks)
        .values({
          title: input.title,
          description: input.description,
          type: input.type,
          priority: input.priority,
          input: parsedInput,
          assignedAgentId: input.assignedAgentId ?? null,
          departmentId,
          maxAttempts: input.maxAttempts,
          idempotencyKey: input.idempotencyKey ?? null,
          // Demo task types are always flagged as demonstrations.
          isDemo: opts.isDemo ?? typeDef.demo,
          createdById: actorUserId(ctx.actor),
        })
        .returning();
      if (!created) throw new Error("insert failed");
      await recordTaskEvent(tx, ctx.actor, created.id, {
        type: "created",
        toStatus: "pending",
        message: created.title,
        data: { type: created.type, assignedAgentId: created.assignedAgentId },
      });
      await writeAudit(
        tx,
        ctx.actor,
        {
          action: "task.create",
          entityType: "task",
          entityId: created.id,
          changes: { title: created.title, type: created.type, assignedAgentId: created.assignedAgentId },
        },
        ctx.meta,
      );

      if (!input.dispatch) return { task: created, queued: false };
      const queued = await queueLockedTask(tx, ctx.actor, created, { type: "queued", message: "Enviada para a fila" });
      await writeAudit(tx, ctx.actor, { action: "task.dispatch", entityType: "task", entityId: created.id }, ctx.meta);
      return { task: queued, queued: true };
    });
  } catch (err) {
    if (isUniqueViolation(err) && input.idempotencyKey) {
      const [existing] = await ctx.db.select().from(tasks).where(eq(tasks.idempotencyKey, input.idempotencyKey));
      if (existing) return { task: existing, created: false, enqueued: false };
    }
    throw err;
  }

  const enqueued = result.queued ? await enqueueAfterCommit(result.task) : false;
  return { task: result.task, created: true, enqueued };
}

export async function assignTask(ctx: ServiceContext, id: string, agentId: string) {
  assertCan(ctx.actor, "tasks:write");
  const taskId = idSchema.parse(id);
  const newAgentId = idSchema.parse(agentId);
  return ctx.db.transaction(async (tx) => {
    const task = await lockTask(tx, taskId);
    if (task.status !== "pending" && task.status !== "failed") {
      throw invalidState("Só é possível reatribuir tarefas pendentes ou com falha.");
    }
    const row = await loadDispatchableAgent(tx, newAgentId);
    if (row.agent.status === "archived") throw invalidState("Funcionário arquivado.");
    const [updated] = await tx
      .update(tasks)
      .set({ assignedAgentId: newAgentId, departmentId: row.agent.departmentId, version: sql`${tasks.version} + 1` })
      .where(and(eq(tasks.id, taskId), eq(tasks.version, task.version)))
      .returning();
    if (!updated) throw conflict("A tarefa foi modificada por outra operação.");
    await recordTaskEvent(tx, ctx.actor, taskId, {
      type: "assigned",
      message: row.agent.name,
      data: { from: task.assignedAgentId, to: newAgentId },
    });
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "task.assign",
        entityType: "task",
        entityId: taskId,
        changes: { assignedAgentId: { from: task.assignedAgentId, to: newAgentId } },
      },
      ctx.meta,
    );
    return updated;
  });
}

/** pending → queued (first dispatch) or failed → queued (manual retry). */
export async function dispatchTask(ctx: ServiceContext, id: string) {
  assertCan(ctx.actor, "tasks:write");
  const taskId = idSchema.parse(id);
  const task = await ctx.db.transaction(async (tx) => {
    const current = await lockTask(tx, taskId);
    if (current.status !== "pending" && current.status !== "failed") {
      throw invalidState("Apenas tarefas pendentes ou com falha podem ser enviadas para a fila.");
    }
    const isRetry = current.status === "failed";
    const queued = await queueLockedTask(tx, ctx.actor, current, {
      type: "queued",
      message: isRetry ? "Reenviada para a fila (nova tentativa manual)" : "Enviada para a fila",
    });
    await writeAudit(
      tx,
      ctx.actor,
      { action: isRetry ? "task.retry" : "task.dispatch", entityType: "task", entityId: taskId },
      ctx.meta,
    );
    return queued;
  });
  const enqueued = await enqueueAfterCommit(task);
  return { task, enqueued };
}

export async function cancelTask(ctx: ServiceContext, id: string, reason = "") {
  assertCan(ctx.actor, "tasks:write");
  const taskId = idSchema.parse(id);
  const { task, previous } = await ctx.db.transaction(async (tx) => {
    const current = await lockTask(tx, taskId);
    if (!CANCELLABLE_STATUSES.includes(current.status)) {
      throw invalidState("Esta tarefa não pode mais ser cancelada.");
    }
    // Pending approvals of a cancelled task are closed too.
    const closed = await tx
      .update(approvals)
      .set({ status: "cancelled", decidedAt: new Date(), decisionNote: "Tarefa cancelada", version: sql`${approvals.version} + 1` })
      .where(and(eq(approvals.taskId, taskId), eq(approvals.status, "pending")))
      .returning({ id: approvals.id });
    for (const a of closed) {
      await recordTaskEvent(tx, ctx.actor, taskId, { type: "approval_cancelled", data: { approvalId: a.id } });
    }
    const cancelled = await applyTransition(
      tx,
      ctx.actor,
      current,
      "cancelled",
      { type: "cancelled", message: reason || "Cancelada pelo usuário" },
      { finishedAt: new Date() },
    );
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "task.cancel",
        entityType: "task",
        entityId: taskId,
        changes: { status: { from: current.status, to: "cancelled" }, reason },
      },
      ctx.meta,
    );
    return { task: cancelled, previous: current };
  });
  if (previous.status === "queued" && previous.runCount > 0) {
    await removeTaskRun(taskId, previous.runCount).catch((err) =>
      logger.warn("task.remove_job_failed", { taskId, err }),
    );
  }
  return task;
}

/** Tasks left in "queued" longer than `olderThanMs` (e.g. enqueue failed). Used by the worker reconciler. */
export async function findStaleQueuedTasks(db: DbExecutor, olderThanMs: number, limit = 100) {
  return db
    .select({ id: tasks.id, runCount: tasks.runCount, priority: tasks.priority, maxAttempts: tasks.maxAttempts })
    .from(tasks)
    .where(and(eq(tasks.status, "queued"), lt(tasks.queuedAt, new Date(Date.now() - olderThanMs))))
    .orderBy(tasks.queuedAt)
    .limit(limit);
}

export async function countTasksByStatus(db: DbExecutor, statuses?: TaskStatus[]) {
  const rows = await db
    .select({ status: tasks.status, value: count() })
    .from(tasks)
    .where(statuses ? inArray(tasks.status, statuses) : undefined)
    .groupBy(tasks.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.value])) as Partial<Record<TaskStatus, number>>;
}
