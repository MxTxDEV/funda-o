import { getDb } from "@vc/db";
import { getRedis } from "@vc/queue";
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
  const [database, redis] = await Promise.all([check(() => getDb().execute(sql`select 1`)), check(() => getRedis().ping())]);
  const ok = database === "up" && redis === "up";
  return Response.json({ status: ok ? "ok" : "degraded", database, redis }, { status: ok ? 200 : 503 });
}
