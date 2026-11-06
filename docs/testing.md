# Relatório de testes — FOUNDATION v1.0

Executado em 2026-11-06, ambiente local: Node 22, PostgreSQL 16.15, Redis 7.0, Chromium (Playwright 1.63).

| Suíte | Ferramenta | Resultado |
| --- | --- | --- |
| Typecheck (5 pacotes, TS strict + `noUncheckedIndexedAccess`) | `tsc` | ✅ sem erros |
| `@vc/core` — unitários + integração (Postgres e Redis reais) | Vitest | ✅ 52/52 |
| `@vc/worker` — execução de tarefas + BullMQ real | Vitest | ✅ 6/6 |
| `@vc/web` — utilitários | Vitest | ✅ 2/2 |
| End-to-end (web + worker + Postgres + Redis) | Playwright | ✅ 7/7 (incl. login de setup) |
| Build de produção (web + worker) | `next build`, `tsup` | ✅ |
| Next standalone (base da imagem Docker) | `node server.js` + `/api/health` | ✅ health ok, headers de segurança presentes |
| `docker compose config` (stack e dev) | Docker CLI | ✅ válido |
| Backup e restauração | `scripts/backup.sh` + `pg_restore` em banco novo | ✅ |

Comandos: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.

## Cobertura funcional

**Unitários** — máquina de estados (transições válidas/ inválidas, estados terminais); papéis e
permissões; hash de senha (salt, verificação, hash fictício); força de senha; validações Zod (avatar
só https, ferramentas do catálogo, tipos de tarefa, entradas de formulário, conversas); catálogo de
ferramentas sem publicação/gasto.

**Integração (core)** — CRUD de departamentos com auditoria e conflito de nome; autorização no
backend (viewer/operator bloqueados); agente com versão 1, novas versões, presença sincronizada com
status; auditoria **append-only** (UPDATE/DELETE recusados pelo banco); criação de tarefa,
idempotência por chave, envio para a fila com `jobId` determinístico; bloqueio sem agente ativo;
cancelamento removendo o job; execuções antigas/duplicadas ignoradas; tentativas e falha final;
resultado descartado após cancelamento; aprovação re-enfileira em nova execução; rejeição falha a
tarefa; **duas decisões concorrentes → exatamente uma vence (409 na outra)**; versão desatualizada;
cancelamento fecha aprovação pendente; login, bloqueio após 5 falhas, usuário inativo/inexistente;
rate limit; conversas sem respostas simuladas; dashboard com zeros reais em banco vazio; seed demo
idempotente e purge.

**Worker** — ciclo demo completo até aprovação e conclusão; retry após falha simulada; falha
permanente e retry manual; tipo sem processador (`UnrecoverableError`); payload inválido; worker
BullMQ real processando com backoff.

**E2E** — redirecionamento e 401 sem sessão; credenciais inválidas; fluxo completo
departamento → funcionário → nova versão → tarefa → worker → aguardando aprovação → aprovar →
concluída → dashboard → auditoria; cancelamento; conversa; API REST (leitura, `Idempotency-Key`,
422 de validação, 403 de origem cruzada).

## Problemas encontrados e corrigidos durante a validação

1. Rótulos dos campos do processador demo apontavam para ids inexistentes (acessibilidade) — corrigido.
2. Configuração do Playwright considerava o worker ativo usando o health da web; o worker não subia
   — agora usa o health HTTP do próprio worker.
3. O Auth.js registrava stack trace a cada login inválido — silenciado (a falha já é auditada).
4. Layout dos postos no escritório truncava nomes; banner de demo quebrava no mobile — ajustados.
5. Um `dump.rdb` do Redis local entrou no repositório — removido e ignorado.

## Não testado neste ambiente

- **Build das imagens Docker**: não havia daemon Docker disponível. Os passos equivalentes foram
  validados individualmente (install congelado, `next build` standalone, `pnpm deploy` do worker,
  execução do servidor standalone e do worker compilado).
- **Deploy real na Vercel** e serviços gerenciados (Neon/Redis gerenciado).
- O workflow de CI (`.github/workflows/ci.yml`) foi escrito mas ainda não rodou no GitHub.
