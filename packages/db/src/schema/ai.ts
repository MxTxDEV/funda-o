import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { agents, agentVersions } from "./agents";
import { createdAt, id, tsz } from "./columns";
import { tasks } from "./tasks";
import { users } from "./users";

export const AGENT_RUN_STATUSES = ["running", "succeeded", "failed", "aborted"] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];
export type AgentRunError = { kind: string; message: string; status?: number | null; retryable?: boolean };

/**
 * One model execution of an employee (one row per task run attempt). Immutable record of what ran:
 * the agent version, provider and model, a hash of the exact prompt, token usage, cost and outcome.
 * Prompts and outputs live in the task (result) — credentials are never stored.
 */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: id(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    runNumber: integer("run_number").notNull(),
    attempt: integer("attempt").notNull(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    agentVersionId: uuid("agent_version_id").references(() => agentVersions.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    /** Model identifier reported back by the provider. */
    responseModel: text("response_model"),
    status: text("status").$type<AgentRunStatus>().notNull().default("running"),
    /** sha256 of system prompt + messages sent to the model. */
    promptHash: text("prompt_hash").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    /** Estimated cost in USD from configured prices; null when no price is configured. */
    costUsd: numeric("cost_usd", { precision: 14, scale: 6, mode: "number" }),
    finishReason: text("finish_reason"),
    providerRequestId: text("provider_request_id"),
    /** Tools actually invoked during the run (empty until tools are connected). */
    toolsUsed: jsonb("tools_used").$type<string[]>().notNull().default([]),
    error: jsonb("error").$type<AgentRunError>(),
    startedAt: tsz("started_at").notNull().defaultNow(),
    finishedAt: tsz("finished_at"),
    durationMs: integer("duration_ms"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("agent_runs_task_run_attempt_uq").on(t.taskId, t.runNumber, t.attempt),
    index("agent_runs_agent_started_idx").on(t.agentId, t.startedAt),
    index("agent_runs_started_idx").on(t.startedAt),
    index("agent_runs_status_idx").on(t.status),
    check("agent_runs_status_ck", sql`${t.status} IN ('running', 'succeeded', 'failed', 'aborted')`),
  ],
);

/** Result of the last connection test of each AI provider (no credential is ever stored). */
export const aiProviderChecks = pgTable("ai_provider_checks", {
  provider: text("provider").primaryKey(),
  ok: boolean("ok").notNull(),
  message: text("message").notNull().default(""),
  latencyMs: integer("latency_ms"),
  /** Model identifiers returned by the provider's list-models endpoint at check time. */
  models: jsonb("models").$type<{ id: string; displayName: string | null }[]>().notNull().default([]),
  checkedAt: tsz("checked_at").notNull().defaultNow(),
  checkedByUserId: uuid("checked_by_user_id").references(() => users.id, { onDelete: "set null" }),
});

export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
export type AiProviderCheck = typeof aiProviderChecks.$inferSelect;
