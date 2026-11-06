# syntax=docker/dockerfile:1
# Virtual Company — BullMQ worker (also ships the migration runner)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/queue/package.json packages/queue/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @vc/worker build \
 && pnpm --filter @vc/worker deploy --prod --legacy /out \
 && cp -r apps/worker/dist /out/dist \
 && cp -r packages/db/migrations /out/migrations

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production MIGRATIONS_DIR=/app/migrations
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /out ./
USER app
# Default: run the worker. Migrations: `node dist/migrate.js`.
CMD ["node", "dist/index.js"]
