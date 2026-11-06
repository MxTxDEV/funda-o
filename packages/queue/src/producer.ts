import { Queue } from "bullmq";
import { getRedis } from "./connection";
import {
  DEFAULT_TASK_ATTEMPTS,
  PRIORITY_MAP,
  QUEUE_PREFIX,
  TASK_BACKOFF,
  TASKS_QUEUE,
  type TaskRunJob,
  taskRunJobId,
  WORKER_HEARTBEAT_KEY,
} from "./jobs";

const globalForQueue = globalThis as unknown as { __vcTasksQueue?: Queue<TaskRunJob> };

export function getTasksQueue(): Queue<TaskRunJob> {
  if (!globalForQueue.__vcTasksQueue) {
    globalForQueue.__vcTasksQueue = new Queue<TaskRunJob>(TASKS_QUEUE, {
      connection: getRedis(),
      prefix: QUEUE_PREFIX,
    });
  }
  return globalForQueue.__vcTasksQueue;
}

export async function closeTasksQueue() {
  if (globalForQueue.__vcTasksQueue) {
    await globalForQueue.__vcTasksQueue.close();
    globalForQueue.__vcTasksQueue = undefined;
  }
}

export type EnqueueOptions = {
  priority?: keyof typeof PRIORITY_MAP;
  attempts?: number;
};

export async function enqueueTaskRun(job: TaskRunJob, opts: EnqueueOptions = {}) {
  const queue = getTasksQueue();
  return queue.add("task.run", job, {
    jobId: taskRunJobId(job.taskId, job.runNumber),
    priority: PRIORITY_MAP[opts.priority ?? "normal"],
    attempts: opts.attempts ?? DEFAULT_TASK_ATTEMPTS,
    backoff: TASK_BACKOFF,
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  });
}

/** Best effort removal of a waiting/delayed job (e.g. after cancellation). Active jobs are left alone. */
export async function removeTaskRun(taskId: string, runNumber: number): Promise<boolean> {
  const job = await getTasksQueue().getJob(taskRunJobId(taskId, runNumber));
  if (!job) return false;
  const state = await job.getState();
  if (state === "waiting" || state === "delayed" || state === "prioritized" || state === "waiting-children") {
    await job.remove();
    return true;
  }
  return false;
}

export type QueueMetrics = {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  workerOnline: boolean;
  workerLastSeen: string | null;
};

export async function getQueueMetrics(): Promise<QueueMetrics> {
  const queue = getTasksQueue();
  const counts = await queue.getJobCounts("waiting", "prioritized", "active", "delayed", "completed", "failed");
  const heartbeat = await getRedis().get(WORKER_HEARTBEAT_KEY);
  return {
    waiting: (counts.waiting ?? 0) + (counts.prioritized ?? 0),
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    workerOnline: heartbeat !== null,
    workerLastSeen: heartbeat,
  };
}

/** State of a task run job in BullMQ, or null if it no longer exists. */
export async function getTaskRunState(taskId: string, runNumber: number) {
  const job = await getTasksQueue().getJob(taskRunJobId(taskId, runNumber));
  return job ? job.getState() : null;
}
