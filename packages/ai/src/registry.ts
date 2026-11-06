import { AI_PROVIDER_IDS, AI_PROVIDER_INFO, type AiProviderId, isAiProviderId } from "./catalog";
import { ProviderError } from "./errors";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIProvider } from "./providers/openai";
import type { FetchLike, ModelProvider } from "./types";

type Env = Record<string, string | undefined>;

/**
 * Model Provider Registry. Credentials are read from the backend environment only (never from the
 * database or the browser). Adding a provider = implementing ModelProvider and registering it here.
 */
export type ProviderRegistry = {
  get(id: string): ModelProvider;
  list(): ModelProvider[];
  /** Which providers hold a credential (booleans only — never the value). */
  configured(): Record<AiProviderId, boolean>;
};

export function createProviderRegistry(opts: { env?: Env; fetch?: FetchLike } = {}): ProviderRegistry {
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
  const key = (id: AiProviderId) => env[AI_PROVIDER_INFO[id].credentialEnv]?.trim() || undefined;
  const base = (id: AiProviderId) => env[AI_PROVIDER_INFO[id].baseUrlEnv]?.trim() || undefined;

  const providers: Record<AiProviderId, ModelProvider> = {
    anthropic: new AnthropicProvider(key("anthropic"), fetchImpl, base("anthropic")),
    openai: new OpenAIProvider(key("openai"), fetchImpl, base("openai")),
  };
  return {
    get(id) {
      if (!isAiProviderId(id)) throw new ProviderError("anthropic", "invalid_request", `provedor desconhecido: ${String(id).slice(0, 40)}`);
      return providers[id];
    },
    list: () => AI_PROVIDER_IDS.map((id) => providers[id]),
    configured: () => Object.fromEntries(AI_PROVIDER_IDS.map((id) => [id, providers[id].isConfigured()])) as Record<AiProviderId, boolean>,
  };
}

const globalForAi = globalThis as unknown as { __vcProviderRegistry?: ProviderRegistry };

export function getProviderRegistry(): ProviderRegistry {
  globalForAi.__vcProviderRegistry ??= createProviderRegistry();
  return globalForAi.__vcProviderRegistry;
}

/** Test hook: replaces the process-wide registry (pass undefined to reset). */
export function setProviderRegistry(registry: ProviderRegistry | undefined) {
  globalForAi.__vcProviderRegistry = registry;
}
