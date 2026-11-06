import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./columns";
import { departments } from "./departments";
import { agentStatusEnum } from "./enums";
import { users } from "./users";

export const agents = pgTable(
  "agents",
  {
    id: id(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    /** Job title ("cargo"). */
    title: text("title").notNull(),
    specialty: text("specialty").notNull(),
    description: text("description").notNull().default(""),
    avatarUrl: text("avatar_url"),
    /** Seed for the generated stylized avatar when no avatarUrl is set. */
    avatarSeed: text("avatar_seed").notNull(),
    status: agentStatusEnum("status").notNull().default("active"),
    currentVersionId: uuid("current_version_id").references((): AnyPgColumn => agentVersions.id, {
      onDelete: "set null",
    }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("agents_department_idx").on(t.departmentId),
    index("agents_status_idx").on(t.status),
  ],
);

export const agentVersions = pgTable(
  "agent_versions",
  {
    id: id(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    instructions: text("instructions").notNull(),
    /** Tool identifiers from the tool catalog that this version is authorized to use. */
    allowedTools: jsonb("allowed_tools").$type<string[]>().notNull().default([]),
    /** Reserved for the Central Brain (model, temperature, limits...). */
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    changeNote: text("change_note").notNull().default(""),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("agent_versions_agent_version_uq").on(t.agentId, t.version)],
);

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentVersion = typeof agentVersions.$inferSelect;
