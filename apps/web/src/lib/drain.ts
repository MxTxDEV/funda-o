import "server-only";
import { logger } from "@vc/core";
import { getDb } from "@vc/db";
import { drainQueue } from "@vc/engine";
import { after } from "next/server";

/** Time budget of one drain, below the function's maxDuration (300 s). */
const DRAIN_BUDGET_MS = 240_000;

export function isServerlessExecution() {
  return process.env.EXECUTION_MODE === "serverless";
}

/**
 * Serverless execution mode (no standalone worker): after the response is sent, process the task
 * queue inside this function until it is empty. A Redis lock ensures a single drainer at a time.
 * No-op when a dedicated worker is used (EXECUTION_MODE unset).
 */
export function scheduleDrain() {
  if (!isServerlessExecution()) return;
  after(async () => {
    try {
      const r = await drainQueue(getDb(), { budgetMs: DRAIN_BUDGET_MS });
      if (r.ran) logger.info("drain.done", { ms: r.processedFor });
    } catch (err) {
      logger.error("drain.failed", { err });
    }
  });
}
