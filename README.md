# Virtual Company — FOUNDATION v1.0

Plataforma operacional de uma empresa virtual operada por funcionários de IA, com foco inicial em
**marketing digital**. Esta entrega (FOUNDATION) constrói toda a infraestrutura sobre a qual serão
acoplados o **Central Brain**, os funcionários inteligentes e o **escritório 3D**.

> Nesta fase **não há motor de IA** e **nenhuma funcionalidade publica anúncios ou gera gastos**.
> O único processador de tarefas é um processador de **demonstração**, claramente identificado.

## O que já funciona

| Área | Situação |
| --- | --- |
| Autenticação administrativa | Auth.js (credenciais + JWT), bloqueio após 5 falhas, rate limit por IP/e-mail, papéis revalidados no banco a cada requisição |
| Departamentos | Criar, editar, listar, ativar/desativar |
| Funcionários virtuais | Perfil (nome, cargo, departamento, especialidade, descrição, avatar), status, instruções **versionadas**, ferramentas autorizadas, rollback de versão |
| Tarefas | Criar, atribuir, enviar para a fila, consultar, cancelar, tentar novamente; 7 estados com máquina de estados validada |
| Worker | BullMQ independente, processador de demonstração, tentativas com backoff, idempotência por `(tarefa, execução)`, reconciliador, desligamento gracioso |
| Aprovações | Solicitação, aprovação/rejeição com controle de concorrência otimista, histórico |
| Presença | Estado de cada funcionário sincronizado com as tarefas na mesma transação |
| Conversas | Individuais, por departamento e gerais (sem respostas simuladas) |
| Dashboard | Centro de comando com dados reais do banco, fila e worker |
| Auditoria | Log append-only (protegido por trigger no Postgres) de todas as operações relevantes |
| API REST | `/api/v1/*` autenticada, com rate limit, checagem de origem e `Idempotency-Key` |

## Stack

Next.js 16 · TypeScript strict · Tailwind CSS 4 · shadcn/ui · PostgreSQL 16 · Drizzle ORM · Redis 7 ·
BullMQ · Zod 4 · Auth.js v5 · Docker / Compose · Vitest · Playwright · pnpm · Turborepo.

## Estrutura

```
apps/
  web/        Next.js (UI + server actions + API REST /api/v1) — deploy na Vercel
  worker/     Worker BullMQ independente (processadores, reconciliador) — container
packages/
  db/         Schema Drizzle, cliente, migrations versionadas
  core/       Regras de negócio: serviços, permissões, validação, auditoria, máquina de estados, seeds
  queue/      Conexão Redis, filas, contratos de jobs
docker/       Dockerfiles (web, worker) e init do banco de testes
docs/         Documentação técnica
scripts/      Backup e build da Vercel
```

## Início rápido (desenvolvimento)

```bash
cp .env.example .env    # ajuste ADMIN_EMAIL / ADMIN_PASSWORD / AUTH_SECRET
docker compose -f docker-compose.dev.yml up -d
pnpm install
pnpm db:migrate
pnpm db:seed:admin
pnpm dev                # web em http://localhost:3000 + worker
```

Detalhes em [docs/development.md](docs/development.md).

## Documentação

- [Arquitetura e plano técnico](docs/architecture.md)
- [Desenvolvimento local](docs/development.md)
- [Deploy na Vercel (web) + worker](docs/deploy-vercel.md)
- [API REST](docs/api.md)
- [Relatório de testes](docs/testing.md)
- [Limitações conhecidas e próximas etapas](docs/roadmap.md)
- [Registro de progresso](docs/progress.md)
