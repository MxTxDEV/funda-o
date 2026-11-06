import type { AiProviderId } from "./catalog";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  temperature?: number;
  /** Aborts the HTTP request (task cancelled). */
  signal?: AbortSignal;
  /** Hard timeout for the request in ms. */
  timeoutMs?: number;
};

export type TokenUsage = { inputTokens: number; outputTokens: number };

export type ChatResult = {
  text: string;
  /** Normalized stop reason: "end" | "max_tokens" | other provider value. */
  finishReason: string;
  /** Null when the provider did not report usage. */
  usage: TokenUsage | null;
  /** Model identifier reported by the provider. */
  model: string;
  /** Provider request id, useful for support tickets (never a secret). */
  requestId: string | null;
};

export type ModelInfo = { id: string; displayName: string | null; createdAt: string | null };

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ModelProvider {
  readonly id: AiProviderId;
  readonly label: string;
  /** True when the backend holds a credential for this provider. Never exposes the value. */
  isConfigured(): boolean;
  /** Valid model identifiers, as reported by the provider itself. */
  listModels(opts?: { signal?: AbortSignal; timeoutMs?: number }): Promise<ModelInfo[]>;
  chat(req: ChatRequest): Promise<ChatResult>;
}
