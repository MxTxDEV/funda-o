import { expect, test as setup } from "@playwright/test";

export const STORAGE_STATE = "e2e/.auth/admin.json";

// Logs in once and shares the session with the other tests (keeps us under the login rate limit).
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL / ADMIN_PASSWORD (or E2E_ADMIN_*) for the e2e tests");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.context().storageState({ path: STORAGE_STATE });
});
