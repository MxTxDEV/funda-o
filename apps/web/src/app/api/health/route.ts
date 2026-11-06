import { getDb } from "@vc/db";
import { getRedis, redisUrlFromEnv } from "@vc/queue";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Public liveness/readiness probe. Reports only up/down — no versions or internals. */
export async function GET() {
  const check = async (fn: () => Promise<unknown>) => {
    try {
      await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))]);
      return "up" as const;
    } catch {
      return "down" as const;
    }
  };
  const [database, redis] = await Promise.all([
    check(() => getDb().execute(sql`select 1`)),
    redisUrlFromEnv() ? check(() => getRedis().ping()) : Promise.resolve("not_configured" as const),
  ]);
  // Without Redis the app works (login, CRUD) but the task queue is unavailable.
  const status = database !== "up" ? "down" : redis === "up" ? "ok" : "degraded";
  return Response.json({ status, database, redis }, { status: database === "up" ? 200 : 503 });
}
