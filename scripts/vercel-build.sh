#!/bin/sh
# Vercel build for apps/web (Root Directory = apps/web).
# Database steps run ONLY for production deployments and only when explicitly enabled, so preview
# deployments never touch the production schema.
set -eu
if [ "${VERCEL_ENV:-}" = "production" ] && [ "${RUN_MIGRATIONS_ON_BUILD:-false}" = "true" ]; then
  echo "[vercel-build] applying database migrations"
  pnpm --filter @vc/db db:migrate
  # Creates the owner account if it does not exist yet (never overwrites an existing one).
  pnpm --filter @vc/core db:bootstrap:admin
  # Optional, idempotent: registers the initial team (never modifies existing employees).
  if [ "${SEED_INITIAL_TEAM:-false}" = "true" ]; then
    pnpm --filter @vc/core db:seed:team
  fi
fi
pnpm --filter @vc/web build
