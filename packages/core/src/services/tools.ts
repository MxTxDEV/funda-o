/**
 * Tool Registry (backend): autonomy configuration, authorization view, execution log and sources.
 */
import { agents, agentVersions, type DbExecutor, researchSources, tasks, toolExecutions, type ToolExecutionStatus } from "@vc/db";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { writeAudit } from "../audit";
import { assertCan } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { AppError, notFound } from "../errors";
import {
  AUTONOMY_LEVELS,
  type AutonomyLevel,
  expandToolGrants,
  getToolDefinition,
  TOOL_CATALOG,
  type ToolAvailabilityReason,
  toolAvailability,
} from "../tools";
import { idSchema } from "../validation";
import { COMPANY_TIME_ZONE } from "./agent-runs";

const dayStart = sql`(date_trunc('day', now() AT TIME ZONE ${COMPANY_TIME_ZONE}) AT TIME ZONE ${COMPANY_TIME_ZONE})`;

export function envConfigured(name: string) {
  return !!process.env[name]?.trim();
}

/** Tools an employee may use right now, with the reason for every granted tool. */
export function toolAccessFor(allowedTools: readonly string[], autonomyLevel: number) {
  const grants = expandToolGrants(allowedTools);
  return grants.map((id) => {
    const def = getToolDefinition(id)!;
    return { id, label: def.label, riskLevel: def.riskLevel, reason: toolAvailability(id, { grants, autonomyLevel, configuredEnv: envConfigured }) };
  });
}

/**
 * Only a human user with agents:write sets autonomy. Agents never hold agents:write, so no agent can
 * raise its own (or anyone's) permissions.
 */
export async function setAgentAutonomy(ctx: ServiceContext, id: string, level: number) {
  assertCan(ctx.actor, "agents:write");
  if (ctx.actor.type !== "user") throw new AppError("FORBIDDEN", "Somente o proprietário ou um administrador altera níveis de autonomia.");
  const agentId = idSchema.parse(id);
  if (!(AUTONOMY_LEVELS as readonly number[]).includes(level)) throw new AppError("VALIDATION", "Nível de autonomia inválido.");
  return ctx.db.transaction(async (tx) => {
    const [agent] = await tx.select().from(agents).where(eq(agents.id, agentId)).for("update");
    if (!agent) throw notFound("Funcionário");
    if (agent.autonomyLevel === level) return agent;
    const [updated] = await tx.update(agents).set({ autonomyLevel: level }).where(eq(agents.id, agentId)).returning();
    await writeAudit(
      tx,
      ctx.actor,
      { action: "agent.autonomy_change", entityType: "agent", entityId: agentId, changes: { autonomyLevel: { from: agent.autonomyLevel, to: level } } },
      ctx.meta,
    );
    return updated!;
  });
}

export type RecordToolExecutionInput = {
  toolId: string;
  agentRunId: string | null;
  taskId: string | null;
  agentId: string | null;
  status: ToolExecutionStatus;
  input: Record<string, unknown>;
  summary?: string;
  output?: Record<string, unknown> | null;
  error?: string | null;
  denialReason?: string | null;
  durationMs?: number | null;
  startedAt?: Date;
};

const MAX_JSON = 20_000;
function truncateJson(value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  const s = JSON.stringify(value);
  return s.length <= MAX_JSON ? value : { truncated: true, preview: s.slice(0, MAX_JSON) };
}

export async function recordToolExecution(db: DbExecutor, input: RecordToolExecutionInput) {
  const [row] = await db
    .insert(toolExecutions)
    .values({
      ...input,
      input: truncateJson(input.input) ?? {},
      output: truncateJson(input.output ?? null),
      summary: (input.summary ?? "").slice(0, 500),
      error: input.error?.slice(0, 1000) ?? null,
    })
    .returning();
  return row!;
}

/** Calls made today by an employee to a tool (denied calls excluded). */
export async function countToolCallsToday(db: DbExecutor, agentId: string, toolId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(toolExecutions)
    .where(and(eq(toolExecutions.agentId, agentId), eq(toolExecutions.toolId, toolId), ne(toolExecutions.status, "denied"), gte(toolExecutions.startedAt, dayStart)));
  return row?.n ?? 0;
}

export async function saveResearchSources(
  db: DbExecutor,
  rows: { taskId: string | null; toolExecutionId: string | null; agentId: string | null; kind: "web_page" | "search_result"; url: string; title: string; excerpt: string; contentHash?: string | null }[],
) {
  if (rows.length === 0) return [];
  return db
    .insert(researchSources)
    .values(rows.map((r) => ({ ...r, title: r.title.slice(0, 300), excerpt: r.excerpt.slice(0, 2000), url: r.url.slice(0, 2000) })))
    .returning();
}

const executionColumns = {
  id: toolExecutions.id,
  toolId: toolExecutions.toolId,
  status: toolExecutions.status,
  summary: toolExecutions.summary,
  error: toolExecutions.error,
  denialReason: toolExecutions.denialReason,
  durationMs: toolExecutions.durationMs,
  startedAt: toolExecutions.startedAt,
  input: toolExecutions.input,
  taskId: toolExecutions.taskId,
  taskTitle: tasks.title,
  agentId: toolExecutions.agentId,
  agentName: agents.name,
};

export async function listToolExecutions(ctx: ServiceContext, filter: { taskId?: string; agentId?: string; toolId?: string; limit?: number } = {}) {
  assertCan(ctx.actor, "tasks:read");
  return ctx.db
    .select(executionColumns)
    .from(toolExecutions)
    .leftJoin(tasks, eq(tasks.id, toolExecutions.taskId))
    .leftJoin(agents, eq(agents.id, toolExecutions.agentId))
    .where(
      and(
        filter.taskId ? eq(toolExecutions.taskId, filter.taskId) : undefined,
        filter.agentId ? eq(toolExecutions.agentId, filter.agentId) : undefined,
        filter.toolId ? eq(toolExecutions.toolId, filter.toolId) : undefined,
      ),
    )
    .orderBy(desc(toolExecutions.startedAt))
    .limit(Math.min(filter.limit ?? 30, 200));
}
export type ToolExecutionRow = Awaited<ReturnType<typeof listToolExecutions>>[number];

export async function listTaskSources(ctx: ServiceContext, taskId: string) {
  assertCan(ctx.actor, "tasks:read");
  return ctx.db.select().from(researchSources).where(eq(researchSources.taskId, idSchema.parse(taskId))).orderBy(researchSources.retrievedAt);
}

/** Registry overview: every tool with its configuration status, usage and which employees can use it. */
export async function getToolRegistryOverview(ctx: ServiceContext) {
  assertCan(ctx.actor, "agents:read");
  const [usage, agentRows] = await Promise.all([
    ctx.db
      .select({
        toolId: toolExecutions.toolId,
        total: sql<number>`count(*)::int`,
        today: sql<number>`count(*) FILTER (WHERE ${toolExecutions.startedAt} >= ${dayStart})::int`,
        failed: sql<number>`count(*) FILTER (WHERE ${toolExecutions.status} = 'failed')::int`,
        denied: sql<number>`count(*) FILTER (WHERE ${toolExecutions.status} = 'denied')::int`,
      })
      .from(toolExecutions)
      .groupBy(toolExecutions.toolId),
    ctx.db
      .select({ id: agents.id, name: agents.name, autonomyLevel: agents.autonomyLevel, allowedTools: agentVersions.allowedTools })
      .from(agents)
      .leftJoin(agentVersions, eq(agentVersions.id, agents.currentVersionId))
      .where(eq(agents.status, "active"))
      .orderBy(agents.name),
  ]);
  return TOOL_CATALOG.map((t) => {
    const u = usage.find((x) => x.toolId === t.id);
    const employees = agentRows
      .map((a) => {
        const grants = expandToolGrants(a.allowedTools ?? []);
        if (!grants.includes(t.id)) return null;
        const reason: ToolAvailabilityReason = toolAvailability(t.id, { grants, autonomyLevel: a.autonomyLevel, configuredEnv: envConfigured });
        return { id: a.id, name: a.name, autonomyLevel: a.autonomyLevel as AutonomyLevel, reason };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const requiresEnv: readonly string[] = "requiresEnv" in t ? t.requiresEnv : [];
    return {
      ...t,
      requiresEnv,
      missingEnv: requiresEnv.filter((e) => !envConfigured(e)),
      usage: { total: u?.total ?? 0, today: u?.today ?? 0, failed: u?.failed ?? 0, denied: u?.denied ?? 0 },
      employees,
    };
  });
}

/** Most used tools (Command Center). */
export async function topTools(db: DbExecutor, limit = 5) {
  return db
    .select({ toolId: toolExecutions.toolId, n: sql<number>`count(*)::int` })
    .from(toolExecutions)
    .where(eq(toolExecutions.status, "succeeded"))
    .groupBy(toolExecutions.toolId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}
