#!/bin/bash
# ─── ClipHunter AI — Setup Script ────────────────────────
# Run this script on the server (Oracle Cloud / any VPS) to:
# 1. Download Vosk speech-to-text model (~42MB)
# 2. Run database migrations
# 3. Create required directories
#
# Usage: bash scripts/setup.sh    (run from the backend/ directory)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "🔧 ClipHunter AI — Running setup tasks..."
echo "📂 Working directory: $(pwd)"

# ─── 1. Download Vosk model if not present ──────────────
MODEL_DIR="models"
MODEL_NAME="vosk-model-small-en-us-0.15"
MODEL_URL="https://alphacephei.com/vosk/models/${MODEL_NAME}.zip"

if [ ! -d "$MODEL_DIR/$MODEL_NAME" ]; then
  echo "📥 Downloading Vosk speech-to-text model (~42MB)..."
  mkdir -p "$MODEL_DIR"
  curl -L -o /tmp/vosk-model.zip "$MODEL_URL"
  echo "📦 Extracting model..."
  unzip -q /tmp/vosk-model.zip -d "$MODEL_DIR/"
  rm /tmp/vosk-model.zip
  echo "✅ Vosk model downloaded to $MODEL_DIR/$MODEL_NAME"
else
  echo "✅ Vosk model already present at $MODEL_DIR/$MODEL_NAME"
fi

# ─── 2. Install dependencies & build ────────────────────
echo "📦 Installing dependencies..."
npm install
echo "🏗️  Building TypeScript..."
npm run build

# ─── 3. Run database migrations ─────────────────────────
echo "🗄️  Running database migrations..."
npx prisma migrate deploy
echo "✅ Database migrations complete"

# ─── 4. Ensure upload directories exist ─────────────────
mkdir -p uploads generated-clips temp
echo "✅ Directories ready"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo "📋 Next steps:"
echo "   1. Set up .env file with your JWT_SECRET"
echo "   2. Start server: pm2 start dist/index.js --name cliphunter-api"
echo "   3. Configure Nginx reverse proxy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
