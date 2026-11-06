import { logger } from "@vc/core";
import type { Database } from "@vc/db";
import { createRedis, getRedis, getTasksQueue, QUEUE_PREFIX, TASKS_QUEUE, WORKER_HEARTBEAT_KEY } from "@vc/queue";
import { Worker } from "bullmq";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { reconcile } from "./reconciler";
import { processTaskJob } from "./run-task";

const LOCK_KEY = `${QUEUE_PREFIX}:drain:lock`;

export type DrainResult = { ran: boolean; reason?: "locked"; processedFor?: number };

/**
 * Serverless execution mode: runs a short-lived BullMQ worker until the queue is empty
 * (including delayed retries) or the time budget is spent. Only one drainer runs at a time
 * (Redis lock). Same processors, retries and idempotency as the standalone worker.
 */
export async function drainQueue(
  db: Database,
  opts: { budgetMs: number; concurrency?: number; pollMs?: number } = { budgetMs: 240_000 },
): Promise<DrainResult> {
  const started = Date.now();
  const lockToken = randomUUID();
  const lockTtl = opts.budgetMs + 60_000;
  const acquired = await getRedis().set(LOCK_KEY, lockToken, "PX", lockTtl, "NX");
  if (!acquired) return { ran: false, reason: "locked" };

  const connection = createRedis("worker");
  const worker = new Worker(TASKS_QUEUE, (job) => processTaskJob(db, job), {
    connection,
    prefix: QUEUE_PREFIX,
    concurrency: opts.concurrency ?? 5,
    lockDuration: 60_000,
    autorun: false,
  });
  worker.on("error", (err) => logger.error("drain.worker_error", { err }));

  try {
    await reconcile(db).catch((err) => logger.warn("drain.reconcile_failed", { err }));
    const running = worker.run();
    const queue = getTasksQueue();
    let idleChecks = 0;
    while (Date.now() - started < opts.budgetMs) {
      await getRedis().set(WORKER_HEARTBEAT_KEY, new Date().toISOString(), "EX", 30);
      await sleep(opts.pollMs ?? 1000);
      const c = await queue.getJobCounts("waiting", "prioritized", "active", "delayed");
      const pending = (c.waiting ?? 0) + (c.prioritized ?? 0) + (c.active ?? 0) + (c.delayed ?? 0);
      idleChecks = pending === 0 ? idleChecks + 1 : 0;
      if (idleChecks >= 2) break;
    }
    await worker.close();
    await running;
    return { ran: true, processedFor: Date.now() - started };
  } finally {
    await worker.close().catch(() => undefined);
    connection.disconnect();
    // Release the lock only if we still own it.
    await getRedis()
      .eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, LOCK_KEY, lockToken)
      .catch(() => undefined);
  }
}
