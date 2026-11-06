import {
  agentPresence,
  agents,
  agentVersions,
  approvals,
  conversations,
  departmentOfficeZones,
  departments,
  taskEvents,
  tasks,
} from "@vc/db";
import { getQueueMetrics, type QueueMetrics } from "@vc/queue";
import { and, count, desc, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { writeAudit } from "../audit";
import { assertCan, can } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { invalidState, notFound } from "../errors";
import { logger } from "../logger";
import {
  DEPARTMENT_ZONE_KEYS,
  type DepartmentZoneKey,
  deriveOfficeStatus,
  type OfficeStatus,
  resolveDepartmentZones,
  aiConnectionOf,
} from "../office";
import { idSchema } from "../validation";

/**
 * Everything the 3D office renders, computed from the operational tables (single source of truth).
 * Nothing is invented: empty sections stay empty.
 */
export async function getOfficeSnapshot(ctx: ServiceContext) {
  assertCan(ctx.actor, "dashboard:read");
  const db = ctx.db;
  const since = new Date(Date.now() - 24 * 3600 * 1000);

  const [deptRows, zoneRows, agentRows, activeTasks, pendingApprovals, finished24h] = await Promise.all([
    db.select().from(departments).orderBy(departments.createdAt),
    db.select().from(departmentOfficeZones),
    db
      .select({
        agent: agents,
        presenceState: agentPresence.state,
        statusMessage: agentPresence.statusMessage,
        currentTaskId: agentPresence.currentTaskId,
        allowedTools: agentVersions.allowedTools,
        version: agentVersions.version,
        aiProvider: agentVersions.aiProvider,
        aiModel: agentVersions.aiModel,
      })
      .from(agents)
      .leftJoin(agentPresence, eq(agentPresence.agentId, agents.id))
      .leftJoin(agentVersions, eq(agentVersions.id, agents.currentVersionId))
      .where(ne(agents.status, "archived"))
      .orderBy(agents.createdAt),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        assignedAgentId: tasks.assignedAgentId,
        departmentId: tasks.departmentId,
      })
      .from(tasks)
      .where(inArray(tasks.status, ["queued", "in_progress", "waiting_approval"])),
    db.select({ value: count() }).from(approvals).where(eq(approvals.status, "pending")),
    db
      .select({ status: tasks.status, value: count() })
      .from(tasks)
      .where(gte(tasks.finishedAt, since))
      .groupBy(tasks.status),
  ]);

  const agentIds = agentRows.map((r) => r.agent.id);
  const [recentEvents, directConversations] = await Promise.all([
    agentIds.length
      ? db
          .select({
            id: taskEvents.id,
            type: taskEvents.type,
            message: taskEvents.message,
            createdAt: taskEvents.createdAt,
            taskId: tasks.id,
            taskTitle: tasks.title,
            agentId: tasks.assignedAgentId,
          })
          .from(taskEvents)
          .innerJoin(tasks, eq(tasks.id, taskEvents.taskId))
          .where(inArray(tasks.assignedAgentId, agentIds))
          .orderBy(desc(taskEvents.createdAt))
          .limit(300)
      : Promise.resolve([]),
    agentIds.length
      ? db
          .select({ id: conversations.id, agentId: conversations.agentId })
          .from(conversations)
          .where(and(eq(conversations.kind, "direct"), isNull(conversations.archivedAt), inArray(conversations.agentId, agentIds)))
      : Promise.resolve([]),
  ]);

  const { placement, unplaced } = resolveDepartmentZones(deptRows, new Map(zoneRows.map((z) => [z.departmentId, z.zone])));

  const tasksByAgent = new Map<string, typeof activeTasks>();
  for (const t of activeTasks) {
    if (!t.assignedAgentId) continue;
    const list = tasksByAgent.get(t.assignedAgentId) ?? [];
    list.push(t);
    tasksByAgent.set(t.assignedAgentId, list);
  }
  const eventsByAgent = new Map<string, typeof recentEvents>();
  for (const e of recentEvents) {
    if (!e.agentId) continue;
    const list = eventsByAgent.get(e.agentId) ?? [];
    if (list.length < 6) list.push(e);
    eventsByAgent.set(e.agentId, list);
  }
  const conversationByAgent = new Map(directConversations.map((c) => [c.agentId, c.id]));
  const deskCounter = new Map<string, number>();

  const nameById = new Map(agentRows.map((r) => [r.agent.id, r.agent.name]));
  const officeAgents = agentRows.map(({ agent, presenceState, statusMessage, currentTaskId, allowedTools, version, aiProvider, aiModel }) => {
    const mine = tasksByAgent.get(agent.id) ?? [];
    const queuedTasks = mine.filter((t) => t.status === "queued").length;
    const officeStatus: OfficeStatus = deriveOfficeStatus({ agentStatus: agent.status, presence: presenceState, queuedTasks });
    const current = mine.find((t) => t.id === currentTaskId) ?? mine.find((t) => t.status === "in_progress") ?? mine[0] ?? null;
    const deskIndex = deskCounter.get(agent.departmentId) ?? 0;
    deskCounter.set(agent.departmentId, deskIndex + 1);
    return {
      id: agent.id,
      name: agent.name,
      title: agent.title,
      specialty: agent.specialty,
      description: agent.description,
      specialties: agent.specialties,
      responsibilities: agent.responsibilities,
      personality: agent.personality,
      hierarchyLevel: agent.hierarchyLevel,
      reportsTo: agent.reportsToAgentId ? { id: agent.reportsToAgentId, name: nameById.get(agent.reportsToAgentId) ?? "—" } : null,
      appearance: agent.appearance,
      aiProvider: aiProvider ?? null,
      aiModel: aiModel ?? null,
      aiConnection: aiConnectionOf(aiProvider, aiModel),
      createdAt: agent.createdAt.toISOString(),
      avatarSeed: agent.avatarSeed,
      avatarUrl: agent.avatarUrl,
      status: agent.status,
      isDemo: agent.isDemo,
      departmentId: agent.departmentId,
      presence: presenceState ?? "offline",
      officeStatus,
      statusMessage: statusMessage ?? "",
      currentTask: current ? { id: current.id, title: current.title, status: current.status } : null,
      activeTaskCount: mine.length,
      queuedTaskCount: queuedTasks,
      version: version ?? null,
      allowedTools: allowedTools ?? [],
      deskIndex,
      directConversationId: conversationByAgent.get(agent.id) ?? null,
      recentEvents: (eventsByAgent.get(agent.id) ?? []).map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
        taskId: e.taskId,
        taskTitle: e.taskTitle,
      })),
    };
  });

  const officeDepartments = deptRows.map((d) => {
    const members = officeAgents.filter((a) => a.departmentId === d.id);
    const place = placement.get(d.id) ?? null;
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      color: d.color,
      isActive: d.isActive,
      isDemo: d.isDemo,
      zone: place?.zone ?? null,
      zoneSource: place?.source ?? null,
      agentCount: members.length,
      availableCount: members.filter((a) => a.officeStatus === "available").length,
      activeTaskCount: activeTasks.filter((t) => t.departmentId === d.id).length,
      activeTasks: activeTasks
        .filter((t) => t.departmentId === d.id)
        .slice(0, 8)
        .map((t) => ({ id: t.id, title: t.title, status: t.status })),
    };
  });

  let queue: QueueMetrics | null = null;
  try {
    queue = await getQueueMetrics();
  } catch (err) {
    logger.warn("office.queue_metrics_unavailable", { err });
  }

  const byStatus = (s: OfficeStatus) => officeAgents.filter((a) => a.officeStatus === s).length;
  const finished = Object.fromEntries(finished24h.map((r) => [r.status, r.value]));

  return {
    generatedAt: new Date().toISOString(),
    departments: officeDepartments,
    unplacedDepartmentIds: unplaced,
    agents: officeAgents,
    metrics: {
      agents: officeAgents.length,
      // Only employees actually executing a task count as working.
      working: byStatus("executing"),
      queued: byStatus("working"),
      available: byStatus("available"),
      resting: byStatus("resting"),
      activeTasks: activeTasks.length,
      pendingApprovals: pendingApprovals[0]?.value ?? 0,
      departments: deptRows.length,
    },
    brain: {
      /** The Central Brain AI engine is not integrated yet (FOUNDATION). */
      integrated: false,
      connectedAgents: officeAgents.filter((a) => a.status === "active" && a.version !== null).length,
      authorizedTools: Array.from(new Set(officeAgents.flatMap((a) => a.allowedTools))).sort(),
      completedLast24h: Number(finished.completed ?? 0),
      failedLast24h: Number(finished.failed ?? 0),
      queue,
      executionMode: process.env.EXECUTION_MODE === "serverless" ? ("serverless" as const) : ("worker" as const),
    },
    permissions: {
      manageDepartments: can(ctx.actor, "departments:write"),
      writeConversations: can(ctx.actor, "conversations:write"),
      writeTasks: can(ctx.actor, "tasks:write"),
      decideApprovals: can(ctx.actor, "approvals:decide"),
    },
  };
}

export type OfficeSnapshot = Awaited<ReturnType<typeof getOfficeSnapshot>>;

/** Assigns (or clears with null) the room of a department. A room already taken is swapped. Audited. */
export async function setDepartmentOfficeZone(ctx: ServiceContext, departmentId: string, zone: string | null) {
  assertCan(ctx.actor, "departments:write");
  const id = idSchema.parse(departmentId);
  if (zone !== null && !DEPARTMENT_ZONE_KEYS.includes(zone as DepartmentZoneKey)) throw invalidState("Sala inválida.");
  return ctx.db.transaction(async (tx) => {
    const [dept] = await tx.select({ id: departments.id }).from(departments).where(eq(departments.id, id));
    if (!dept) throw notFound("Departamento");
    const [previous] = await tx.select().from(departmentOfficeZones).where(eq(departmentOfficeZones.departmentId, id));
    let swappedWith: string | null = null;
    if (zone === null) {
      await tx.delete(departmentOfficeZones).where(eq(departmentOfficeZones.departmentId, id));
    } else {
      const [occupant] = await tx.select().from(departmentOfficeZones).where(eq(departmentOfficeZones.zone, zone));
      if (occupant && occupant.departmentId !== id) {
        swappedWith = occupant.departmentId;
        await tx.delete(departmentOfficeZones).where(eq(departmentOfficeZones.departmentId, occupant.departmentId));
        if (previous) {
          await tx.insert(departmentOfficeZones).values({ departmentId: occupant.departmentId, zone: previous.zone, updatedById: ctx.actor.type === "user" ? ctx.actor.userId : null });
        }
      }
      await tx
        .insert(departmentOfficeZones)
        .values({ departmentId: id, zone, updatedById: ctx.actor.type === "user" ? ctx.actor.userId : null })
        .onConflictDoUpdate({ target: departmentOfficeZones.departmentId, set: { zone, updatedById: ctx.actor.type === "user" ? ctx.actor.userId : null } });
    }
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "department.office_zone",
        entityType: "department",
        entityId: id,
        changes: { zone: { from: previous?.zone ?? null, to: zone }, swappedWith },
      },
      ctx.meta,
    );
    return { zone, swappedWith };
  });
}

/** Workstation of an employee in the 3D office: room (zone) and desk number, derived like the office view. */
export async function getAgentWorkstation(ctx: ServiceContext, agentId: string) {
  assertCan(ctx.actor, "agents:read");
  const [agent] = await ctx.db.select().from(agents).where(eq(agents.id, idSchema.parse(agentId)));
  if (!agent) throw notFound("Funcionário");
  const [deptRows, zoneRows, mates] = await Promise.all([
    ctx.db.select().from(departments).orderBy(departments.createdAt),
    ctx.db.select().from(departmentOfficeZones),
    ctx.db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.departmentId, agent.departmentId), ne(agents.status, "archived")))
      .orderBy(agents.createdAt),
  ]);
  const { placement } = resolveDepartmentZones(deptRows, new Map(zoneRows.map((z) => [z.departmentId, z.zone])));
  const zone = placement.get(agent.departmentId)?.zone ?? null;
  const desk = mates.findIndex((m) => m.id === agent.id);
  return { zone, desk: desk >= 0 ? desk + 1 : null, resting: agent.status === "paused" };
}
