#!/bin/sh
# Vercel build for apps/web (Root Directory = apps/web).
# Migrations run ONLY for production deployments and only when explicitly enabled, so preview
# deployments never touch the production schema.
set -eu
if [ "${VERCEL_ENV:-}" = "production" ] && [ "${RUN_MIGRATIONS_ON_BUILD:-false}" = "true" ]; then
  echo "[vercel-build] applying database migrations"
  pnpm --filter @vc/db db:migrate
fi
pnpm --filter @vc/web build
