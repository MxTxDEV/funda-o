/**
 * Bootstrap of the administrative account (production-safe, no fictitious data).
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_NAME=...] pnpm db:seed:admin
 * Running it again resets the password and re-activates the account.
 */
import { closeDb, getDb } from "@vc/db";
import { upsertUser } from "../services/users";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME ?? "Proprietário";

if (!email || !password) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  process.exit(1);
}

try {
  const { user, created } = await upsertUser(getDb(), { email, password, name, role: "owner" });
  console.log(`[seed:admin] ${created ? "created" : "updated"} owner account ${user.email}`);
} catch (err) {
  console.error("[seed:admin] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await closeDb();
}
