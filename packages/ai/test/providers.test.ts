import { describe, expect, it } from "vitest";
import {
  aiConnectionOf,
  AnthropicProvider,
  createProviderRegistry,
  estimateCostUsd,
  OpenAIProvider,
  ProviderError,
  priceFor,
  readAgentAiConfig,
  readCompanyAiLimits,
  readPricing,
} from "../src";
import type { FetchLike } from "../src";

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: Call[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  };
  return { impl, calls };
}

const req = { model: "model-x", system: "SYS", messages: [{ role: "user" as const, content: "Olá" }], maxOutputTokens: 300 };

describe("AnthropicProvider", () => {
  it("sends the Messages API request and normalizes the answer and usage", async () => {
    const f = fakeFetch(
      200,
      {
        model: "model-x",
        content: [{ type: "text", text: "Resposta " }, { type: "text", text: "final" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2 },
      },
      { "request-id": "req_1" },
    );
    const p = new AnthropicProvider("sk-ant-secret-value", f.impl);
    const r = await p.chat({ ...req, temperature: 0.2 });
    expect(r).toEqual({ text: "Resposta final", finishReason: "end", usage: { inputTokens: 12, outputTokens: 5 }, model: "model-x", requestId: "req_1" });
    const call = f.calls[0]!;
    expect(call.url).toBe("https://api.anthropic.com/v1/messages");
    expect((call.init.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-secret-value");
    expect(JSON.parse(String(call.init.body))).toEqual({
      model: "model-x",
      max_tokens: 300,
      system: "SYS",
      messages: [{ role: "user", content: "Olá" }],
      temperature: 0.2,
    });
  });

  it("omits temperature when not configured and maps max_tokens", async () => {
    const f = fakeFetch(200, { content: [{ type: "text", text: "x" }], stop_reason: "max_tokens", usage: { input_tokens: 1, output_tokens: 300 } });
    const r = await new AnthropicProvider("k", f.impl).chat(req);
    expect(JSON.parse(String(f.calls[0]!.init.body)).temperature).toBeUndefined();
    expect(r.finishReason).toBe("max_tokens");
  });

  it("classifies HTTP errors without leaking the credential", async () => {
    const auth = fakeFetch(401, { error: { type: "authentication_error", message: "invalid x-api-key sk-ant-abcdefghijkl" } });
    const err = await new AnthropicProvider("sk-ant-abcdefghijkl", auth.impl).chat(req).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe("auth");
    expect(err.retryable).toBe(false);
    expect(err.message).not.toContain("sk-ant-abcdefghijkl");

    const overloaded = fakeFetch(529, { error: { message: "Overloaded" } });
    const e2 = await new AnthropicProvider("k", overloaded.impl).chat(req).catch((e) => e);
    expect(e2.kind).toBe("overloaded");
    expect(e2.retryable).toBe(true);

    const rate = fakeFetch(429, { error: { message: "rate" } });
    expect((await new AnthropicProvider("k", rate.impl).chat(req).catch((e) => e)).retryable).toBe(true);
    const bad = fakeFetch(400, { error: { message: "bad model" } });
    expect((await new AnthropicProvider("k", bad.impl).chat(req).catch((e) => e)).kind).toBe("invalid_request");
  });

  it("refuses to call the API without a credential", async () => {
    const f = fakeFetch(200, {});
    const err = await new AnthropicProvider(undefined, f.impl).chat(req).catch((e) => e);
    expect(err.kind).toBe("not_configured");
    expect(f.calls).toHaveLength(0);
  });

  it("lists models from the provider (paginated)", async () => {
    let page = 0;
    const impl: FetchLike = async (url) => {
      page++;
      const body =
        page === 1
          ? { data: [{ id: "m-1", display_name: "M 1", created_at: "2026-01-01T00:00:00Z" }], has_more: true, last_id: "m-1" }
          : { data: [{ id: "m-2" }], has_more: false };
      expect(url).toContain("/v1/models");
      if (page === 2) expect(url).toContain("after_id=m-1");
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const models = await new AnthropicProvider("k", impl).listModels();
    expect(models.map((m) => m.id)).toEqual(["m-1", "m-2"]);
  });

  it("aborts the request when the signal fires", async () => {
    const impl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const ctl = new AbortController();
    const pending = new AnthropicProvider("k", impl).chat({ ...req, signal: ctl.signal });
    ctl.abort();
    expect((await pending.catch((e) => e)).kind).toBe("aborted");
  });

  it("times out", async () => {
    const impl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const err = await new AnthropicProvider("k", impl).chat({ ...req, timeoutMs: 20 }).catch((e) => e);
    expect(err.kind).toBe("timeout");
    expect(err.retryable).toBe(true);
  });
});

describe("OpenAIProvider", () => {
  it("sends a chat completion with the system message and normalizes usage", async () => {
    const f = fakeFetch(
      200,
      { model: "model-y", choices: [{ message: { content: "Oi" }, finish_reason: "length" }], usage: { prompt_tokens: 7, completion_tokens: 3 } },
      { "x-request-id": "r-9" },
    );
    const r = await new OpenAIProvider("sk-test-1234567890", f.impl, "http://mock.local/").chat(req);
    expect(r).toEqual({ text: "Oi", finishReason: "max_tokens", usage: { inputTokens: 7, outputTokens: 3 }, model: "model-y", requestId: "r-9" });
    expect(f.calls[0]!.url).toBe("http://mock.local/v1/chat/completions");
    expect((f.calls[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer sk-test-1234567890");
    const body = JSON.parse(String(f.calls[0]!.init.body));
    expect(body.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(body.max_completion_tokens).toBe(300);
  });

  it("hides non-chat model families from the model list", async () => {
    const f = fakeFetch(200, { data: [{ id: "chat-a", created: 2 }, { id: "text-embedding-x", created: 3 }, { id: "tts-1", created: 1 }] });
    expect((await new OpenAIProvider("k", f.impl).listModels()).map((m) => m.id)).toEqual(["chat-a"]);
  });
});

describe("registry, pricing, limits and config", () => {
  it("reads credentials from the environment and reports only booleans", () => {
    const r = createProviderRegistry({ env: { ANTHROPIC_API_KEY: "sk-ant-x" } });
    expect(r.configured()).toEqual({ anthropic: true, openai: false });
    expect(JSON.stringify(r.configured())).not.toContain("sk-ant");
    expect(() => r.get("unknown")).toThrow(ProviderError);
  });

  it("estimates cost only from configured prices", () => {
    const pricing = readPricing({ AI_MODEL_PRICING: JSON.stringify({ "anthropic/m": { inputPerMTokUsd: 3, outputPerMTokUsd: 15 } }) });
    const price = priceFor("anthropic", "m", pricing);
    expect(estimateCostUsd(price, { inputTokens: 1000, outputTokens: 2000 })).toBe(0.033);
    expect(priceFor("anthropic", "other", pricing)).toBeNull();
    expect(estimateCostUsd(null, { inputTokens: 1, outputTokens: 1 })).toBeNull();
    expect(readPricing({ AI_MODEL_PRICING: "not json" })).toEqual({});
  });

  it("reads company limits and the kill switch", () => {
    expect(readCompanyAiLimits({})).toEqual({ enabled: true, dailyTokenLimit: null, dailyCostLimitUsd: null, requestTimeoutMs: 120_000 });
    expect(readCompanyAiLimits({ AI_EXECUTION_ENABLED: "false", AI_DAILY_TOKEN_LIMIT: "5000" })).toMatchObject({ enabled: false, dailyTokenLimit: 5000 });
  });

  it("derives the connection state of an employee", () => {
    expect(aiConnectionOf(null, null)).toBe("not_configured");
    expect(aiConnectionOf("anthropic", "m", {})).toBe("missing_credentials");
    expect(aiConnectionOf("anthropic", "m", { anthropic: { configured: true } })).toBe("ready");
    expect(aiConnectionOf("anthropic", "m", { anthropic: { configured: true, lastCheckOk: false } })).toBe("provider_error");
    expect(readAgentAiConfig({ temperature: 9 })).toEqual({ maxOutputTokens: 2048 });
  });
});
