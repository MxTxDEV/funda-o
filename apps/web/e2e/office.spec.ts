import { expect, test } from "@playwright/test";

const suffix = Date.now().toString(36);

test.describe.configure({ mode: "serial" });

test("virtual office: navigation, 3D canvas and indicators from the database", async ({ page, request }) => {
  // Make sure at least one department and employee exist.
  await page.goto("/departments");
  await page.getByLabel("Nome").fill(`Tráfego Office ${suffix}`);
  await page.getByRole("button", { name: "Criar departamento" }).click();
  await page.getByRole("link", { name: "Adicionar funcionário" }).click();
  await expect(page).toHaveURL(/\/agents\/new/);
  await page.getByLabel("Nome").fill(`Office ${suffix}`);
  await page.getByLabel("Cargo").fill("Gestor de Tráfego");
  await page.getByLabel("Especialidade").fill("Meta Ads");
  await page.getByLabel("Instruções").fill("Planeje campanhas sem publicar nada.");
  await page.getByRole("button", { name: "Cadastrar funcionário" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Office ${suffix}`);

  await page.getByRole("link", { name: "Escritório Virtual" }).first().click();
  await expect(page).toHaveURL(/\/office$/);
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });

  const api = (await (await request.get("/api/v1/office")).json()).data;
  await expect(page.locator('[data-metric="Funcionários"]')).toHaveText(String(api.metrics.agents));
  await expect(page.locator('[data-metric="Departamentos"]')).toHaveText(String(api.metrics.departments));
  await expect(page.locator('[data-metric="Tarefas ativas"]')).toHaveText(String(api.metrics.activeTasks));
});

test("virtual office: employee selection, panel with real data and conversation", async ({ page }) => {
  await page.goto("/office");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: new RegExp(`Office ${suffix}`) }).first().click();
  const panel = page.getByTestId("office-panel");
  await expect(panel).toContainText(`Office ${suffix}`);
  await expect(panel).toContainText("Gestor de Tráfego");
  await expect(page.getByTestId("office-agent-status")).toHaveText("Disponível");
  await expect(panel.getByRole("link", { name: "Ver perfil" })).toHaveAttribute("href", /\/agents\/[0-9a-f-]{36}$/);

  await panel.getByRole("button", { name: "Abrir conversa" }).click();
  await expect(page).toHaveURL(/\/conversations\/[0-9a-f-]{36}$/);
  const first = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Office ${suffix}`);

  // Opening again reuses the same conversation.
  await page.goto("/office");
  await page.getByRole("button", { name: new RegExp(`Office ${suffix}`) }).first().click();
  await page.getByTestId("office-panel").getByRole("button", { name: "Abrir conversa" }).click();
  await expect(page).toHaveURL(first);
});

test("virtual office: environments, Central Brain and department panels", async ({ page }) => {
  await page.goto("/office");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Ir para ambiente").selectOption({ label: "Central Brain" });
  await expect(page.getByTestId("office-panel")).toContainText("Central Brain");
  await expect(page.getByTestId("office-panel")).toContainText("ainda não está integrado");

  await page.getByLabel("Ir para ambiente").selectOption({ label: "Sala de Lazer" });
  await expect(page.getByTestId("office-panel")).toContainText("Sala de Lazer");

  await page.getByLabel("Ir para ambiente").selectOption({ label: "Diretoria" });
  await expect(page.getByTestId("office-panel").getByRole("link", { name: "Abrir aprovações pendentes" })).toBeVisible();

  // Any department room from the picker opens a department/room panel.
  const option = page.getByLabel("Ir para ambiente").locator("optgroup[label=Departamentos] option").first();
  await page.getByLabel("Ir para ambiente").selectOption({ label: (await option.textContent())!.trim() });
  await expect(page.getByTestId("office-panel")).toBeVisible();

  // Camera controls are operable.
  for (const label of ["Aproximar", "Afastar", "Girar à esquerda", "Girar à direita", "Centralizar câmera", "Visão inicial"]) {
    await page.getByRole("button", { name: label }).click();
  }
  await page.getByLabel("Fechar painel").click();
  await expect(page.getByTestId("office-panel")).toHaveCount(0);
});

test("virtual office: 2D fallback when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: (type: string, ...args: unknown[]) => unknown };
    const original = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type.startsWith("webgl") ? null : original.call(this, type, ...args);
    };
  });
  await page.goto("/office");
  await expect(page.getByText("Seu navegador não suporta WebGL")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});
