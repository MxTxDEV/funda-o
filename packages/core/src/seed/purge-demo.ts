import { closeAll, getDb, purgeDemo } from "./demo-data";

try {
  const summary = await purgeDemo(getDb());
  console.log("[demo:purge] removed demo data", summary);
} catch (err) {
  console.error("[demo:purge] failed", err);
  process.exitCode = 1;
} finally {
  await closeAll();
}
