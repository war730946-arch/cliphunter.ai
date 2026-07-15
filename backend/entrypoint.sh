#!/bin/sh
# ─── ClipHunter AI — Docker Entrypoint ──────────────────
# Runs database migrations and starts the server.
# ────────────────────────────────────────────────────────

set -e

echo "→ Running Prisma migrations..."
npx prisma migrate deploy

echo "→ Starting ClipHunter AI backend..."
exec node dist/index.js
