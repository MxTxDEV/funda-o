import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
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
    /** Structured profile (lists of short items). */
    specialties: jsonb("specialties").$type<string[]>().notNull().default([]),
    responsibilities: jsonb("responsibilities").$type<string[]>().notNull().default([]),
    /** Professional personality (free text). */
    personality: text("personality").notNull().default(""),
    /** Organizational level: coo (coordinates the operation), director (leads a department), specialist. */
    hierarchyLevel: text("hierarchy_level").$type<AgentHierarchyLevel>().notNull().default("specialist"),
    reportsToAgentId: uuid("reports_to_agent_id").references((): AnyPgColumn => agents.id, { onDelete: "set null" }),
    /** Visual configuration of the 3D/2D character (body, hair, outfit...). Empty = derived from avatarSeed. */
    appearance: jsonb("appearance").$type<AgentAppearance>().notNull().default({}),
    /** Stable key for records created by an idempotent seed (e.g. "team:alex"). Never shown to users. */
    seedKey: text("seed_key"),
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
    index("agents_reports_to_idx").on(t.reportsToAgentId),
    uniqueIndex("agents_seed_key_uq").on(t.seedKey),
    check("agents_hierarchy_level_ck", sql`${t.hierarchyLevel} IN ('coo', 'director', 'specialist')`),
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
    /** AI provider and model configured for this version (null = not configured; no AI integration exists yet). */
    aiProvider: text("ai_provider"),
    aiModel: text("ai_model"),
    /** Reserved for the Central Brain (temperature, limits...). */
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    changeNote: text("change_note").notNull().default(""),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("agent_versions_agent_version_uq").on(t.agentId, t.version)],
);

export type AgentHierarchyLevel = "coo" | "director" | "specialist";

/** Character look. Every field optional; missing fields are derived from the avatar seed. */
export type AgentAppearance = {
  body?: "feminine" | "masculine";
  skin?: string;
  hair?: string;
  hairStyle?: "short" | "side" | "long" | "bun" | "curly" | "bald" | "ponytail";
  outfit?: "suit" | "blazer" | "shirt" | "sweater" | "polo";
  outfitColor?: string;
  glasses?: boolean;
  beard?: boolean;
  tie?: boolean;
};

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentVersion = typeof agentVersions.$inferSelect;
