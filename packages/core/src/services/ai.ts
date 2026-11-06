/**
 * AI provider status (Model Provider Registry, backend side). Credentials live only in environment
 * variables: this module reports whether they exist, never their values.
 */
import { AI_PROVIDER_INFO, type AiProviderId, getProviderRegistry, isAiProviderId, type ProviderAvailability, ProviderError, readCompanyAiLimits, readPricing } from "@vc/ai";
import { aiProviderChecks, type DbExecutor } from "@vc/db";
import { eq } from "drizzle-orm";
import { writeAudit } from "../audit";
import { assertCan } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { AppError } from "../errors";

export async function getProviderAvailability(db: DbExecutor): Promise<ProviderAvailability> {
  const configured = getProviderRegistry().configured();
  const checks = await db.select({ provider: aiProviderChecks.provider, ok: aiProviderChecks.ok }).from(aiProviderChecks);
  const out: ProviderAvailability = {};
  for (const [id, isConfigured] of Object.entries(configured)) {
    out[id] = { configured: isConfigured, lastCheckOk: checks.find((c) => c.provider === id)?.ok ?? null };
  }
  return out;
}

export async function getAiOverview(ctx: ServiceContext) {
  assertCan(ctx.actor, "agents:read");
  const registry = getProviderRegistry();
  const configured = registry.configured();
  const checks = await ctx.db.select().from(aiProviderChecks);
  const pricing = readPricing();
  return {
    providers: registry.list().map((p) => {
      const check = checks.find((c) => c.provider === p.id) ?? null;
      return {
        id: p.id,
        label: p.label,
        credentialEnv: AI_PROVIDER_INFO[p.id].credentialEnv,
        docsUrl: AI_PROVIDER_INFO[p.id].docsUrl,
        configured: configured[p.id],
        customBaseUrl: !!process.env[AI_PROVIDER_INFO[p.id].baseUrlEnv]?.trim(),
        lastCheck: check,
      };
    }),
    limits: readCompanyAiLimits(),
    pricedModels: Object.keys(pricing).sort(),
  };
}

/** Models offered by each provider at its last successful check (used by the employee form). */
export async function getModelOptions(db: DbExecutor): Promise<Record<string, string[]>> {
  const rows = await db.select({ provider: aiProviderChecks.provider, ok: aiProviderChecks.ok, models: aiProviderChecks.models }).from(aiProviderChecks);
  return Object.fromEntries(rows.filter((r) => r.ok).map((r) => [r.provider, r.models.map((m) => m.id)]));
}

/**
 * Rejects a model that the provider did not list at its last successful check. When the provider
 * was never checked, the identifier is accepted and validated by the provider at execution time.
 */
export async function assertModelAvailable(db: DbExecutor, provider: string | null, model: string | null) {
  if (!provider || !model) return;
  if (!isAiProviderId(provider)) throw new AppError("VALIDATION", "Provedor de IA inválido.");
  const [check] = await db.select().from(aiProviderChecks).where(eq(aiProviderChecks.provider, provider));
  if (check?.ok && check.models.length > 0 && !check.models.some((m) => m.id === model)) {
    throw new AppError("VALIDATION", `O modelo "${model}" não consta na lista de modelos do provedor ${AI_PROVIDER_INFO[provider].label}. Atualize a lista em IA e provedores.`);
  }
}

/**
 * Connection test: calls the provider's list-models endpoint (no tokens consumed) and stores the
 * outcome and the valid model identifiers.
 */
export async function testProviderConnection(ctx: ServiceContext, providerId: string) {
  assertCan(ctx.actor, "agents:write");
  if (!isAiProviderId(providerId)) throw new AppError("VALIDATION", "Provedor de IA inválido.");
  const provider = getProviderRegistry().get(providerId);
  const started = Date.now();
  let ok = false;
  let message: string;
  let models: { id: string; displayName: string | null }[] = [];
  try {
    const list = await provider.listModels({ timeoutMs: 20_000 });
    models = list.map((m) => ({ id: m.id, displayName: m.displayName }));
    ok = true;
    message = `${models.length} modelo(s) disponível(is).`;
  } catch (err) {
    message = err instanceof ProviderError ? err.message : "Falha inesperada ao contatar o provedor.";
  }
  const latencyMs = Date.now() - started;
  const values = {
    provider: providerId as AiProviderId,
    ok,
    message,
    latencyMs,
    // A failed check keeps the previously known model list out of the picker.
    models,
    checkedAt: new Date(),
    checkedByUserId: ctx.actor.type === "user" ? ctx.actor.userId : null,
  };
  await ctx.db.transaction(async (tx) => {
    await tx.insert(aiProviderChecks).values(values).onConflictDoUpdate({ target: aiProviderChecks.provider, set: values });
    await writeAudit(
      tx,
      ctx.actor,
      { action: "ai.provider_check", entityType: "ai_provider", entityId: null, changes: { provider: providerId, ok, message, latencyMs, models: models.length } },
      ctx.meta,
    );
  });
  return { ok, message, latencyMs, models };
}

/** Data for the employee AI form: valid models per provider and which providers hold credentials. */
export async function getAiFormOptions(db: DbExecutor) {
  return { modelOptions: await getModelOptions(db), configured: getProviderRegistry().configured() as Record<string, boolean> };
}
