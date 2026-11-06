import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running stack (web + worker + Postgres + Redis).
 * Locally: `pnpm build` then `pnpm test:e2e` — the web server and worker are started automatically
 * (reused if already running). Requires ADMIN_EMAIL / ADMIN_PASSWORD of a seeded owner account.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: "e2e/.auth/admin.json" },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        { command: "pnpm start", url: `${baseURL}/api/health`, reuseExistingServer: true, timeout: 120_000 },
        {
          // The worker exposes its own liveness endpoint so Playwright knows it is really running.
          command: "pnpm --filter @vc/worker dev",
          env: { WORKER_HEALTH_PORT: "8081" },
          url: "http://127.0.0.1:8081/",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});
