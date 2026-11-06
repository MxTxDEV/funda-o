import type { AiProviderId } from "./catalog";

export type ProviderErrorKind =
  | "not_configured"
  | "auth"
  | "permission"
  | "not_found"
  | "invalid_request"
  | "rate_limit"
  | "overloaded"
  | "server"
  | "timeout"
  | "network"
  | "aborted"
  | "invalid_response";

const RETRYABLE: ReadonlySet<ProviderErrorKind> = new Set(["rate_limit", "overloaded", "server", "timeout", "network"]);

const KIND_LABELS: Record<ProviderErrorKind, string> = {
  not_configured: "credencial do provedor não configurada no servidor",
  auth: "credencial recusada pelo provedor",
  permission: "a credencial não tem permissão para este recurso",
  not_found: "modelo ou recurso não encontrado no provedor",
  invalid_request: "requisição recusada pelo provedor",
  rate_limit: "limite de requisições do provedor atingido",
  overloaded: "provedor sobrecarregado",
  server: "erro interno do provedor",
  timeout: "tempo limite excedido",
  network: "falha de rede ao contatar o provedor",
  aborted: "execução interrompida",
  invalid_response: "resposta inesperada do provedor",
};

/**
 * Normalized provider failure. The message never contains credentials or request headers:
 * only the provider's own error message (truncated) and the HTTP status.
 */
export class ProviderError extends Error {
  readonly provider: AiProviderId;
  readonly kind: ProviderErrorKind;
  readonly status: number | null;
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(provider: AiProviderId, kind: ProviderErrorKind, detail = "", status: number | null = null, requestId: string | null = null) {
    const base = `${provider}: ${KIND_LABELS[kind]}`;
    super(detail ? `${base} — ${detail.slice(0, 300)}` : base);
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
    this.status = status;
    this.retryable = RETRYABLE.has(kind);
    this.requestId = requestId;
  }
}

export function kindFromStatus(status: number): ProviderErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "not_found";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limit";
  if (status === 529 || status === 503) return "overloaded";
  if (status >= 500) return "server";
  return "invalid_request";
}

/** Removes anything that looks like an API key from a string before it is logged or stored. */
export function redactSecrets(text: string): string {
  return text.replace(/\b(sk-[A-Za-z0-9_-]{8,}|sk-ant-[A-Za-z0-9_-]{8,})/g, "[redacted]");
}
