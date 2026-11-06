import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { createdAt, id, tsz, updatedAt } from "./columns";
import { departments } from "./departments";
import { authorTypeEnum, conversationKindEnum } from "./enums";
import { users } from "./users";

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    kind: conversationKindEnum("kind").notNull(),
    title: text("title").notNull(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    archivedAt: tsz("archived_at"),
    lastMessageAt: tsz("last_message_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("conversations_kind_idx").on(t.kind),
    index("conversations_last_message_idx").on(t.lastMessageAt),
    check(
      "conversations_target_ck",
      sql`(${t.kind} = 'direct' AND ${t.agentId} IS NOT NULL AND ${t.departmentId} IS NULL)
        OR (${t.kind} = 'department' AND ${t.departmentId} IS NOT NULL AND ${t.agentId} IS NULL)
        OR (${t.kind} = 'general' AND ${t.agentId} IS NULL AND ${t.departmentId} IS NULL)`,
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorType: authorTypeEnum("author_type").notNull(),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    authorAgentId: uuid("author_agent_id").references(() => agents.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_created_idx").on(t.conversationId, t.createdAt)],
);

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
