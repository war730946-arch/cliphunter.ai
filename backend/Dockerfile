# ─── ClipHunter AI — Dockerfile for Railway ─────────────────────
# Multi-stage build: Stage 1 compiles TypeScript, Stage 2 is the
# lean runtime with FFmpeg + Vosk speech-to-text model.
# ────────────────────────────────────────────────────────────────

# ── Stage 1: Builder ────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /build

# System deps needed for Prisma generate
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

# ── Stage 2: Runtime ────────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

# Install runtime system dependencies:
#   ffmpeg    — video/audio processing
#   vosk      — native bindings need python3 + make + g++
#   wget+unzip — to download the speech model
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    openssl \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Download the small English Vosk model (~42 MB) at build time
RUN mkdir -p /app/models && \
    wget -q https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip \
      -O /tmp/vosk-model.zip && \
    unzip -q /tmp/vosk-model.zip -d /app/models/ && \
    rm /tmp/vosk-model.zip

# Copy compiled artifacts and dependencies from builder
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/prisma ./prisma
COPY package*.json ./

# Persistent volume mount point — set DATABASE_URL to file:/data/dev.db
RUN mkdir -p /data && chmod 755 /data

# Upload / clip directories (ephemeral — use Railway volumes or S3 for production)
RUN mkdir -p /app/uploads /app/generated-clips && chmod 755 /app/uploads /app/generated-clips

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(r=>r.json()).then(d=>process.exit(d.status==='ok'?0:1)).catch(()=>process.exit(1))"

# Run migrations on startup, then start the server
# Note: prisma CLI is available in node_modules from the builder stage
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
