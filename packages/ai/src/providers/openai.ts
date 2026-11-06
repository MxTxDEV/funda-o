import { ProviderError } from "../errors";
import { requestJson, trimBaseUrl } from "../http";
import type { ChatMessage, ChatRequest, ChatResult, FetchLike, ModelInfo, ModelProvider } from "../types";

type CompletionResponse = {
  model?: string;
  choices?: {
    message?: { content?: string | null; refusal?: string | null; tool_calls?: { id: string; type: string; function?: { name: string; arguments: string } }[] };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};
type ModelsList = { data?: { id: string; created?: number }[] };

/**
 * Families returned by /v1/models that cannot answer a chat completion (embeddings, speech, images…).
 * They are hidden from the model picker; everything else is shown exactly as the provider lists it.
 */
const NON_CHAT = /(embedding|tts|whisper|dall-e|moderation|transcribe|realtime|audio|image|sora|davinci|babbage|search)/i;

export function toOpenAIMessages(messages: ChatMessage[]) {
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
      const calls = m.content.filter((b) => b.type === "tool_call");
      out.push({
        role: "assistant",
        content: text || null,
        ...(calls.length
          ? { tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input) } })) }
          : {}),
      });
      continue;
    }
    const text = m.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    for (const b of m.content) if (b.type === "tool_result") out.push({ role: "tool", tool_call_id: b.toolCallId, content: b.isError ? `ERRO: ${b.content}` : b.content });
    if (text) out.push({ role: "user", content: text });
  }
  return out;
}

/** OpenAI Chat Completions API (https://platform.openai.com/docs/api-reference/chat). */
export class OpenAIProvider implements ModelProvider {
  readonly id = "openai" as const;
  readonly label = "OpenAI";

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = "https://api.openai.com",
  ) {}

  isConfigured() {
    return !!this.apiKey;
  }

  private headers() {
    if (!this.apiKey) throw new ProviderError(this.id, "not_configured");
    return { authorization: `Bearer ${this.apiKey}` };
  }

  async listModels(opts: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<ModelInfo[]> {
    const { body } = await requestJson(
      this.id,
      this.fetchImpl,
      `${trimBaseUrl(this.baseUrl)}/v1/models`,
      { method: "GET", headers: this.headers(), signal: opts.signal, timeoutMs: opts.timeoutMs ?? 20_000 },
      "x-request-id",
    );
    const data = body as ModelsList;
    if (!Array.isArray(data?.data)) throw new ProviderError(this.id, "invalid_response", "lista de modelos ausente");
    return data.data
      .filter((m) => !NON_CHAT.test(m.id))
      .map((m) => ({ id: m.id, displayName: null, createdAt: m.created ? new Date(m.created * 1000).toISOString() : null }))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const { body, requestId } = await requestJson(
      this.id,
      this.fetchImpl,
      `${trimBaseUrl(this.baseUrl)}/v1/chat/completions`,
      {
        method: "POST",
        headers: this.headers(),
        body: {
          model: req.model,
          messages: [{ role: "system", content: req.system }, ...toOpenAIMessages(req.messages)],
          ...(req.tools?.length
            ? { tools: req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } })) }
            : {}),
          max_completion_tokens: req.maxOutputTokens,
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        },
        signal: req.signal,
        timeoutMs: req.timeoutMs,
      },
      "x-request-id",
    );
    const data = body as CompletionResponse;
    const choice = data?.choices?.[0];
    if (!choice?.message) throw new ProviderError(this.id, "invalid_response", "resposta sem mensagem", null, requestId);
    const refusal = choice.message.refusal;
    const text = choice.message.content ?? (refusal ? `[recusa do modelo] ${refusal}` : "");
    const u = data.usage;
    const usage =
      u && typeof u.prompt_tokens === "number" && typeof u.completion_tokens === "number"
        ? { inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens }
        : null;
    const toolCalls = (choice.message.tool_calls ?? [])
      .filter((c) => c.type === "function" && c.function)
      .map((c) => {
        let input: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(c.function!.arguments || "{}");
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) input = parsed;
        } catch {
          input = { __invalid_json: c.function!.arguments.slice(0, 200) };
        }
        return { id: c.id, name: c.function!.name, input };
      });
    const stop = choice.finish_reason ?? "unknown";
    return {
      text,
      toolCalls,
      finishReason: stop === "stop" ? "end" : stop === "length" ? "max_tokens" : stop === "tool_calls" ? "tool_calls" : stop,
      usage,
      model: data.model ?? req.model,
      requestId,
    };
  }
}
