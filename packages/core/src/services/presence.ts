import { agentPresence, agents, type DbExecutor, type PresenceState, tasks } from "@vc/db";
import { and, desc, eq, inArray } from "drizzle-orm";

/**
 * Recomputes an agent's presence from its status and its operational tasks.
 * Must be called inside the transaction that changed the agent or one of its tasks,
 * so presence never drifts from the source of truth.
 */
export async function syncAgentPresence(db: DbExecutor, agentId: string) {
  const [agent] = await db.select({ status: agents.status }).from(agents).where(eq(agents.id, agentId));
  if (!agent) return null;

  const active = await db
    .select({ id: tasks.id, status: tasks.status, title: tasks.title })
    .from(tasks)
    .where(and(eq(tasks.assignedAgentId, agentId), inArray(tasks.status, ["in_progress", "waiting_approval"])))
    .orderBy(desc(tasks.updatedAt));

  const working = active.find((t) => t.status === "in_progress");
  const waiting = active.find((t) => t.status === "waiting_approval");

  let state: PresenceState;
  let currentTaskId: string | null = null;
  let statusMessage = "";

  if (agent.status === "archived") {
    state = "offline";
  } else if (agent.status === "paused") {
    state = "paused";
  } else if (working) {
    state = "working";
    currentTaskId = working.id;
    statusMessage = working.title;
  } else if (waiting) {
    state = "waiting_approval";
    currentTaskId = waiting.id;
    statusMessage = waiting.title;
  } else {
    state = "idle";
  }

  const now = new Date();
  const [row] = await db
    .insert(agentPresence)
    .values({ agentId, state, currentTaskId, statusMessage, lastActivityAt: now })
    .onConflictDoUpdate({
      target: agentPresence.agentId,
      set: { state, currentTaskId, statusMessage, lastActivityAt: now },
    })
    .returning();
  return row ?? null;
}
