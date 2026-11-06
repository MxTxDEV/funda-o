import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { agentRuns } from "./ai";
import { agents } from "./agents";
import { createdAt, id, tsz } from "./columns";
import { tasks } from "./tasks";

export const TOOL_EXECUTION_STATUSES = ["succeeded", "failed", "denied"] as const;
export type ToolExecutionStatus = (typeof TOOL_EXECUTION_STATUSES)[number];

/** Every tool call requested by a model: allowed or denied, with validated input and outcome. */
export const toolExecutions = pgTable(
  "tool_executions",
  {
    id: id(),
    toolId: text("tool_id").notNull(),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    status: text("status").$type<ToolExecutionStatus>().notNull(),
    /** Validated input (truncated). Never contains credentials. */
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    /** Short human-readable outcome. */
    summary: text("summary").notNull().default(""),
    /** Structured output kept for audit (truncated). */
    output: jsonb("output").$type<Record<string, unknown>>(),
    error: text("error"),
    /** Why a call was refused (not_granted, autonomy_too_low, limit_per_run, invalid_input…). */
    denialReason: text("denial_reason"),
    durationMs: integer("duration_ms"),
    startedAt: tsz("started_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    index("tool_executions_tool_started_idx").on(t.toolId, t.startedAt),
    index("tool_executions_agent_started_idx").on(t.agentId, t.startedAt),
    index("tool_executions_task_idx").on(t.taskId),
    index("tool_executions_run_idx").on(t.agentRunId),
    check("tool_executions_status_ck", sql`${t.status} IN ('succeeded', 'failed', 'denied')`),
  ],
);

/** References collected by research tools (pages read, search results), linked to the task. */
export const researchSources = pgTable(
  "research_sources",
  {
    id: id(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    toolExecutionId: uuid("tool_execution_id").references(() => toolExecutions.id, { onDelete: "set null" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    kind: text("kind").$type<"web_page" | "search_result">().notNull(),
    url: text("url").notNull(),
    title: text("title").notNull().default(""),
    excerpt: text("excerpt").notNull().default(""),
    /** sha256 of the retrieved text (web_page) — proves which content was read. */
    contentHash: text("content_hash"),
    retrievedAt: tsz("retrieved_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("research_sources_task_idx").on(t.taskId), check("research_sources_kind_ck", sql`${t.kind} IN ('web_page', 'search_result')`)],
);

export type ToolExecution = typeof toolExecutions.$inferSelect;
export type ResearchSource = typeof researchSources.$inferSelect;
