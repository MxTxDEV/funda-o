import { ProviderError } from "../errors";
import { requestJson, trimBaseUrl } from "../http";
import type { ChatRequest, ChatResult, FetchLike, ModelInfo, ModelProvider } from "../types";

type CompletionResponse = {
  model?: string;
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};
type ModelsList = { data?: { id: string; created?: number }[] };

/**
 * Families returned by /v1/models that cannot answer a chat completion (embeddings, speech, images…).
 * They are hidden from the model picker; everything else is shown exactly as the provider lists it.
 */
const NON_CHAT = /(embedding|tts|whisper|dall-e|moderation|transcribe|realtime|audio|image|sora|davinci|babbage|search)/i;

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
          messages: [{ role: "system", content: req.system }, ...req.messages],
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
    const stop = choice.finish_reason ?? "unknown";
    return {
      text,
      finishReason: stop === "stop" ? "end" : stop === "length" ? "max_tokens" : stop,
      usage,
      model: data.model ?? req.model,
      requestId,
    };
  }
}
