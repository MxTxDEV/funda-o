# Registro de progresso — FOUNDATION v1.0

| # | Etapa | Status | Validação |
| --- | --- | --- | --- |
| 1 | Análise do projeto | ✅ | repositório vazio; Postgres 16 e Redis 7 locais; sem daemon Docker |
| 2 | Plano técnico | ✅ | `docs/architecture.md` |
| 3 | Monorepo (pnpm + Turborepo, TS strict) | ✅ | typecheck em 5 pacotes |
| 4 | Banco (Drizzle, 11 tabelas, 2 migrations, auditoria append-only) | ✅ | migrations aplicadas em dev e teste |
| 5 | Autenticação (Auth.js, scrypt, bloqueio, rate limit) | ✅ | testes de integração + E2E |
| 6 | Departamentos | ✅ | integração + E2E |
| 7 | Funcionários (versões, ferramentas, status, avatar) | ✅ | integração + E2E |
| 8 | Tarefas (7 estados, atribuição, fila, cancelamento, retry) | ✅ | integração + E2E |
| 9 | Worker BullMQ (demo, tentativas, idempotência, reconciliador, shutdown) | ✅ | testes do worker com BullMQ real |
| 10 | Aprovações (concorrência otimista, histórico) | ✅ | teste de decisões concorrentes + E2E |
| 11 | Dashboard (dados reais, escritório, fila/worker) | ✅ | integração + E2E + revisão visual desktop/mobile |
| 12 | Auditoria (log + tela + API) | ✅ | integração + E2E |
| 13 | Testes (Vitest + Playwright) | ✅ | 60 testes + 7 E2E, todos passando |
| 14 | Docker (web standalone, worker, Compose, backup) | ✅ | compose validado; standalone e worker executados; backup/restore testado |
| 15 | Documentação de deploy (Vercel + worker) | ✅ | `docs/deploy-vercel.md` |

Mudança de escopo registrada: deploy alvo alterado de Coolify para **Vercel** (web). O worker,
por ser um processo contínuo, roda em host de containers; o Compose segue disponível para
execução completa em containers.
