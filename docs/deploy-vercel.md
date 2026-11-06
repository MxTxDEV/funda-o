# Deploy — Vercel (web) + worker em container

A Vercel executa a aplicação web (páginas, server actions e API) como funções serverless. O
**worker BullMQ é um processo de longa duração** e não pode rodar na Vercel: ele vai para um host de
containers. O banco e o Redis são serviços gerenciados.

```
            Vercel (apps/web)  ──────────┐
                │                         │
     Postgres gerenciado (Neon)     Redis TCP gerenciado
                │                         │
            Worker (Railway / Render / Fly.io / VPS) — docker/worker.Dockerfile
```

**Regra de ouro:** coloque Postgres, Redis, worker e a região das funções da Vercel na mesma região
(ex.: São Paulo — Vercel `gru1`, Neon `sa-east-1`/AWS São Paulo).

## 1. Postgres (Neon recomendado, via Vercel Marketplace)

- Crie o banco e anote duas URLs:
  - **pooled** (host com `-pooler`) → `DATABASE_URL` da web, com `DB_PREPARE=false` e `DB_POOL_MAX=1`;
  - **direta** → `DATABASE_URL_UNPOOLED` (migrations) e `DATABASE_URL` do worker.
- Ative backups/PITR do provedor. O `scripts/backup.sh` serve como backup lógico adicional.

## 2. Redis

O BullMQ precisa de **Redis TCP** (`redis://` ou `rediss://`) com `maxmemory-policy noeviction`.

- Opções: Redis Cloud, Railway Redis, Upstash (endpoint TCP `rediss://`; prefira um plano fixo, pois
  o BullMQ faz polling contínuo e planos por comando ficam caros).
- URLs REST da Upstash **não** funcionam com BullMQ. A integração "Upstash for Redis" da Vercel injeta
  `KV_URL` (`rediss://`), que o app aceita no lugar de `REDIS_URL`.

## 3. Migrations

Rode antes de cada deploy que altere o schema:

```bash
DATABASE_URL_UNPOOLED=postgres://...direta... pnpm db:migrate
```

Alternativa automática: na Vercel defina `RUN_MIGRATIONS_ON_BUILD=true` (e `ADMIN_EMAIL` /
`ADMIN_PASSWORD` para criar a conta proprietária caso ainda não exista) **somente no ambiente
Production**. O `scripts/vercel-build.sh` aplica migrations apenas quando
`VERCEL_ENV=production` — deploys de preview nunca alteram o banco de produção.

Depois crie a conta proprietária (uma vez):

```bash
DATABASE_URL=postgres://...direta... ADMIN_EMAIL=voce@empresa.com ADMIN_PASSWORD='...' pnpm db:seed:admin
```

## 4. Projeto na Vercel

1. Importe o repositório.
2. **Root Directory:** `apps/web` (o `apps/web/vercel.json` define install/build; a Vercel detecta o
   workspace pnpm e instala o monorepo inteiro).
3. Framework: Next.js. Node.js 22.
4. Região das funções: a mesma do banco (Settings → Functions → Region).
5. Variáveis de ambiente (Production e, com recursos separados, Preview):

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL **pooled** do Postgres |
| `DB_PREPARE` | `false` (obrigatório com pooler em modo transação) |
| `DB_POOL_MAX` | `1` |
| `REDIS_URL` | `rediss://...` |
| `QUEUE_PREFIX` | `vc` (use `vc-preview` em Preview se compartilhar o Redis) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `DATABASE_URL_UNPOOLED` / `RUN_MIGRATIONS_ON_BUILD` | opcional (ver item 3), só Production |

`AUTH_URL` e `AUTH_TRUST_HOST` não são necessários na Vercel.

> Use bancos/Redis separados (ou prefixos distintos) para Preview: os previews são públicos por URL
> e não devem operar sobre dados de produção. Considere ativar *Deployment Protection*.

## 5. Worker

Faça deploy da imagem `docker/worker.Dockerfile` (contexto = raiz do repositório) em Railway,
Render, Fly.io ou uma VPS.

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL **direta** do Postgres |
| `REDIS_URL` | mesma da web |
| `QUEUE_PREFIX` | mesmo da web |
| `WORKER_CONCURRENCY` | `5` |
| `WORKER_HEALTH_PORT` | `8080` (health check HTTP `GET /`) |
| `NODE_ENV` | `production` |

- Comando padrão: `node dist/index.js`. Migrations pela mesma imagem: `node dist/migrate.js`.
- Desligamento gracioso em `SIGTERM` (configure *grace period* ≥ 60 s).
- Pode haver várias réplicas: a idempotência por `(tarefa, execução)` e os locks do BullMQ evitam
  processamento duplicado.
- O dashboard mostra "Worker online/offline" a partir do heartbeat no Redis.

## 6. Verificação pós-deploy

1. `GET https://<app>/api/health` → `{"status":"ok","database":"up","redis":"up"}`.
2. Entre com a conta proprietária.
3. Crie um departamento, um funcionário e uma tarefa de demonstração com "Exigir aprovação";
   verifique que ela chega a "Aguardando aprovação", aprove e confirme "Concluída".
4. Opcional: rode o E2E contra a URL publicada:
   `E2E_BASE_URL=https://<app> ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm test:e2e`.

## Alternativa: tudo em containers

`docker-compose.yml` sobe Postgres, Redis, migrations, web (Next standalone) e worker com rede
interna isolada — útil para homologação ou para hospedar a web fora da Vercel.
