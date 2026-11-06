/**
 * Creates the owner account ONLY if no user with ADMIN_EMAIL exists (never resets an existing
 * password). Safe to run on every production build:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @vc/core db:bootstrap:admin
 */
import { closeDb, getDb, users } from "@vc/db";
import { sql } from "drizzle-orm";
import { upsertUser } from "../services/users";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.log("[bootstrap:admin] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipped");
  process.exit(0);
}

try {
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
  if (existing) {
    console.log("[bootstrap:admin] owner account already exists — unchanged");
  } else {
    await upsertUser(db, { email, password, name: process.env.ADMIN_NAME ?? "Proprietário", role: "owner" });
    console.log("[bootstrap:admin] owner account created");
  }
} catch (err) {
  console.error("[bootstrap:admin] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await closeDb();
}
