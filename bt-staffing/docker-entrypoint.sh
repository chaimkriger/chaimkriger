#!/bin/sh
set -e
echo "Applying database migrations..."
npx prisma migrate deploy
if [ "$SEED_ON_START" = "true" ]; then
  echo "Seeding demo data (skipped if users already exist)..."
  SEED_ONLY_IF_EMPTY=true npx tsx prisma/seed.ts
fi
exec npx next start -p "${PORT:-3000}" -H 0.0.0.0
