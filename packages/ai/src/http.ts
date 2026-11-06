import type { AiProviderId } from "./catalog";
import { kindFromStatus, ProviderError, redactSecrets } from "./errors";
import type { FetchLike } from "./types";

export const DEFAULT_TIMEOUT_MS = 120_000;

function combineSignals(timeoutMs: number, external?: AbortSignal) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return external ? AbortSignal.any([timeout, external]) : timeout;
}

/** Extracts the provider's error message from a JSON error body (both providers use `error.message`). */
function errorDetail(body: unknown): string {
  if (body && typeof body === "object") {
    const err = (body as { error?: unknown }).error;
    if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    if (typeof err === "string") return err;
  }
  return "";
}

/**
 * JSON request with timeout, cancellation and normalized errors.
 * Headers (which carry the credential) are never included in errors or logs.
 */
export async function requestJson(
  provider: AiProviderId,
  fetchImpl: FetchLike,
  url: string,
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: unknown; signal?: AbortSignal; timeoutMs?: number },
  requestIdHeader: string,
): Promise<{ body: unknown; requestId: string | null }> {
  const signal = combineSignals(init.timeoutMs ?? DEFAULT_TIMEOUT_MS, init.signal);
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: init.method,
      headers: { "content-type": "application/json", ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal,
    });
  } catch (err) {
    if (init.signal?.aborted) throw new ProviderError(provider, "aborted");
    if (signal.aborted) throw new ProviderError(provider, "timeout");
    throw new ProviderError(provider, "network", redactSecrets(err instanceof Error ? err.message : String(err)));
  }
  const requestId = res.headers.get(requestIdHeader);
  let body: unknown = null;
  try {
    const text = await res.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    if (init.signal?.aborted) throw new ProviderError(provider, "aborted", "", res.status, requestId);
    if (res.ok) throw new ProviderError(provider, "invalid_response", "corpo não é JSON", res.status, requestId);
  }
  if (!res.ok) {
    throw new ProviderError(provider, kindFromStatus(res.status), redactSecrets(errorDetail(body)), res.status, requestId);
  }
  return { body, requestId };
}

export function trimBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}
