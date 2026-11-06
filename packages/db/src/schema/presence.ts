import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { tsz, updatedAt } from "./columns";
import { presenceStateEnum } from "./enums";
import { tasks } from "./tasks";

export type PresenceLocation = { zone?: string; desk?: string };

export const agentPresence = pgTable("agent_presence", {
  agentId: uuid("agent_id")
    .primaryKey()
    .references(() => agents.id, { onDelete: "cascade" }),
  state: presenceStateEnum("state").notNull().default("offline"),
  currentTaskId: uuid("current_task_id").references(() => tasks.id, { onDelete: "set null" }),
  statusMessage: text("status_message").notNull().default(""),
  /** Reserved for the 3D office (zone / desk). */
  location: jsonb("location").$type<PresenceLocation>().notNull().default({}),
  lastActivityAt: tsz("last_activity_at"),
  updatedAt: updatedAt(),
});

export type AgentPresence = typeof agentPresence.$inferSelect;
