import type { AiProviderId } from "./catalog";

export type ChatBlock =
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolCallId: string; content: string; isError?: boolean };

export type ChatMessage = { role: "user" | "assistant"; content: string | ChatBlock[] };

/** A function the model may call. `name` must match ^[a-zA-Z0-9_-]{1,64}$ (both providers). */
export type ToolSpec = { name: string; description: string; inputSchema: Record<string, unknown> };

export type ToolCall = { id: string; name: string; input: Record<string, unknown> };

export type ChatRequest = {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  temperature?: number;
  /** Tools offered to the model in this call (omit for plain text generation). */
  tools?: ToolSpec[];
  /** Aborts the HTTP request (task cancelled). */
  signal?: AbortSignal;
  /** Hard timeout for the request in ms. */
  timeoutMs?: number;
};

export type TokenUsage = { inputTokens: number; outputTokens: number };

export type ChatResult = {
  text: string;
  /** Normalized stop reason: "end" | "max_tokens" | "tool_calls" | other provider value. */
  finishReason: string;
  /** Tool calls requested by the model (empty when none). */
  toolCalls: ToolCall[];
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
