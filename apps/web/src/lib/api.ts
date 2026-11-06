import "server-only";
import { AppError, enforceRateLimit, logger, RATE_LIMITS, type ServiceContext, toAppError } from "@vc/core";
import { getDb } from "@vc/db";
import { randomUUID } from "node:crypto";
import { getActor } from "./session";
import { clientIp } from "./request-meta";

type RouteContext<P> = { params: Promise<P> };

type Handler<P> = (ctx: ServiceContext, req: Request, params: P) => Promise<unknown>;

function errorResponse(err: unknown) {
  const appError = toAppError(err);
  if (appError) {
    const headers: Record<string, string> = {};
    const retryAfter = (appError.details as { retryAfter?: number } | undefined)?.retryAfter;
    if (retryAfter) headers["Retry-After"] = String(retryAfter);
    return Response.json(
      { error: { code: appError.code, message: appError.message, details: appError.details } },
      { status: appError.status, headers },
    );
  }
  const ref = randomUUID().slice(0, 8);
  logger.error("api.unexpected_error", { ref, err });
  return Response.json({ error: { code: "INTERNAL", message: "Erro interno.", ref } }, { status: 500 });
}

/** Rejects cross-site mutations (defense in depth on top of SameSite cookies). */
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) throw new AppError("FORBIDDEN", "Origem não permitida.");
}

/** Authenticated JSON route handler: session check, rate limit, origin check and error mapping. */
export function apiRoute<P = Record<string, never>>(handler: Handler<P>, opts: { mutation?: boolean; status?: number } = {}) {
  return async (req: Request, context: RouteContext<P>) => {
    try {
      if (opts.mutation) assertSameOrigin(req);
      const actor = await getActor();
      if (!actor) throw new AppError("UNAUTHORIZED", "Autenticação necessária.");
      const limit = opts.mutation ? RATE_LIMITS.mutation : RATE_LIMITS.read;
      await enforceRateLimit(`api:${opts.mutation ? "w" : "r"}:${actor.userId}`, limit.limit, limit.window);
      const ctx: ServiceContext = {
        db: getDb(),
        actor,
        meta: { ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") },
      };
      const data = await handler(ctx, req, await context.params);
      return Response.json({ data }, { status: opts.status ?? 200 });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 256 * 1024) throw new AppError("VALIDATION", "Corpo da requisição muito grande.");
  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("not an object");
    return body as Record<string, unknown>;
  } catch {
    throw new AppError("VALIDATION", "JSON inválido.");
  }
}

export function searchParamsObject(req: Request) {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}
