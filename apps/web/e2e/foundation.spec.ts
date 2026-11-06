import { expect, test } from "@playwright/test";

const suffix = Date.now().toString(36);

test.describe.configure({ mode: "serial" });

test.describe("anonymous", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

test("unauthenticated users are redirected and the API answers 401", async ({ page, request }) => {
  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/login/);
  const res = await request.get("/api/v1/tasks");
  expect(res.status()).toBe(401);
});

test("invalid credentials are rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("nobody@example.com");
  await page.getByLabel("Senha").fill("wrong-password");
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: /inválidos|tentativas/ })).toBeVisible();
});
});

test("full foundation flow: department → agent → task → worker → approval → completed", async ({ page }) => {
  await page.goto("/");

  // Department
  await page.goto("/departments");
  await page.getByLabel("Nome").fill(`E2E Dept ${suffix}`);
  await page.getByLabel("Descrição").fill("Criado pelo teste end-to-end");
  await page.getByRole("button", { name: "Criar departamento" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`E2E Dept ${suffix}`);

  // Agent
  await page.getByRole("link", { name: "Adicionar funcionário" }).click();
  await expect(page).toHaveURL(/\/agents\/new/);
  await page.getByLabel("Nome").fill(`Agente ${suffix}`);
  await page.getByLabel("Cargo").fill("Copywriter");
  await page.getByLabel("Especialidade", { exact: true }).fill("Copy de resposta direta");
  await page.getByLabel("Instruções").fill("Escreva textos claros e persuasivos para anúncios.");
  await page.getByText("Copywriting", { exact: true }).click();
  await page.getByRole("button", { name: "Cadastrar funcionário" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Agente ${suffix}`);
  await expect(page.getByText("Versão ativa v1")).toBeVisible();

  // New version
  await page.getByLabel("Nota da alteração").fill("Foco em e-mails");
  await page.getByRole("button", { name: "Criar versão" }).click();
  await expect(page.getByText("Versão 2 criada e ativada.")).toBeVisible();

  // Task with approval, dispatched immediately
  await page.goto("/tasks/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nova tarefa");
  await page.getByLabel("Título").fill(`Tarefa E2E ${suffix}`);
  await page.getByLabel("Responsável", { exact: true }).selectOption({ label: `Agente ${suffix} · Copywriter` });
  await page.getByLabel("Tipo").selectOption("demo.lifecycle");
  await page.getByLabel("Etapas simuladas").fill("2");
  await page.getByText("Exigir minha aprovação do resultado").click();
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Tarefa E2E ${suffix}`);

  // The worker processes it until it waits for approval (page auto-refreshes).
  await expect(page.locator("[data-status=waiting_approval]").first()).toBeVisible({ timeout: 45_000 });

  // Approve
  await page.getByRole("link", { name: /Aprovar resultado \(demo\)/ }).click();
  await expect(page).toHaveURL(/\/approvals\//);
  await page.getByLabel("Observação (opcional)").fill("Aprovado no teste E2E");
  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByText("Aprovada", { exact: true }).first()).toBeVisible();

  // Worker finishes the task in a new run.
  await page.getByRole("link", { name: `Tarefa E2E ${suffix}` }).click();
  await expect(page).toHaveURL(/\/tasks\//);
  await expect(page.locator("[data-status=completed]").first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("DEMONSTRAÇÃO: nenhum motor de IA foi executado", { exact: false })).toBeVisible();

  // Dashboard reflects real data and the audit log recorded the operations.
  await page.goto("/");
  await expect(page.getByText("Escritório", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`Agente ${suffix}`) }).first()).toBeVisible();
  await page.goto(`/audit?action=approval.`);
  await expect(page.getByText("approval.approve").first()).toBeVisible();
});

test("cancelling a pending task", async ({ page }) => {
  await page.goto("/");
  await page.goto("/tasks/new");
  await page.getByLabel("Título").fill(`Cancelar ${suffix}`);
  await page.getByText("Enviar imediatamente para a fila").click(); // uncheck
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.locator("[data-status=pending]").first()).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator("[data-status=cancelled]").first()).toBeVisible();
});

test("conversations store messages without simulated replies", async ({ page }) => {
  await page.goto("/");
  await page.goto("/conversations");
  await page.getByLabel("Tipo").selectOption("general");
  await page.getByLabel("Título (opcional)").fill(`Geral ${suffix}`);
  await page.getByRole("button", { name: "Criar conversa" }).click();
  await expect(page).toHaveURL(/\/conversations\/[0-9a-f-]{36}/);
  await page.getByLabel("Mensagem").fill("Bom dia, equipe!");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Bom dia, equipe!")).toBeVisible();
  await expect(page.getByText("Nenhuma resposta é simulada.", { exact: false })).toBeVisible();
});

test("REST API: authenticated reads, idempotent creation and cross-origin protection", async ({ request }) => {
  const dash = await request.get("/api/v1/dashboard");
  expect(dash.status()).toBe(200);
  expect((await dash.json()).data.tasks).toBeDefined();

  const key = `e2e-${suffix}-idem`;
  const body = { title: `API ${suffix}`, type: "demo.lifecycle" };
  const a = await request.post("/api/v1/tasks", { data: body, headers: { "Idempotency-Key": key } });
  const b = await request.post("/api/v1/tasks", { data: body, headers: { "Idempotency-Key": key } });
  expect(a.status()).toBe(201);
  expect((await a.json()).data.task.id).toBe((await b.json()).data.task.id);

  const invalid = await request.post("/api/v1/tasks", { data: { title: "x", type: "ads.publish" } });
  expect(invalid.status()).toBe(422);

  const crossSite = await request.post("/api/v1/departments", { data: { name: "Evil" }, headers: { Origin: "https://evil.example" } });
  expect(crossSite.status()).toBe(403);
});
