import { expect, test } from "@playwright/test";

/**
 * Vertical slice of the Agent Runtime: provider check → employee configured with a model →
 * AI task → worker calls the provider over HTTP → usage recorded → result in the UI and office.
 * Runs against the mock provider (e2e/mock-ai-server.mjs) when E2E_MOCK_AI=1.
 */
test.skip(!process.env.E2E_MOCK_AI, "requires the mock AI provider (E2E_MOCK_AI=1)");

test("AI task executed by an employee with a configured model", async ({ page, request }) => {
  const suffix = Date.now().toString(36);

  await page.goto("/ai");
  const card = page.locator("div", { has: page.getByRole("heading", { name: "Anthropic" }) }).first();
  await expect(page.getByText("Credencial configurada").first()).toBeVisible();
  await page.getByRole("button", { name: "Verificar conexão e atualizar modelos" }).first().click();
  await expect(page.getByText("Conexão verificada: 2 modelo(s) disponível(is).")).toBeVisible();
  await expect(card).toBeVisible();

  // Department + employee with AI configuration
  await page.goto("/departments");
  await page.getByLabel("Nome").fill(`Pesquisa ${suffix}`);
  await page.getByRole("button", { name: /Criar departamento/ }).click();
  await expect(page.getByText(`Pesquisa ${suffix}`).first()).toBeVisible();

  await page.goto("/agents/new");
  await page.getByLabel("Departamento").selectOption({ label: `Pesquisa ${suffix}` });
  await page.getByLabel("Nome").fill(`Sophia ${suffix}`);
  await page.getByLabel("Cargo").fill("Pesquisadora");
  await page.getByLabel("Especialidade", { exact: true }).fill("Pesquisa de mercado");
  await page.getByLabel("Instruções").fill("Pesquise mercado e público com rigor, separando fatos e hipóteses.");
  await page.getByLabel("Provedor de IA").selectOption("anthropic");
  await page.getByLabel("Modelo").fill("mock-model-1");
  await page.getByRole("button", { name: "Cadastrar funcionário" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Sophia ${suffix}`);
  await expect(page.getByText("Conectado — pronto para executar")).toBeVisible();
  const agentId = page.url().split("/").pop()!;

  // AI task
  await page.goto("/tasks/new");
  await page.getByLabel("Título").fill(`Pesquisa E2E ${suffix}`);
  await page.getByLabel("Descrição").fill("Mapeie o mercado de cursos online.");
  await page.getByLabel("Responsável", { exact: true }).selectOption({ label: `Sophia ${suffix} · Pesquisadora` });
  await expect(page.getByLabel("Tipo")).toHaveValue("agent.execute");
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Pesquisa E2E ${suffix}`);

  // While the provider is answering, the office shows the employee really executing.
  await expect
    .poll(
      async () => {
        const snap = (await (await request.get("/api/v1/office")).json()).data;
        const a = snap.agents.find((x: { id: string }) => x.id === agentId);
        return a?.activeRun?.model ?? null;
      },
      { timeout: 30_000 },
    )
    .toBe("mock-model-1");

  await expect(page.getByTestId("ai-output")).toContainText(`Tarefa recebida: Pesquisa E2E ${suffix}`, { timeout: 45_000 });
  await expect(page.locator("[data-status=completed]").first()).toBeVisible();
  await expect(page.getByText("321 → 123").first()).toBeVisible();

  // Observability: run listed in the AI page and the API; the employee is idle again.
  const runs = (await (await request.get(`/api/v1/ai/runs?agentId=${agentId}`)).json()).data;
  expect(runs.items[0]).toMatchObject({ status: "succeeded", inputTokens: 321, outputTokens: 123, model: "mock-model-1" });
  const snap = (await (await request.get("/api/v1/office")).json()).data;
  expect(snap.agents.find((x: { id: string }) => x.id === agentId)).toMatchObject({ activeRun: null, aiConnection: "ready" });
  const ai = (await (await request.get("/api/v1/ai")).json()).data;
  expect(JSON.stringify(ai)).not.toContain("sk-ant-e2e-mock-key");
});

test("employee uses an authorized tool through the gateway", async ({ page }) => {
  const suffix = Date.now().toString(36);
  await page.goto("/departments");
  await page.getByLabel("Nome").fill(`Dados ${suffix}`);
  await page.getByRole("button", { name: /Criar departamento/ }).click();
  await expect(page.getByText(`Dados ${suffix}`).first()).toBeVisible();

  await page.goto("/agents/new");
  await page.getByLabel("Departamento").selectOption({ label: `Dados ${suffix}` });
  await page.getByLabel("Nome").fill(`Beatriz ${suffix}`);
  await page.getByLabel("Cargo").fill("Analista");
  await page.getByLabel("Especialidade", { exact: true }).fill("Métricas");
  await page.getByLabel("Instruções").fill("Calcule e interprete métricas usando somente dados verificáveis.");
  await page.getByText("Calcular métricas de marketing", { exact: true }).click();
  await page.getByLabel("Provedor de IA").selectOption("anthropic");
  await page.getByLabel("Modelo").fill("mock-model-1");
  await page.getByRole("button", { name: "Cadastrar funcionário" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Beatriz ${suffix}`);
  await expect(page.getByTestId("autonomy-card")).toContainText("Disponível");

  await page.goto("/tasks/new");
  await page.getByLabel("Título").fill(`Métricas ${suffix}`);
  await page.getByLabel("Responsável", { exact: true }).selectOption({ label: `Beatriz ${suffix} · Analista` });
  await page.getByRole("button", { name: "Criar tarefa" }).click();

  await expect(page.getByTestId("ai-output")).toContainText("Resultado com ferramenta", { timeout: 60_000 });
  await expect(page.getByTestId("ai-output")).toContainText("ROAS 3");
  await expect(page.getByRole("heading", { name: "Ferramentas utilizadas" })).toBeVisible();
  await expect(page.getByText("Métricas calculadas para 1 linha(s)")).toBeVisible();
  // tokens summed across both model calls
  await expect(page.getByText("500 → 100").first()).toBeVisible();

  await page.goto("/tools");
  await expect(page.getByTestId("tool-analytics.compute_metrics")).toContainText(`Beatriz ${suffix}`);
  await expect(page.getByTestId("tool-web.search")).toContainText("Requer configuração");
});
