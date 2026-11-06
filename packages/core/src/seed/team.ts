/**
 * Registers the initial 11-employee team (idempotent; never overwrites existing records).
 *   pnpm db:seed:team
 */
import { closeDb, getDb } from "@vc/db";
import { closeRedis, closeTasksQueue } from "@vc/queue";
import { SYSTEM_ACTOR } from "../auth/permissions";
import { seedInitialTeam } from "../services/team";

try {
  const r = await seedInitialTeam({ db: getDb(), actor: SYSTEM_ACTOR });
  console.log("[seed:team]", JSON.stringify(r));
} catch (err) {
  console.error("[seed:team] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await closeTasksQueue();
  await closeRedis();
  await closeDb();
}
