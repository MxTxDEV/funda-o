// Test double of the Anthropic Messages API used ONLY by the end-to-end tests.
// It lets the full pipeline (web → queue → worker → provider HTTP call → database → UI) run
// without a real API key. Responses are clearly marked as coming from the test server.
import { createServer } from "node:http";

const port = Number(process.env.MOCK_AI_PORT ?? 8090);
const delayMs = Number(process.env.MOCK_AI_DELAY_MS ?? 5000);
const expectedKey = process.env.MOCK_AI_KEY ?? "sk-ant-e2e-mock-key";

createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json", "request-id": `mock_${Date.now()}` }).end(JSON.stringify(body));
  };
  if (req.url === "/health") return send(200, { ok: true });
  if (req.headers["x-api-key"] !== expectedKey) return send(401, { error: { type: "authentication_error", message: "invalid x-api-key" } });
  if (req.method === "GET" && req.url?.startsWith("/v1/models")) {
    return send(200, { data: [{ id: "mock-model-1", display_name: "Mock Model 1" }, { id: "mock-model-2", display_name: "Mock Model 2" }], has_more: false });
  }
  if (req.method === "POST" && req.url === "/v1/messages") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      const title = /Título: (.*)/.exec(body.messages?.[0]?.content ?? "")?.[1] ?? "";
      const last = body.messages?.at(-1);
      const toolResult = Array.isArray(last?.content) ? last.content.find((b) => b.type === "tool_result") : null;
      const offersMetrics = (body.tools ?? []).some((t) => t.name === "analytics__compute_metrics");
      // Tool-use path: first ask for the metrics tool, then answer with what the tool returned.
      if (offersMetrics && !toolResult) {
        return send(200, {
          model: body.model,
          content: [
            { type: "text", text: "Vou calcular as métricas." },
            {
              type: "tool_use",
              id: "toolu_mock_1",
              name: "analytics__compute_metrics",
              input: { rows: [{ label: "Campanha teste", source: "dados do servidor de teste", spend: 500, impressions: 100000, clicks: 2000, conversions: 25, revenue: 1500 }] },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 200, output_tokens: 40 },
        });
      }
      if (toolResult) {
        return send(200, {
          model: body.model,
          content: [{ type: "text", text: `## Resultado com ferramenta\n\n${String(toolResult.content).split("\n")[1] ?? ""}` }],
          stop_reason: "end_turn",
          usage: { input_tokens: 300, output_tokens: 60 },
        });
      }
      setTimeout(
        () =>
          send(200, {
            model: body.model,
            content: [{ type: "text", text: `## Resposta do servidor de teste\n\nTarefa recebida: ${title}\n\nFATOS: nenhum (servidor simulado de testes).` }],
            stop_reason: "end_turn",
            usage: { input_tokens: 321, output_tokens: 123 },
          }),
        delayMs,
      );
    });
    return;
  }
  send(404, { error: { message: "not found" } });
}).listen(port, "127.0.0.1", () => console.log(`mock AI server on ${port}`));
