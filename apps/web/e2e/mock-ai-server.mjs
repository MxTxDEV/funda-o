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
