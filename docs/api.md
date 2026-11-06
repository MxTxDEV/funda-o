# API REST — `/api/v1`

Autenticação por **sessão** (cookie do Auth.js, após login em `/login`). Respostas em JSON:
sucesso `{"data": ...}`; erro `{"error": {"code", "message", "details?"}}`.

| Código | HTTP |
| --- | --- |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 (sem permissão ou origem cruzada) |
| `NOT_FOUND` | 404 |
| `CONFLICT` / `INVALID_STATE` | 409 |
| `VALIDATION` | 422 (`details.fieldErrors`) |
| `RATE_LIMITED` | 429 (`Retry-After`) |
| `INTERNAL` | 500 (com `ref` para correlacionar com os logs) |

Limites: leituras 600/min e mutações 120/min por usuário. Mutações com cabeçalho `Origin` de outro
host são recusadas.

| Método e rota | Permissão | Descrição |
| --- | --- | --- |
| `GET /api/health` | pública | estado do banco e do Redis |
| `GET /dashboard` | dashboard:read | agregados do centro de comando |
| `GET /departments` · `POST /departments` | departments:read / write | listar · criar `{name, description?, color?}` |
| `GET /departments/:id` · `PATCH /departments/:id` | read / write | detalhar · editar `{name?, description?, color?, isActive?}` |
| `GET /agents?departmentId&status&includeArchived` · `POST /agents` | agents:read / write | listar · criar (perfil + `instructions`, `allowedTools[]`) |
| `GET /agents/:id` · `PATCH /agents/:id` | read / write | detalhar (versões, presença, tarefas) · editar perfil |
| `POST /agents/:id/versions` | agents:write | nova versão `{instructions, allowedTools[], changeNote}` |
| `POST /agents/:id/status` | agents:write | `{status: active\|paused\|archived}` |
| `GET /tasks?status&agentId&departmentId&limit&offset` | tasks:read | listar |
| `POST /tasks` | tasks:write | criar `{title, type, description?, priority?, assignedAgentId?, input?, dispatch?, maxAttempts?}`; aceita `Idempotency-Key` |
| `GET /tasks/:id` | tasks:read | detalhe com eventos e aprovações |
| `POST /tasks/:id/dispatch` | tasks:write | enviar para a fila (ou nova tentativa após falha) |
| `POST /tasks/:id/cancel` | tasks:write | `{reason?}` |
| `GET /approvals?status` · `GET /approvals/:id` | approvals:read | listar · detalhar com histórico |
| `POST /approvals/:id/decision` | approvals:decide | `{decision: approve\|reject, note?, expectedVersion}` |
| `GET /audit?entityType&entityId&action&limit&offset` | audit:read | log de auditoria |

Exemplo:

```bash
curl -X POST https://<app>/api/v1/tasks \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: pedido-2026-001' \
  -b 'authjs.session-token=...' \
  -d '{"title":"Teste","type":"demo.lifecycle","assignedAgentId":"<uuid>","dispatch":true,"input":{"steps":2}}'
```

Autenticação por token para integrações máquina-a-máquina ainda não existe (ver roadmap).
