import { ProviderError } from "../errors";
import { requestJson, trimBaseUrl } from "../http";
import type { ChatRequest, ChatResult, FetchLike, ModelInfo, ModelProvider } from "../types";

const API_VERSION = "2023-06-01";

type MessagesResponse = {
  model?: string;
  content?: { type: string; text?: string }[];
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
};
type ModelsPage = { data?: { id: string; display_name?: string; created_at?: string }[]; has_more?: boolean; last_id?: string };

/** Anthropic Messages API (https://docs.anthropic.com/en/api/messages). */
export class AnthropicProvider implements ModelProvider {
  readonly id = "anthropic" as const;
  readonly label = "Anthropic";

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = "https://api.anthropic.com",
  ) {}

  isConfigured() {
    return !!this.apiKey;
  }

  private headers() {
    if (!this.apiKey) throw new ProviderError(this.id, "not_configured");
    return { "x-api-key": this.apiKey, "anthropic-version": API_VERSION };
  }

  async listModels(opts: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<ModelInfo[]> {
    const headers = this.headers();
    const out: ModelInfo[] = [];
    let after: string | undefined;
    for (let page = 0; page < 10; page++) {
      const qs = new URLSearchParams({ limit: "1000", ...(after ? { after_id: after } : {}) });
      const { body } = await requestJson(
        this.id,
        this.fetchImpl,
        `${trimBaseUrl(this.baseUrl)}/v1/models?${qs}`,
        { method: "GET", headers, signal: opts.signal, timeoutMs: opts.timeoutMs ?? 20_000 },
        "request-id",
      );
      const data = body as ModelsPage;
      if (!Array.isArray(data?.data)) throw new ProviderError(this.id, "invalid_response", "lista de modelos ausente");
      for (const m of data.data) out.push({ id: m.id, displayName: m.display_name ?? null, createdAt: m.created_at ?? null });
      if (!data.has_more || !data.last_id) break;
      after = data.last_id;
    }
    return out;
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const { body, requestId } = await requestJson(
      this.id,
      this.fetchImpl,
      `${trimBaseUrl(this.baseUrl)}/v1/messages`,
      {
        method: "POST",
        headers: this.headers(),
        body: {
          model: req.model,
          max_tokens: req.maxOutputTokens,
          system: req.system,
          messages: req.messages,
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        },
        signal: req.signal,
        timeoutMs: req.timeoutMs,
      },
      "request-id",
    );
    const data = body as MessagesResponse;
    if (!Array.isArray(data?.content)) throw new ProviderError(this.id, "invalid_response", "conteúdo ausente", null, requestId);
    const text = data.content
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("");
    const u = data.usage;
    const usage =
      u && typeof u.input_tokens === "number" && typeof u.output_tokens === "number"
        ? {
            inputTokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
            outputTokens: u.output_tokens,
          }
        : null;
    const stop = data.stop_reason ?? "unknown";
    return {
      text,
      finishReason: stop === "end_turn" || stop === "stop_sequence" ? "end" : stop,
      usage,
      model: data.model ?? req.model,
      requestId,
    };
  }
}
