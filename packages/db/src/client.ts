import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
/** A transaction handle or the root database: services accept either. */
export type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export type CreateDbOptions = {
  url: string;
  /** Pool size. Keep small (1-3) on serverless platforms. */
  max?: number;
  /** Disable prepared statements when connecting through a transaction pooler (PgBouncer / Neon pooled). */
  prepare?: boolean;
};

export function createDb({ url, max = 10, prepare = true }: CreateDbOptions) {
  const client = postgres(url, { max, prepare, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" });
  return { db, client };
}

const globalForDb = globalThis as unknown as { __vcDb?: ReturnType<typeof createDb> };

/** Process-wide database singleton configured from the environment. */
export function getDb(): Database {
  if (!globalForDb.__vcDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    globalForDb.__vcDb = createDb({
      url,
      max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : 10,
      prepare: process.env.DB_PREPARE !== "false",
    });
  }
  return globalForDb.__vcDb.db;
}

export async function closeDb() {
  if (globalForDb.__vcDb) {
    await globalForDb.__vcDb.client.end({ timeout: 5 });
    globalForDb.__vcDb = undefined;
  }
}
