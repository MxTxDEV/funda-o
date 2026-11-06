import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "./columns";
import { actorTypeEnum } from "./enums";
import { users } from "./users";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    /** Human readable actor (email, "worker", "system") preserved even if the user is deleted. */
    actorLabel: text("actor_label").notNull(),
    /** Dotted action name, e.g. "task.cancel". */
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    changes: jsonb("changes").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_created_idx").on(t.createdAt),
    index("audit_actor_idx").on(t.actorUserId),
    index("audit_action_idx").on(t.action),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
