/**
 * Client-safe AI catalog: provider identifiers, labels and the per-agent AI configuration schema.
 * No secrets and no network code live here — this module may be imported by browser bundles.
 *
 * Model identifiers are NOT hard-coded: the list of valid models is fetched from each provider's
 * own "list models" endpoint (see provider implementations) and stored with the connection check.
 */
import { z } from "zod";

export const AI_PROVIDER_IDS = ["anthropic", "openai"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export const AI_PROVIDER_INFO: Record<AiProviderId, { label: string; credentialEnv: string; baseUrlEnv: string; docsUrl: string }> = {
  anthropic: {
    label: "Anthropic",
    credentialEnv: "ANTHROPIC_API_KEY",
    baseUrlEnv: "VC_ANTHROPIC_BASE_URL",
    docsUrl: "https://docs.anthropic.com/en/api/getting-started",
  },
  openai: {
    label: "OpenAI",
    credentialEnv: "OPENAI_API_KEY",
    baseUrlEnv: "VC_OPENAI_BASE_URL",
    docsUrl: "https://platform.openai.com/docs/api-reference",
  },
};

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === "string" && (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

export const DEFAULT_MAX_OUTPUT_TOKENS = 2048;

/**
 * Execution settings stored in `agent_versions.config` (versioned with the instructions, so a run
 * always uses the exact configuration of the version it was dispatched with).
 */
export const agentAiConfigSchema = z.object({
  /** Sampling temperature. Omitted = provider default (some models do not accept it). */
  temperature: z.number().min(0).max(2).optional(),
  /** Maximum tokens the model may generate in one execution. */
  maxOutputTokens: z.number().int().min(16).max(64_000).default(DEFAULT_MAX_OUTPUT_TOKENS),
  /** Daily token budget for this employee (input + output). Omitted = no per-agent limit. */
  dailyTokenLimit: z.number().int().min(1).max(100_000_000).optional(),
  /** Daily cost budget for this employee in USD. Requires configured pricing for the model. */
  dailyCostLimitUsd: z.number().min(0).max(100_000).optional(),
});
export type AgentAiConfig = z.infer<typeof agentAiConfigSchema>;

/** Parses a stored config leniently: invalid or legacy values fall back to defaults. */
export function readAgentAiConfig(raw: unknown): AgentAiConfig {
  const parsed = agentAiConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : agentAiConfigSchema.parse({});
}

/**
 * Operational AI status of an employee:
 * - not_configured: no provider/model on the current version;
 * - missing_credentials: configured, but the provider has no API key in the backend;
 * - provider_error: the last connection check of the provider failed;
 * - ready: configured and the backend holds a credential for the provider.
 */
export type AiConnection = "not_configured" | "missing_credentials" | "provider_error" | "ready";

export const AI_CONNECTION_LABELS: Record<AiConnection, string> = {
  not_configured: "IA não configurada",
  missing_credentials: "Modelo configurado — credencial do provedor ausente no servidor",
  provider_error: "Falha na última verificação do provedor",
  ready: "Conectado — pronto para executar",
};

export type ProviderAvailability = Partial<Record<string, { configured: boolean; lastCheckOk?: boolean | null }>>;

export function aiConnectionOf(
  provider: string | null | undefined,
  model: string | null | undefined,
  availability: ProviderAvailability = {},
): AiConnection {
  if (!provider || !model) return "not_configured";
  const p = availability[provider];
  if (!p?.configured) return "missing_credentials";
  if (p.lastCheckOk === false) return "provider_error";
  return "ready";
}
