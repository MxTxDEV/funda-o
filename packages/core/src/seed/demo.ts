import { closeAll, getDb, seedDemo } from "./demo-data";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
  console.error("[seed:demo] refused in production. Set ALLOW_DEMO_SEED=true to override explicitly.");
  process.exit(1);
}

try {
  const result = await seedDemo(getDb());
  console.log(result.skipped ? "[seed:demo] demo data already present — skipped" : `[seed:demo] created demo data (${result.agents} agents)`);
} catch (err) {
  console.error("[seed:demo] failed", err);
  process.exitCode = 1;
} finally {
  await closeAll();
}
