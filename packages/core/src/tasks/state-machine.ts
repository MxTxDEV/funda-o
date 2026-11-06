import type { TaskStatus } from "@vc/db/values";

/** Allowed task status transitions. Anything not listed is rejected. */
export const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ["queued", "cancelled"],
  queued: ["in_progress", "cancelled"],
  // in_progress → queued happens when an attempt fails and a retry is scheduled.
  in_progress: ["completed", "failed", "waiting_approval", "queued", "cancelled"],
  waiting_approval: ["queued", "failed", "cancelled"],
  // failed → queued is a manual retry.
  failed: ["queued"],
  completed: [],
  cancelled: [],
};

export const TERMINAL_STATUSES: readonly TaskStatus[] = ["completed", "cancelled"];
export const ACTIVE_STATUSES: readonly TaskStatus[] = ["queued", "in_progress", "waiting_approval"];
export const CANCELLABLE_STATUSES: readonly TaskStatus[] = ["pending", "queued", "in_progress", "waiting_approval"];

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}
