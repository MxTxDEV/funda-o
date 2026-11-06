import { failTaskRun, findStaleInProgressTasks, findStaleQueuedTasks, logger } from "@vc/core";
import type { Database } from "@vc/db";
import { enqueueTaskRun, getTaskRunState } from "@vc/queue";

const QUEUED_GRACE_MS = 60_000;
const IN_PROGRESS_GRACE_MS = 10 * 60_000;

/**
 * Self-healing pass, run periodically by the worker:
 * 1. Tasks stuck in "queued" (enqueue failed after commit) are re-enqueued. Job ids are deterministic,
 *    so an existing job is never duplicated.
 * 2. Tasks "in_progress" whose job no longer exists or already finished are marked as failed (worker lost).
 */
export async function reconcile(db: Database) {
  let requeued = 0;
  let lost = 0;
  for (const t of await findStaleQueuedTasks(db, QUEUED_GRACE_MS)) {
    const state = await getTaskRunState(t.id, t.runCount);
    if (state === null) {
      await enqueueTaskRun({ taskId: t.id, runNumber: t.runCount }, { priority: t.priority, attempts: t.maxAttempts });
      requeued++;
    }
  }
  for (const t of await findStaleInProgressTasks(db, IN_PROGRESS_GRACE_MS)) {
    const state = await getTaskRunState(t.id, t.runCount);
    if (state === null || state === "failed" || state === "completed") {
      await failTaskRun(db, { taskId: t.id, runNumber: t.runCount }, { code: "WORKER_LOST", message: "Execução perdida pelo worker" }, false);
      lost++;
    }
  }
  if (requeued || lost) logger.info("reconcile.done", { requeued, lost });
  return { requeued, lost };
}
