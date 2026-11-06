import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { agents, agentVersions } from "./agents";
import { createdAt, id, tsz, updatedAt } from "./columns";
import { departments } from "./departments";
import { actorTypeEnum, taskPriorityEnum, taskStatusEnum } from "./enums";
import { users } from "./users";

export type TaskError = { code: string; message: string; attempt?: number };

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** Processor key executed by the worker (e.g. "demo.lifecycle"). */
    type: text("type").notNull(),
    status: taskStatusEnum("status").notNull().default("pending"),
    priority: taskPriorityEnum("priority").notNull().default("normal"),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: jsonb("error").$type<TaskError>(),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    assignedAgentId: uuid("assigned_agent_id").references(() => agents.id, { onDelete: "set null" }),
    /** Agent version snapshot used when the task was dispatched. */
    agentVersionId: uuid("agent_version_id").references(() => agentVersions.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    /** Number of times the task was dispatched to the queue. Part of the idempotent job id. */
    runCount: integer("run_count").notNull().default(0),
    /** Execution attempts across all runs. */
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    /** Optimistic concurrency counter; incremented on every state change. */
    version: integer("version").notNull().default(0),
    /** Client supplied key to make task creation idempotent. */
    idempotencyKey: text("idempotency_key"),
    isDemo: boolean("is_demo").notNull().default(false),
    queuedAt: tsz("queued_at"),
    startedAt: tsz("started_at"),
    finishedAt: tsz("finished_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tasks_status_idx").on(t.status),
    index("tasks_agent_status_idx").on(t.assignedAgentId, t.status),
    index("tasks_department_idx").on(t.departmentId),
    index("tasks_created_at_idx").on(t.createdAt),
    uniqueIndex("tasks_idempotency_key_uq").on(t.idempotencyKey),
  ],
);

export const taskEvents = pgTable(
  "task_events",
  {
    id: id(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    /** created | assigned | queued | started | progress | retry_scheduled | approval_requested | approval_granted | approval_rejected | completed | failed | cancelled | result_discarded */
    type: text("type").notNull(),
    fromStatus: taskStatusEnum("from_status"),
    toStatus: taskStatusEnum("to_status"),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorAgentId: uuid("actor_agent_id").references(() => agents.id, { onDelete: "set null" }),
    message: text("message").notNull().default(""),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("task_events_task_created_idx").on(t.taskId, t.createdAt), index("task_events_created_idx").on(t.createdAt)],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskEvent = typeof taskEvents.$inferSelect;
