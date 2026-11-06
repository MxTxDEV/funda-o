/**
 * Execution records of the Agent Runtime (observability: runs, tokens, cost, duration, errors).
 */
import { type AgentRunError, agentRuns, agents, type DbExecutor, departments, tasks } from "@vc/db";
import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { assertCan } from "../auth/permissions";
import type { ServiceContext } from "../context";

/** Start of the current day in the company's time zone (budgets reset at local midnight). */
export const COMPANY_TIME_ZONE = "America/Sao_Paulo";
const dayStart = sql`(date_trunc('day', now() AT TIME ZONE ${COMPANY_TIME_ZONE}) AT TIME ZONE ${COMPANY_TIME_ZONE})`;

export type StartAgentRunInput = {
  taskId: string;
  runNumber: number;
  attempt: number;
  agentId: string | null;
  agentVersionId: string | null;
  provider: string;
  model: string;
  promptHash: string;
};

/**
 * Registers the start of a model execution. Idempotent on (task, run, attempt): a duplicated job
 * gets the existing row back with `created: false` and must not call the model again.
 * Rows of previous attempts still marked "running" were interrupted (worker crash) and are closed.
 */
export async function startAgentRun(db: DbExecutor, input: StartAgentRunInput) {
  await db
    .update(agentRuns)
    .set({ status: "failed", finishedAt: new Date(), error: { kind: "interrupted", message: "Execução interrompida (worker reiniciado)" } })
    .where(and(eq(agentRuns.taskId, input.taskId), eq(agentRuns.status, "running"), lt(agentRuns.attempt, input.attempt)));
  const [created] = await db.insert(agentRuns).values(input).onConflictDoNothing().returning();
  if (created) return { run: created, created: true as const };
  const [existing] = await db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.taskId, input.taskId), eq(agentRuns.runNumber, input.runNumber), eq(agentRuns.attempt, input.attempt)));
  return { run: existing!, created: false as const };
}

export type FinishAgentRunInput = {
  status: "succeeded" | "failed" | "aborted";
  responseModel?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
  finishReason?: string | null;
  providerRequestId?: string | null;
  toolsUsed?: string[];
  error?: AgentRunError | null;
};

export async function finishAgentRun(db: DbExecutor, runId: string, input: FinishAgentRunInput) {
  const finishedAt = new Date();
  const [row] = await db
    .update(agentRuns)
    .set({
      ...input,
      finishedAt,
      durationMs: sql`GREATEST(0, (EXTRACT(EPOCH FROM (${finishedAt.toISOString()}::timestamptz - ${agentRuns.startedAt})) * 1000)::int)`,
    })
    .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, "running")))
    .returning();
  return row ?? null;
}

export type UsageTotals = { runs: number; inputTokens: number; outputTokens: number; tokens: number; costUsd: number; unpricedRuns: number; failed: number };

/** Usage since the start of the company day, optionally for a single employee. */
export async function usageToday(db: DbExecutor, filter: { agentId?: string } = {}): Promise<UsageTotals> {
  const where: SQL | undefined = and(gte(agentRuns.startedAt, dayStart), filter.agentId ? eq(agentRuns.agentId, filter.agentId) : undefined);
  const [row] = await db
    .select({
      runs: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${agentRuns.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${agentRuns.outputTokens}), 0)::int`,
      costUsd: sql<number>`coalesce(sum(${agentRuns.costUsd}), 0)::float8`,
      unpricedRuns: sql<number>`count(*) FILTER (WHERE ${agentRuns.costUsd} IS NULL AND ${agentRuns.inputTokens} IS NOT NULL)::int`,
      failed: sql<number>`count(*) FILTER (WHERE ${agentRuns.status} = 'failed')::int`,
    })
    .from(agentRuns)
    .where(where);
  const r = row ?? { runs: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, unpricedRuns: 0, failed: 0 };
  return { ...r, tokens: r.inputTokens + r.outputTokens };
}

const runColumns = {
  id: agentRuns.id,
  taskId: agentRuns.taskId,
  taskTitle: tasks.title,
  runNumber: agentRuns.runNumber,
  attempt: agentRuns.attempt,
  agentId: agentRuns.agentId,
  agentName: agents.name,
  departmentName: departments.name,
  provider: agentRuns.provider,
  model: agentRuns.model,
  responseModel: agentRuns.responseModel,
  status: agentRuns.status,
  inputTokens: agentRuns.inputTokens,
  outputTokens: agentRuns.outputTokens,
  costUsd: agentRuns.costUsd,
  finishReason: agentRuns.finishReason,
  toolsUsed: agentRuns.toolsUsed,
  error: agentRuns.error,
  startedAt: agentRuns.startedAt,
  finishedAt: agentRuns.finishedAt,
  durationMs: agentRuns.durationMs,
};

export async function listAgentRuns(ctx: ServiceContext, filter: { agentId?: string; taskId?: string; limit?: number } = {}) {
  assertCan(ctx.actor, "tasks:read");
  return ctx.db
    .select(runColumns)
    .from(agentRuns)
    .innerJoin(tasks, eq(tasks.id, agentRuns.taskId))
    .leftJoin(agents, eq(agents.id, agentRuns.agentId))
    .leftJoin(departments, eq(departments.id, agents.departmentId))
    .where(and(filter.agentId ? eq(agentRuns.agentId, filter.agentId) : undefined, filter.taskId ? eq(agentRuns.taskId, filter.taskId) : undefined))
    .orderBy(desc(agentRuns.startedAt))
    .limit(Math.min(filter.limit ?? 20, 200));
}

export type AgentRunRow = Awaited<ReturnType<typeof listAgentRuns>>[number];

/** Command Center: today's AI activity and the latest executions. */
export async function getAiActivity(ctx: ServiceContext) {
  assertCan(ctx.actor, "dashboard:read");
  const [today, recent, running] = await Promise.all([
    usageToday(ctx.db),
    listAgentRuns(ctx, { limit: 8 }),
    ctx.db.select({ value: sql<number>`count(*)::int` }).from(agentRuns).where(eq(agentRuns.status, "running")),
  ]);
  return { today, recent, running: running[0]?.value ?? 0 };
}

/** Running model executions by employee (the 3D office shows who is really executing). */
export async function getRunningAgentRuns(db: DbExecutor) {
  return db
    .select({ agentId: agentRuns.agentId, model: agentRuns.model, provider: agentRuns.provider, startedAt: agentRuns.startedAt, taskId: agentRuns.taskId })
    .from(agentRuns)
    .where(eq(agentRuns.status, "running"));
}
