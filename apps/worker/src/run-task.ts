import {
  beginTaskRun,
  completeTaskRun,
  failTaskRun,
  isRunAborted,
  logger,
  recordRunProgress,
  requestTaskApproval,
} from "@vc/core";
import type { Database } from "@vc/db";
import { taskRunJobSchema } from "@vc/queue";
import { UnrecoverableError } from "bullmq";
import { getProcessor } from "./processors";
import type { TaskProcessor } from "./processors/types";

/** Minimal view of a BullMQ job (keeps the function testable without Redis). */
export type JobLike = { id?: string; data: unknown; attemptsMade: number; opts: { attempts?: number } };

export type RunResult =
  | { status: "skipped" }
  | { status: "completed" | "waiting_approval" | "aborted" | "discarded" };

export async function processTaskJob(
  db: Database,
  job: JobLike,
  resolveProcessor: (type: string) => TaskProcessor | undefined = getProcessor,
): Promise<RunResult> {
  const parsed = taskRunJobSchema.safeParse(job.data);
  if (!parsed.success) throw new UnrecoverableError("Payload do job inválido");
  const ref = { taskId: parsed.data.taskId, runNumber: parsed.data.runNumber };

  const run = await beginTaskRun(db, ref);
  if (!run) {
    logger.info("task.run_skipped", { ...ref, jobId: job.id });
    return { status: "skipped" };
  }
  logger.info("task.run_started", { ...ref, type: run.task.type, attempt: run.task.attempts, resumed: run.resumed });

  try {
    const processor = resolveProcessor(run.task.type);
    if (!processor) throw new UnrecoverableError(`Tipo de tarefa sem processador: ${run.task.type}`);

    const outcome = await processor({
      ...run,
      attempt: run.task.attempts,
      progress: (message, data) => recordRunProgress(db, ref, message, data),
      isAborted: () => isRunAborted(db, ref),
    });

    if (outcome.kind === "aborted") {
      logger.info("task.run_aborted", ref);
      return { status: "aborted" };
    }
    if (outcome.kind === "needs_approval") {
      const r = await requestTaskApproval(db, ref, outcome.approval, outcome.partialResult);
      return { status: r === "applied" ? "waiting_approval" : "discarded" };
    }
    const r = await completeTaskRun(db, ref, outcome.result);
    logger.info("task.run_completed", { ...ref, outcome: r });
    return { status: r === "applied" ? "completed" : "discarded" };
  } catch (err) {
    const attemptsAllowed = job.opts.attempts ?? 1;
    const attempt = job.attemptsMade + 1;
    const permanent = err instanceof UnrecoverableError;
    const willRetry = !permanent && attempt < attemptsAllowed;
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    logger.warn("task.run_failed", { ...ref, attempt, willRetry, message });
    await failTaskRun(db, ref, { code: permanent ? "PERMANENT_ERROR" : "PROCESSOR_ERROR", message, attempt }, willRetry);
    throw err;
  }
}
