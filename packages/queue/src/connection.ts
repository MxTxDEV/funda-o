import { Redis, type RedisOptions } from "ioredis";

export type RedisRole = "queue" | "worker" | "general";

/**
 * Creates an ioredis connection. Workers require `maxRetriesPerRequest: null`
 * (blocking commands); producers and general clients fail fast instead.
 */
/** REDIS_URL, or KV_URL as injected by the Upstash for Redis integration on Vercel. */
export function redisUrlFromEnv(): string | undefined {
  return process.env.REDIS_URL || process.env.KV_URL || undefined;
}

export function createRedis(role: RedisRole = "general", url = redisUrlFromEnv()): Redis {
  if (!url) throw new Error("REDIS_URL (or KV_URL) is not configured");
  const options: RedisOptions = {
    maxRetriesPerRequest: role === "worker" ? null : 2,
    enableReadyCheck: role !== "queue",
    lazyConnect: false,
    connectTimeout: 5_000,
  };
  return new Redis(url, options);
}

const globalForRedis = globalThis as unknown as { __vcRedis?: Redis };

/** Shared connection for producers, rate limiting and metrics inside web processes. */
export function getRedis(): Redis {
  if (!globalForRedis.__vcRedis) {
    globalForRedis.__vcRedis = createRedis("queue");
  }
  return globalForRedis.__vcRedis;
}

export async function closeRedis() {
  if (globalForRedis.__vcRedis) {
    await globalForRedis.__vcRedis.quit().catch(() => undefined);
    globalForRedis.__vcRedis = undefined;
  }
}
