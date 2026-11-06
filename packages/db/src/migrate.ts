import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "./client";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL (or DATABASE_URL_UNPOOLED) is required");
  process.exit(1);
}

const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

const { db, client } = createDb({ url, max: 1 });
try {
  await migrate(db, { migrationsFolder });
  console.log(`[migrate] migrations applied from ${migrationsFolder}`);
} catch (err) {
  console.error("[migrate] failed", err);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
