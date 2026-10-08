#!/bin/sh
# Runs as part of `npm run build`, but only on Vercel (VERCEL=1): applies database migrations and, in demo mode,
# loads demo data into an empty database. Uses Neon's direct (unpooled) URL when available.
set -e
[ "$VERCEL" = "1" ] || exit 0
DB="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
if [ -z "$DB" ]; then
  echo "vercel-db-setup: DATABASE_URL is not set; skipping database setup."
  exit 0
fi
echo "vercel-db-setup: applying migrations…"
DATABASE_URL="$DB" npx prisma migrate deploy
DATABASE_URL="$DB" npx tsx prisma/demo-bootstrap.ts
