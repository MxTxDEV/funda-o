import { createProviderRegistry, setProviderRegistry } from "@vc/ai";
import { auditLogs } from "@vc/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentVersion, getAiOverview, getModelOptions, getOfficeSnapshot, testProviderConnection } from "../../src";
import { ctxFor, db, makeAgent, resetState } from "../helpers";

const SECRET = "sk-ant-test-secret-0123456789";

beforeEach(async () => {
  await resetState();
  setProviderRegistry(
    createProviderRegistry({
      env: { ANTHROPIC_API_KEY: SECRET },
      fetch: async (url) =>
        url.includes("/v1/models")
          ? new Response(JSON.stringify({ data: [{ id: "model-a", display_name: "Model A" }, { id: "model-b" }], has_more: false }), { status: 200 })
          : new Response("{}", { status: 404 }),
    }),
  );
});
afterEach(() => setProviderRegistry(undefined));

describe("AI providers", () => {
  it("tests the connection, stores valid models and never exposes the credential", async () => {
    const ctx = await ctxFor("owner");
    const r = await testProviderConnection(ctx, "anthropic");
    expect(r.ok).toBe(true);
    expect(await getModelOptions(db())).toEqual({ anthropic: ["model-a", "model-b"] });

    const overview = await getAiOverview(ctx);
    const anthropic = overview.providers.find((p) => p.id === "anthropic")!;
    expect(anthropic).toMatchObject({ configured: true, credentialEnv: "ANTHROPIC_API_KEY", lastCheck: { ok: true } });
    expect(overview.providers.find((p) => p.id === "openai")!.configured).toBe(false);
    expect(JSON.stringify(overview)).not.toContain(SECRET);

    const audit = await db().select().from(auditLogs).where(eq(auditLogs.action, "ai.provider_check"));
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(SECRET);

    // A provider without credential reports a failed check.
    const o = await testProviderConnection(ctx, "openai");
    expect(o.ok).toBe(false);
    expect(o.message).toContain("credencial");
  });

  it("only accepts models listed by the provider and reflects the real status in the office", async () => {
    const ctx = await ctxFor("owner");
    const { agent } = await makeAgent(ctx);
    await testProviderConnection(ctx, "anthropic");
    await expect(
      createAgentVersion(ctx, agent.id, { instructions: "Instruções novas do agente.", aiProvider: "anthropic", aiModel: "modelo-inventado", changeNote: "Configura IA" }),
    ).rejects.toThrow(/não consta na lista/);
    await expect(
      createAgentVersion(ctx, agent.id, { instructions: "Instruções novas do agente.", aiProvider: "anthropic", changeNote: "Configura IA" }),
    ).rejects.toThrow();
    const v = await createAgentVersion(ctx, agent.id, {
      instructions: "Instruções novas do agente.",
      aiProvider: "anthropic",
      aiModel: "model-a",
      aiSettings: { temperature: "0.4", maxOutputTokens: "1500", dailyTokenLimit: "" } as never,
      changeNote: "Configura IA",
    });
    expect(v.config).toEqual({ temperature: 0.4, maxOutputTokens: 1500 });
    const office = await getOfficeSnapshot(ctx);
    const a = office.agents.find((x) => x.id === agent.id)!;
    expect(a.aiConnection).toBe("ready");
    expect(a.activeRun).toBeNull();
  });
});
