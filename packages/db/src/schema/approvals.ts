import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { createdAt, id, tsz, updatedAt } from "./columns";
import { actorTypeEnum, approvalStatusEnum } from "./enums";
import { tasks } from "./tasks";
import { users } from "./users";

export const approvals = pgTable(
  "approvals",
  {
    id: id(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    /** What is being approved (e.g. "task_output"). */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** sha256 of the exact content being approved. A different content requires a new approval. */
    contentHash: text("content_hash"),
    status: approvalStatusEnum("status").notNull().default("pending"),
    requestedByType: actorTypeEnum("requested_by_type").notNull(),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: tsz("decided_at"),
    decisionNote: text("decision_note"),
    /** Optimistic concurrency counter. */
    version: integer("version").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("approvals_status_idx").on(t.status, t.createdAt),
    index("approvals_task_idx").on(t.taskId),
    // At most one pending approval per task: makes approval requests idempotent.
    uniqueIndex("approvals_task_pending_uq").on(t.taskId).where(sql`${t.status} = 'pending'`),
  ],
);

export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
