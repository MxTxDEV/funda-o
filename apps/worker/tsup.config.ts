import { defineConfig } from "tsup";

// Bundles the worker and the workspace packages it uses into dist/ (npm dependencies stay external).
export default defineConfig({
  entry: { index: "src/index.ts", migrate: "../../packages/db/src/migrate.ts" },
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: [/^@vc\//],
});
