import { type AgentHierarchyLevel, type AgentStatus, agents, agentVersions, type DbExecutor, departments, tasks } from "@vc/db";
import { and, desc, eq, max } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { diff, writeAudit } from "../audit";
import { assertCan } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { canManage, HIERARCHY_LABELS } from "../agent-authority";
import { AppError, invalidState, notFound } from "../errors";
import {
  type AgentCreateInput,
  agentCreateSchema,
  type AgentUpdateInput,
  agentUpdateSchema,
  type AgentVersionCreateInput,
  agentVersionCreateSchema,
  idSchema,
} from "../validation";
import { syncAgentPresence } from "./presence";

export async function listAgents(
  ctx: ServiceContext,
  filter: { departmentId?: string; status?: AgentStatus; includeArchived?: boolean } = {},
) {
  assertCan(ctx.actor, "agents:read");
  return ctx.db.query.agents.findMany({
    where: (a, { and, eq, ne }) =>
      and(
        filter.departmentId ? eq(a.departmentId, filter.departmentId) : undefined,
        filter.status ? eq(a.status, filter.status) : undefined,
        !filter.includeArchived && !filter.status ? ne(a.status, "archived") : undefined,
      ),
    with: {
      department: { columns: { id: true, name: true, color: true, isActive: true } },
      presence: true,
      currentVersion: { columns: { id: true, version: true, allowedTools: true, aiProvider: true, aiModel: true } },
      reportsTo: { columns: { id: true, name: true } },
    },
    orderBy: (a, { asc }) => [asc(a.name)],
  });
}

/**
 * Validates the reporting line: the manager exists, is not archived, ranks above the employee
 * (COO > director > specialist) and no cycle is created.
 */
async function assertReportingLine(db: DbExecutor, agentId: string | null, level: AgentHierarchyLevel, managerId: string | null | undefined) {
  if (!managerId) return;
  if (managerId === agentId) throw invalidState("Um funcionário não pode reportar a si mesmo.");
  const [manager] = await db.select().from(agents).where(eq(agents.id, managerId));
  if (!manager) throw notFound("Gestor");
  if (manager.status === "archived") throw invalidState("O gestor está arquivado.");
  if (!canManage(manager.hierarchyLevel, level)) {
    throw invalidState(`${HIERARCHY_LABELS[manager.hierarchyLevel]} não pode ser gestor de ${HIERARCHY_LABELS[level].toLowerCase()}.`);
  }
  // Walk up the chain to prevent cycles.
  let cursor: string | null = manager.reportsToAgentId;
  for (let i = 0; cursor && i < 20; i++) {
    if (cursor === agentId) throw invalidState("A hierarquia não pode ter ciclos.");
    const [next] = await db.select({ up: agents.reportsToAgentId }).from(agents).where(eq(agents.id, cursor));
    cursor = next?.up ?? null;
  }
}

export async function getAgent(ctx: ServiceContext, id: string) {
  assertCan(ctx.actor, "agents:read");
  const agent = await ctx.db.query.agents.findFirst({
    where: eq(agents.id, idSchema.parse(id)),
    with: {
      department: true,
      presence: true,
      currentVersion: true,
      versions: { orderBy: (v, { desc }) => [desc(v.version)] },
      reportsTo: { columns: { id: true, name: true, title: true, hierarchyLevel: true } },
      directReports: { columns: { id: true, name: true, title: true, status: true }, orderBy: (a, { asc }) => [asc(a.name)] },
    },
  });
  if (!agent) throw notFound("Funcionário");
  const recentTasks = await ctx.db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      isDemo: tasks.isDemo,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(eq(tasks.assignedAgentId, agent.id))
    .orderBy(desc(tasks.updatedAt))
    .limit(20);
  return { ...agent, recentTasks };
}

async function assertDepartmentUsable(db: DbExecutor, departmentId: string) {
  const [dept] = await db.select().from(departments).where(eq(departments.id, departmentId));
  if (!dept) throw notFound("Departamento");
  if (!dept.isActive) throw new AppError("INVALID_STATE", "O departamento está inativo.");
  return dept;
}

export async function createAgent(ctx: ServiceContext, raw: AgentCreateInput, opts: { isDemo?: boolean; seedKey?: string } = {}) {
  assertCan(ctx.actor, "agents:write");
  const input = agentCreateSchema.parse(raw);
  const userId = ctx.actor.type === "user" ? ctx.actor.userId : null;

  return ctx.db.transaction(async (tx) => {
    await assertDepartmentUsable(tx, input.departmentId);
    const level = input.hierarchyLevel ?? "specialist";
    await assertReportingLine(tx, null, level, input.reportsToAgentId);
    const [agent] = await tx
      .insert(agents)
      .values({
        departmentId: input.departmentId,
        name: input.name,
        title: input.title,
        specialty: input.specialty,
        description: input.description,
        avatarUrl: input.avatarUrl ?? null,
        avatarSeed: randomBytes(6).toString("hex"),
        status: input.status,
        specialties: input.specialties ?? [],
        responsibilities: input.responsibilities ?? [],
        personality: input.personality ?? "",
        hierarchyLevel: level,
        reportsToAgentId: input.reportsToAgentId ?? null,
        appearance: input.appearance ?? {},
        seedKey: opts.seedKey ?? null,
        isDemo: opts.isDemo ?? false,
        createdById: userId,
      })
      .returning();
    if (!agent) throw new Error("insert failed");

    const [version] = await tx
      .insert(agentVersions)
      .values({
        agentId: agent.id,
        version: 1,
        instructions: input.instructions,
        allowedTools: input.allowedTools,
        aiProvider: input.aiProvider,
        aiModel: input.aiModel,
        changeNote: input.changeNote,
        createdById: userId,
      })
      .returning();
    const [withVersion] = await tx
      .update(agents)
      .set({ currentVersionId: version!.id })
      .where(eq(agents.id, agent.id))
      .returning();

    await syncAgentPresence(tx, agent.id);
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "agent.create",
        entityType: "agent",
        entityId: agent.id,
        changes: {
          name: input.name,
          title: input.title,
          departmentId: input.departmentId,
          status: input.status,
          version: 1,
          allowedTools: input.allowedTools,
          hierarchyLevel: level,
          reportsToAgentId: input.reportsToAgentId ?? null,
        },
      },
      ctx.meta,
    );
    return withVersion!;
  });
}

export async function updateAgent(ctx: ServiceContext, id: string, raw: AgentUpdateInput) {
  assertCan(ctx.actor, "agents:write");
  const agentId = idSchema.parse(id);
  const input = agentUpdateSchema.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const [current] = await tx.select().from(agents).where(eq(agents.id, agentId)).for("update");
    if (!current) throw notFound("Funcionário");
    if (input.departmentId && input.departmentId !== current.departmentId) {
      await assertDepartmentUsable(tx, input.departmentId);
    }
    const level = input.hierarchyLevel ?? current.hierarchyLevel;
    if (input.reportsToAgentId !== undefined || input.hierarchyLevel !== undefined) {
      await assertReportingLine(tx, agentId, level, input.reportsToAgentId === undefined ? current.reportsToAgentId : input.reportsToAgentId);
    }
    if (input.hierarchyLevel !== undefined && input.hierarchyLevel !== current.hierarchyLevel) {
      // Existing reports must still rank below the new level.
      const reports = await tx.select().from(agents).where(eq(agents.reportsToAgentId, agentId));
      if (reports.some((r) => !canManage(level, r.hierarchyLevel))) {
        throw invalidState("Reatribua os subordinados antes de rebaixar este funcionário na hierarquia.");
      }
    }
    const [updated] = await tx.update(agents).set(input).where(eq(agents.id, agentId)).returning();
    await writeAudit(
      tx,
      ctx.actor,
      { action: "agent.update", entityType: "agent", entityId: agentId, changes: diff(current, input) },
      ctx.meta,
    );
    return updated!;
  });
}

export async function setAgentStatus(ctx: ServiceContext, id: string, status: AgentStatus) {
  assertCan(ctx.actor, "agents:write");
  const agentId = idSchema.parse(id);
  return ctx.db.transaction(async (tx) => {
    const [current] = await tx.select().from(agents).where(eq(agents.id, agentId)).for("update");
    if (!current) throw notFound("Funcionário");
    if (current.status === status) return current;
    if (status === "archived") {
      const [busy] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.assignedAgentId, agentId), eq(tasks.status, "in_progress")))
        .limit(1);
      if (busy) throw new AppError("INVALID_STATE", "O funcionário possui tarefas em andamento.");
    }
    const [updated] = await tx.update(agents).set({ status }).where(eq(agents.id, agentId)).returning();
    await syncAgentPresence(tx, agentId);
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "agent.status_change",
        entityType: "agent",
        entityId: agentId,
        changes: { status: { from: current.status, to: status } },
      },
      ctx.meta,
    );
    return updated!;
  });
}

/** Instructions and tool authorizations are immutable per version: changing them creates a new version. */
export async function createAgentVersion(ctx: ServiceContext, id: string, raw: AgentVersionCreateInput) {
  assertCan(ctx.actor, "agents:write");
  const agentId = idSchema.parse(id);
  const input = agentVersionCreateSchema.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const [agent] = await tx.select().from(agents).where(eq(agents.id, agentId)).for("update");
    if (!agent) throw notFound("Funcionário");
    if (agent.status === "archived") throw new AppError("INVALID_STATE", "Funcionário arquivado.");
    const [{ latest } = { latest: 0 }] = await tx
      .select({ latest: max(agentVersions.version) })
      .from(agentVersions)
      .where(eq(agentVersions.agentId, agentId));
    const nextVersion = (latest ?? 0) + 1;
    const [version] = await tx
      .insert(agentVersions)
      .values({
        agentId,
        version: nextVersion,
        instructions: input.instructions,
        allowedTools: input.allowedTools,
        aiProvider: input.aiProvider,
        aiModel: input.aiModel,
        changeNote: input.changeNote,
        createdById: ctx.actor.type === "user" ? ctx.actor.userId : null,
      })
      .returning();
    await tx.update(agents).set({ currentVersionId: version!.id }).where(eq(agents.id, agentId));
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "agent.version_create",
        entityType: "agent",
        entityId: agentId,
        changes: { version: nextVersion, allowedTools: input.allowedTools, changeNote: input.changeNote },
      },
      ctx.meta,
    );
    return version!;
  });
}

/** Activates a previous version (rollback). */
export async function activateAgentVersion(ctx: ServiceContext, id: string, versionId: string) {
  assertCan(ctx.actor, "agents:write");
  const agentId = idSchema.parse(id);
  const vId = idSchema.parse(versionId);
  return ctx.db.transaction(async (tx) => {
    const [agent] = await tx.select().from(agents).where(eq(agents.id, agentId)).for("update");
    if (!agent) throw notFound("Funcionário");
    const [version] = await tx
      .select()
      .from(agentVersions)
      .where(and(eq(agentVersions.id, vId), eq(agentVersions.agentId, agentId)));
    if (!version) throw notFound("Versão");
    if (agent.currentVersionId === version.id) return version;
    await tx.update(agents).set({ currentVersionId: version.id }).where(eq(agents.id, agentId));
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "agent.version_activate",
        entityType: "agent",
        entityId: agentId,
        changes: { currentVersionId: { from: agent.currentVersionId, to: version.id }, version: version.version },
      },
      ctx.meta,
    );
    return version;
  });
}
