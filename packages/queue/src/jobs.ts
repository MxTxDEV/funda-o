import { z } from "zod";

export const QUEUE_PREFIX = process.env.QUEUE_PREFIX ?? "vc";
export const TASKS_QUEUE = "tasks";
export const MAINTENANCE_QUEUE = "maintenance";

export const taskRunJobSchema = z.object({
  taskId: z.uuid(),
  runNumber: z.number().int().positive(),
});
export type TaskRunJob = z.infer<typeof taskRunJobSchema>;

/** Deterministic job id: re-enqueueing the same run is a no-op (idempotency). */
export function taskRunJobId(taskId: string, runNumber: number) {
  return `task-${taskId}-run-${runNumber}`;
}

export const RECONCILE_JOB = "reconcile-queued-tasks";

export const PRIORITY_MAP = { urgent: 1, high: 2, normal: 3, low: 4 } as const;

export const DEFAULT_TASK_ATTEMPTS = 3;
export const TASK_BACKOFF = { type: "exponential" as const, delay: 2_000 };

export const WORKER_HEARTBEAT_KEY = `${QUEUE_PREFIX}:worker:heartbeat`;
