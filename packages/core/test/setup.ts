import { afterAll } from "vitest";

// Integration tests run against dedicated resources, never the development database.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://vc:vc_dev_password@localhost:5432/virtual_company_test";
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379/1";
process.env.QUEUE_PREFIX = "vc-test";
process.env.LOG_LEVEL ??= "error";

afterAll(async () => {
  const { closeDb } = await import("@vc/db");
  const { closeRedis, closeTasksQueue } = await import("@vc/queue");
  await closeTasksQueue();
  await closeRedis();
  await closeDb();
});
