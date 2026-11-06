import "server-only";
import { enforceRateLimit, logger, RATE_LIMITS, type ServiceContext, toAppError } from "@vc/core";
import { randomUUID } from "node:crypto";
import type { ActionState } from "./action-state";
import { getServiceContext } from "./session";

export type ActionResult<T> = { ok: true; data: T } | Extract<ActionState, { ok: false }>;

/**
 * Runs a server action body with authentication, per-user rate limiting and safe error mapping.
 * Unexpected errors are logged with a reference id and never leak internals to the client.
 */
export async function runAction<T>(fn: (ctx: ServiceContext) => Promise<T>): Promise<ActionResult<T>> {
  const ctx = await getServiceContext();
  try {
    const userId = ctx.actor.type === "user" ? ctx.actor.userId : "internal";
    await enforceRateLimit(`mut:${userId}`, RATE_LIMITS.mutation.limit, RATE_LIMITS.mutation.window);
    return { ok: true, data: await fn(ctx) };
  } catch (err) {
    const appError = toAppError(err);
    if (appError) {
      const details = appError.details as { fieldErrors?: Record<string, string[]> } | undefined;
      return { ok: false, message: appError.message, fieldErrors: details?.fieldErrors };
    }
    const ref = randomUUID().slice(0, 8);
    logger.error("action.unexpected_error", { ref, err });
    return { ok: false, message: `Erro inesperado. Referência: ${ref}` };
  }
}
