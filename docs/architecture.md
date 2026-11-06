# Arquitetura — FOUNDATION v1.0

## 1. Visão geral

**Monólito modular com worker independente.** Um único repositório (Turborepo + pnpm) com dois
processos executáveis e três pacotes internos:

```
                 ┌─────────────────────────── apps/web (Vercel) ───────────────────────────┐
 navegador ──►   │ proxy.ts (sessão)  →  páginas RSC / server actions / route handlers     │
                 │                         │            (finos: auth + validação + mapa de erros)
                 └─────────────────────────┼───────────────────────────────────────────────┘
                                           ▼
                              packages/core  (regras de negócio)
                     permissões · validação Zod · serviços · auditoria · estados
                         │                                   │
                         ▼                                   ▼
                  packages/db (Drizzle)              packages/queue (BullMQ)
                         │                                   │
                    PostgreSQL ◄──────────────┐         Redis (fila + rate limit)
                                              │              │
                 ┌────────────── apps/worker (container) ────┴──────────┐
                 │ Worker "tasks" → processTaskJob → processadores       │
                 │ Worker "maintenance" → reconciliador (a cada 60 s)    │
                 └──────────────────────────────────────────────────────┘
```

Princípios:

- **Nenhuma regra de negócio nas páginas.** Páginas, server actions e rotas da API apenas
  autenticam, aplicam rate limit, chamam um serviço do `core` e mapeiam erros.
- **Autorização no backend:** todo serviço chama `assertCan(actor, permissão)`. O papel do usuário é
  relido do banco a cada requisição (desativar um usuário ou trocar seu papel vale imediatamente).
- **Toda mutação é transacional e auditada** na mesma transação.
- **O worker não depende do web** — compartilha apenas `core`, `db` e `queue`.

## 2. Módulos

| Pacote | Responsabilidade |
| --- | --- |
| `@vc/db` | Schema (`src/schema/*`), cliente `postgres.js` + Drizzle, migrator, valores de enums sem dependências (`@vc/db/values`, seguro para o cliente) |
| `@vc/queue` | Conexões ioredis (produtor × worker), fila `tasks`, `jobId` determinístico, métricas, heartbeat do worker |
| `@vc/core` | `services/*` (departamentos, agentes, tarefas, execuções, aprovações, presença, conversas, dashboard, auditoria, usuários), `auth/*` (papéis, hash scrypt), `validation.ts`, `tools.ts`, `task-types.ts`, `tasks/state-machine.ts`, `ratelimit.ts`, `seed/*` |
| `apps/web` | UI (App Router), `src/app/(app)/actions/*` (server actions), `src/app/api/v1/*` (REST), `src/lib/{session,actions,api}.ts` (wrappers), Auth.js |
| `apps/worker` | `run-task.ts` (orquestração de uma execução), `processors/*` (registro por tipo), `reconciler.ts`, `index.ts` (bootstrap, heartbeat, health, shutdown) |

`@vc/core/client` exporta apenas o que é seguro para componentes cliente (rótulos, enums, catálogo de
ferramentas, schemas Zod).

## 3. Modelo de dados

Todas as tabelas usam **UUID** (`gen_random_uuid()`), `timestamptz` e **JSONB** onde há estrutura
flexível. Migrations versionadas em `packages/db/migrations`.

| Tabela | Destaques |
| --- | --- |
| `users` | e-mail único case-insensitive (`lower(email)`), `role` (owner/admin/operator/viewer), bloqueio (`failed_login_attempts`, `locked_until`) |
| `departments` | `slug` único, `color` (sala no escritório), `is_active`, `is_demo` |
| `agents` | departamento (restrict), cargo, especialidade, avatar (URL https ou personagem gerado por `avatar_seed`), `status`, `current_version_id`, `is_demo` |
| `agent_versions` | `(agent_id, version)` único, `instructions`, `allowed_tools` (JSONB), `config` (JSONB reservado ao Central Brain) |
| `tasks` | `status` (7 estados), `priority`, `type` (processador), `input`/`result`/`error` JSONB, `run_count`, `attempts`, `max_attempts`, `version` (concorrência otimista), `idempotency_key` único, `agent_version_id` (snapshot) |
| `task_events` | histórico do ciclo de vida (`from_status`, `to_status`, ator, mensagem, dados) |
| `approvals` | `status`, `version`, `payload` JSONB, decisão; **índice único parcial**: no máximo uma aprovação pendente por tarefa |
| `conversations` / `messages` | `kind` direct/department/general com **CHECK** garantindo o alvo correto |
| `audit_logs` | ator, ação, entidade, `changes`/`metadata` JSONB, IP, user-agent; **append-only** via trigger |
| `agent_presence` | estado (offline/idle/working/waiting_approval/paused), tarefa atual, `location` JSONB reservado ao escritório 3D |

## 4. Ciclo de vida da tarefa

```
pending ──dispatch──► queued ──worker──► in_progress ──► completed
   │                    ▲  │                 │  │ └────► waiting_approval ──aprovar──► queued (nova execução)
   │                    │  │                 │  │                          └─rejeitar─► failed
   │                    │  └──cancel──┐      │  └─ falha c/ tentativas restantes ─► queued (backoff)
   └──────cancel────────┼─────────────┴──────┴─ falha final ─► failed ──retry manual──► queued
                        │                                      
                    cancelled (terminal)            completed (terminal)
```

As transições permitidas ficam em `core/src/tasks/state-machine.ts` e são verificadas em
`applyTransition`, que também incrementa `version`, grava o `task_event` e ressincroniza a presença.

### Idempotência e falhas

- **Job id determinístico** `task-<id>-run-<n>`: reenfileirar a mesma execução não duplica o job.
- **`run_count`**: cada envio para a fila cria uma nova execução; um job de execução antiga é ignorado.
- O worker só inicia se a tarefa estiver `queued` com o mesmo `run_count` (ou `in_progress` da mesma
  execução, no caso de job "stalled" após queda do worker).
- **Tentativas:** BullMQ com backoff exponencial (2 s, 4 s, …). Entre tentativas a tarefa volta para
  `queued` com evento `retry_scheduled`; na última, vai para `failed`. Erros permanentes
  (`UnrecoverableError`: payload inválido, tipo sem processador) falham imediatamente.
- **Cancelamento cooperativo:** o processador verifica `isAborted()` entre etapas; resultados de uma
  execução cancelada são descartados (evento `result_discarded`).
- **Enfileiramento após commit:** se o Redis falhar após o commit, a tarefa permanece `queued` e o
  **reconciliador** (a cada 60 s) a reenfileira. Ele também marca como `failed` (`WORKER_LOST`)
  execuções `in_progress` cujo job não existe mais.

### Aprovações e concorrência

`decideApproval` executa `UPDATE … WHERE status = 'pending' AND version = <versão vista>`. Sob
concorrência, o Postgres serializa a linha e apenas uma decisão é aplicada; a outra recebe `409`.
Aprovar re-enfileira a tarefa numa nova execução (o processador recebe as aprovações concedidas);
rejeitar a finaliza como `failed` (`APPROVAL_REJECTED`).

## 5. Presença

`syncAgentPresence(tx, agentId)` recalcula o estado a partir da fonte da verdade (status do agente +
tarefas `in_progress`/`waiting_approval`) **dentro da mesma transação** de cada transição. Não existe
estado de presença "solto" que possa divergir.

## 6. Permissões

| Papel | Permissões |
| --- | --- |
| owner | tudo, incluindo `users:manage` |
| admin | tudo exceto `users:manage` |
| operator | leitura + `tasks:write` + `conversations:write` |
| viewer | somente leitura (sem auditoria) |

Atores internos (`worker`, `system`) nunca vêm de requisições HTTP.

## 7. Segurança

- Sessão JWT (8 h) assinada com `AUTH_SECRET`; `proxy.ts` redireciona visitantes; **cada** action,
  rota e serviço reautentica/autoriza (defesa em profundidade).
- Senhas com **scrypt** (N=32768, salt aleatório, comparação em tempo constante); hash fictício para
  usuários inexistentes (sem enumeração por tempo); bloqueio de 15 min após 5 falhas.
- **Rate limit** em Redis: login (10 / 15 min por IP e por e-mail), mutações (120/min por usuário),
  leituras da API (600/min). Falha fechada se o Redis estiver indisponível.
- Validação Zod em toda entrada; avatar só `https`; ferramentas só do catálogo.
- Erros inesperados nunca vazam detalhes: o cliente recebe uma referência, o log recebe o stack.
- Headers: CSP, `X-Frame-Options: DENY`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- API: checagem de `Origin` em mutações (além de cookies `SameSite=Lax`).
- **Sem publicação/gasto:** o catálogo de ferramentas tem `allowsSpend: false` e `readOnly: true` em
  todas as entradas (verificado por teste); não existe processador que publique nada.
- Auditoria append-only no banco; backups (`scripts/backup.sh`); serviços isolados em rede interna
  no Compose (Postgres/Redis sem portas publicadas).

## 8. Pontos de extensão (próximas fases)

- **Central Brain:** novos tipos em `core/src/task-types.ts` + processadores em
  `apps/worker/src/processors`. O processador recebe `agent`, `agentVersion` (instruções e
  ferramentas) e aprovações já decididas, e pode pedir aprovação humana.
- **Ferramentas:** o catálogo (`core/src/tools.ts`) passa a ter executores; a autorização por versão já
  existe.
- **Respostas nas conversas:** `messages.author_type = 'agent'` já é suportado pelo schema e pela UI.
- **Escritório 3D:** `agent_presence.location` e o componente `OfficeFloor` são o ponto de troca.
