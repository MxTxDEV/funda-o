import { logger } from "@vc/core";
import { closeDb, getDb } from "@vc/db";
import {
  closeRedis,
  closeTasksQueue,
  createRedis,
  MAINTENANCE_QUEUE,
  QUEUE_PREFIX,
  RECONCILE_JOB,
  TASKS_QUEUE,
  WORKER_HEARTBEAT_KEY,
} from "@vc/queue";
import { Queue, Worker } from "bullmq";
import { createServer } from "node:http";
import { processTaskJob, reconcile } from "@vc/engine";

for (const key of ["DATABASE_URL", "REDIS_URL"]) {
  if (!process.env[key]) {
    logger.error("worker.missing_env", { key });
    process.exit(1);
  }
}

const db = getDb();
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 5);
const workerConnection = createRedis("worker");
const heartbeatRedis = createRedis("general");

const tasksWorker = new Worker(TASKS_QUEUE, (job) => processTaskJob(db, job), {
  connection: workerConnection,
  prefix: QUEUE_PREFIX,
  concurrency,
  lockDuration: 60_000,
  maxStalledCount: 2,
});

const maintenanceQueue = new Queue(MAINTENANCE_QUEUE, { connection: createRedis("queue"), prefix: QUEUE_PREFIX });
await maintenanceQueue.upsertJobScheduler(RECONCILE_JOB, { every: 60_000 }, { name: RECONCILE_JOB });
const maintenanceWorker = new Worker(MAINTENANCE_QUEUE, () => reconcile(db), {
  connection: createRedis("worker"),
  prefix: QUEUE_PREFIX,
  concurrency: 1,
});

tasksWorker.on("failed", (job, err) => logger.warn("job.failed", { jobId: job?.id, attemptsMade: job?.attemptsMade, err: err.message }));
tasksWorker.on("error", (err) => logger.error("worker.error", { err }));
maintenanceWorker.on("error", (err) => logger.error("maintenance.error", { err }));

async function beat() {
  await heartbeatRedis.set(WORKER_HEARTBEAT_KEY, new Date().toISOString(), "EX", 30).catch((err) =>
    logger.warn("worker.heartbeat_failed", { err: (err as Error).message }),
  );
}
await beat();
const heartbeat = setInterval(beat, 10_000);

// Optional liveness endpoint for container platforms.
const healthPort = process.env.WORKER_HEALTH_PORT ? Number(process.env.WORKER_HEALTH_PORT) : null;
const health = healthPort
  ? createServer((_req, res) => {
      const ok = tasksWorker.isRunning();
      res.writeHead(ok ? 200 : 503, { "content-type": "application/json" }).end(JSON.stringify({ ok }));
    }).listen(healthPort)
  : null;

logger.info("worker.started", { concurrency, queue: TASKS_QUEUE, healthPort });

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("worker.shutdown", { signal });
  clearInterval(heartbeat);
  health?.close();
  await Promise.allSettled([tasksWorker.close(), maintenanceWorker.close()]);
  await Promise.allSettled([maintenanceQueue.close(), heartbeatRedis.del(WORKER_HEARTBEAT_KEY)]);
  heartbeatRedis.disconnect();
  await Promise.allSettled([closeTasksQueue(), closeRedis(), closeDb()]);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
