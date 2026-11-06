import { agentPresence, agents, approvals, departments, taskEvents, tasks } from "@vc/db";
import { getQueueMetrics, type QueueMetrics } from "@vc/queue";
import { and, count, desc, eq, gte, ne, sql } from "drizzle-orm";
import { assertCan } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { logger } from "../logger";
import { countTasksByStatus } from "./tasks";

/** Aggregates real operational data. Returns zeros/empty lists when nothing exists — never placeholders. */
export async function getDashboard(ctx: ServiceContext) {
  assertCan(ctx.actor, "dashboard:read");
  const db = ctx.db;
  const since = new Date(Date.now() - 24 * 3600 * 1000);

  const [deptRows, agentRows, presenceRows, tasksByStatus, pendingApprovals, last24h, recentEvents, floor] =
    await Promise.all([
      db
        .select({ isActive: departments.isActive, value: count() })
        .from(departments)
        .groupBy(departments.isActive),
      db.select({ status: agents.status, value: count() }).from(agents).groupBy(agents.status),
      db
        .select({ state: agentPresence.state, value: count() })
        .from(agentPresence)
        .innerJoin(agents, eq(agents.id, agentPresence.agentId))
        .where(ne(agents.status, "archived"))
        .groupBy(agentPresence.state),
      countTasksByStatus(db),
      db.select({ value: count() }).from(approvals).where(eq(approvals.status, "pending")),
      db
        .select({ status: tasks.status, value: count() })
        .from(tasks)
        .where(and(gte(tasks.finishedAt, since)))
        .groupBy(tasks.status),
      db
        .select({
          id: taskEvents.id,
          type: taskEvents.type,
          message: taskEvents.message,
          toStatus: taskEvents.toStatus,
          actorType: taskEvents.actorType,
          createdAt: taskEvents.createdAt,
          taskId: tasks.id,
          taskTitle: tasks.title,
          taskIsDemo: tasks.isDemo,
        })
        .from(taskEvents)
        .innerJoin(tasks, eq(tasks.id, taskEvents.taskId))
        .orderBy(desc(taskEvents.createdAt))
        .limit(15),
      db.query.agents.findMany({
        where: ne(agents.status, "archived"),
        columns: { id: true, name: true, title: true, avatarSeed: true, avatarUrl: true, status: true, isDemo: true, departmentId: true },
        with: {
          department: { columns: { id: true, name: true, color: true, isActive: true } },
          presence: { columns: { state: true, statusMessage: true, currentTaskId: true, lastActivityAt: true } },
        },
        orderBy: (a, { asc }) => [asc(a.name)],
      }),
    ]);

  let queue: QueueMetrics | null = null;
  try {
    queue = await getQueueMetrics();
  } catch (err) {
    logger.warn("dashboard.queue_metrics_unavailable", { err });
  }

  const sum = (rows: { value: number }[]) => rows.reduce((acc, r) => acc + r.value, 0);
  const byKey = <K extends string>(rows: { value: number }[], key: (r: never) => K) =>
    Object.fromEntries(rows.map((r) => [key(r as never), r.value])) as Partial<Record<K, number>>;

  const demoCount = await db
    .select({ value: sql<number>`(select count(*) from ${agents} where ${agents.isDemo}) + (select count(*) from ${departments} where ${departments.isDemo})` })
    .from(sql`(select 1) as one`);

  return {
    departments: {
      total: sum(deptRows),
      active: deptRows.find((r) => r.isActive)?.value ?? 0,
    },
    agents: {
      total: sum(agentRows.filter((r) => r.status !== "archived")),
      byStatus: byKey(agentRows, (r: { status: string }) => r.status),
    },
    presence: byKey(presenceRows, (r: { state: string }) => r.state),
    tasks: {
      byStatus: tasksByStatus,
      total: Object.values(tasksByStatus).reduce((a, b) => a + (b ?? 0), 0),
      finishedLast24h: byKey(last24h, (r: { status: string }) => r.status),
    },
    approvals: { pending: pendingApprovals[0]?.value ?? 0 },
    recentEvents,
    floor,
    queue,
    hasDemoData: Number(demoCount[0]?.value ?? 0) > 0,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
