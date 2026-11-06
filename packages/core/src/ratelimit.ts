import { getRedis } from "@vc/queue";
import { AppError } from "./errors";

export type RateLimitResult = { allowed: boolean; remaining: number; resetInSeconds: number };

/** Fixed window counter in Redis. Fails closed: if Redis is unavailable the request is refused. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const redisKey = `vc:rl:${key}`;
  let count: number;
  let ttl: number;
  try {
    const res = await getRedis()
      .multi()
      .incr(redisKey)
      .expire(redisKey, windowSeconds, "NX")
      .ttl(redisKey)
      .exec();
    if (!res) throw new Error("empty redis transaction result");
    count = Number(res[0]?.[1] ?? 0);
    ttl = Number(res[2]?.[1] ?? windowSeconds);
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
