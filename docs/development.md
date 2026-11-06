# Desenvolvimento local

## Pré-requisitos

- Node.js 22+ e pnpm 10 (`corepack enable`)
- Docker (para Postgres e Redis) — ou Postgres 16 e Redis 7 instalados localmente

## Passo a passo

```bash
cp .env.example .env
```

Edite `.env`: defina `AUTH_SECRET` (`openssl rand -base64 32`), `ADMIN_EMAIL` e `ADMIN_PASSWORD`
(mínimo 12 caracteres, 3 tipos entre minúsculas, maiúsculas, números e símbolos).

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres (5432) + Redis (6379), inclui o banco de testes
pnpm install
pnpm db:migrate
pnpm db:seed:admin                                 # cria/reseta a conta proprietária
pnpm dev                                           # web (http://localhost:3000) + worker em modo watch
```

Dados de demonstração (opcional, sempre marcados como **DEMO**):

```bash
pnpm db:seed:demo      # cria 3 departamentos, 4 funcionários e 1 tarefa de demonstração
pnpm db:demo:purge     # remove todos os dados de demonstração
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | web + worker em modo desenvolvimento |
| `pnpm build` | build de produção (web e worker) |
| `pnpm typecheck` | TypeScript strict em todos os pacotes |
| `pnpm test` | testes unitários e de integração (Vitest; usa `TEST_DATABASE_URL` e `TEST_REDIS_URL`) |
| `pnpm test:e2e` | Playwright (requer `pnpm build`, conta admin semeada; sobe web e worker automaticamente) |
| `pnpm db:generate` | gera uma nova migration após alterar `packages/db/src/schema` |
| `pnpm db:migrate` | aplica migrations (`DATABASE_URL_UNPOOLED` se definida, senão `DATABASE_URL`) |
| `./scripts/backup.sh ./backups` | backup lógico (`pg_dump -Fc`) com retenção |

## Banco de testes

Os testes de integração **truncam** as tabelas do banco apontado por `TEST_DATABASE_URL`
(padrão `virtual_company_test`) e usam o Redis `TEST_REDIS_URL` (db 1) com prefixo `vc-test`.
Nunca aponte essas variáveis para o banco de desenvolvimento ou produção. Aplique as migrations nele:

```bash
DATABASE_URL=$TEST_DATABASE_URL pnpm db:migrate
```

## Stack completa em containers

```bash
POSTGRES_PASSWORD=... AUTH_SECRET=... docker compose up -d --build
docker compose --profile backup up -d      # opcional: backup diário
```

O serviço `migrate` roda antes de `web` e `worker`. Para criar a conta admin, rode
`pnpm db:seed:admin` a partir do host apontando `DATABASE_URL` para o banco (ou exponha
temporariamente a porta do Postgres).

## Adicionando um novo tipo de tarefa

1. Declare o tipo e o schema de entrada em `packages/core/src/task-types.ts`.
2. Implemente o processador em `packages/engine/src/processors/` e registre em `processors/index.ts`
   (o TypeScript exige um processador para cada tipo registrado).
3. Escreva testes em `packages/engine/test/`.
