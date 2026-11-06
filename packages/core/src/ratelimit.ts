import { getDb, rateLimits } from "@vc/db";
import { getRedis, redisUrlFromEnv } from "@vc/queue";
import { sql } from "drizzle-orm";
import { AppError } from "./errors";

export type RateLimitResult = { allowed: boolean; remaining: number; resetInSeconds: number };

async function redisCounter(key: string, windowSeconds: number) {
  const redisKey = `vc:rl:${key}`;
  const res = await getRedis().multi().incr(redisKey).expire(redisKey, windowSeconds, "NX").ttl(redisKey).exec();
  if (!res) throw new Error("empty redis transaction result");
  return { count: Number(res[0]?.[1] ?? 0), ttl: Number(res[2]?.[1] ?? windowSeconds) };
}

/** Atomic fixed window in Postgres (used when Redis is not configured, e.g. a web-only deploy). */
async function postgresCounter(key: string, windowSeconds: number) {
  const window = sql`make_interval(secs => ${windowSeconds})`;
  const [row] = await getDb()
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: sql`now() + ${window}` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} <= now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= now() THEN now() + ${window} ELSE ${rateLimits.resetAt} END`,
      },
    })
    .returning({ count: rateLimits.count, ttl: sql<number>`ceil(extract(epoch from ${rateLimits.resetAt} - now()))::int` });
  // A statement that waited on the row lock may compute a slightly larger TTL: clamp to the window.
  return { count: row?.count ?? 0, ttl: Math.min(Number(row?.ttl ?? windowSeconds), windowSeconds) };
}

/**
 * Fixed window counter (Redis when configured, otherwise Postgres).
 * Fails closed: if the backing store is unavailable the request is refused.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  let count: number;
  let ttl: number;
  try {
    ({ count, ttl } = redisUrlFromEnv() ? await redisCounter(key, windowSeconds) : await postgresCounter(key, windowSeconds));
  } catch {
    throw new AppError("UNAVAILABLE", "Serviço temporariamente indisponível. Tente novamente em instantes.");
  }
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetInSeconds: ttl > 0 ? ttl : windowSeconds };
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const r = await rateLimit(key, limit, windowSeconds);
  if (!r.allowed) {
    throw new AppError("RATE_LIMITED", `Muitas requisições. Tente novamente em ${r.resetInSeconds}s.`, {
      retryAfter: r.resetInSeconds,
    });
  }
  return r;
}

export const RATE_LIMITS = {
  login: { limit: 10, window: 15 * 60 },
  mutation: { limit: 120, window: 60 },
  read: { limit: 600, window: 60 },
} as const;
