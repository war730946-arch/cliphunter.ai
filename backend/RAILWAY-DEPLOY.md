# 🚂 Deploy ClipHunter AI Backend on Railway

This guide walks you through deploying the ClipHunter AI backend on **Railway** — no credit card needed.

> **Prerequisites:** A GitHub account (free) — that's it.

---

## 📋 Quick Start (5 minutes)

### Step 1: Push Your Code to GitHub

```bash
cd cliphunter-ai

# Initialize git if not already done
git init
git add -A
git commit -m "Initial commit"

# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/cliphunter-ai.git
git push -u origin main
```

### Step 2: Sign Up on Railway

1. Go to [railway.app](https://railway.app)
2. Click **Login with GitHub** — **no credit card required** ✅
3. Authorize Railway to access your GitHub account

### Step 3: Create a New Project

1. Click **New Project** → **Deploy from GitHub repo**
2. Select your `cliphunter-ai` repository
3. Railway will detect the `Dockerfile` and start building automatically

### Step 4: Add a Persistent Volume

Railway offers a **0.5 GB free persistent volume** — this is where the SQLite database file lives so it doesn't get erased on redeploy.

1. In your Railway project dashboard, click your service
2. Go to the **Settings** tab
3. Scroll to **Volumes** → click **Add Volume**
4. Set:
   - **Mount Path:** `/data`
   - **Size:** `0.5 GB` (free tier)
5. Click **Add**

### Step 5: Set Environment Variables

Go to your service's **Variables** tab and add:

| Variable | Value | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | `file:/data/dev.db` | SQLite database stored on persistent volume |
| `JWT_SECRET` | *(generate a secure secret)* | JWT signing key |
| `JWT_EXPIRES_IN` | `7d` | Token expiry |
| `NODE_ENV` | `production` | Production mode |
| `VOSK_MODEL` | `vosk-model-small-en-us-0.15` | Speech-to-text model folder name (default works, no need to set) |
| `PORT` | `5000` | Internal port (Railway maps externally) |

> **Generate a JWT secret:**
> ```bash
> openssl rand -hex 32
> ```
> Or use an online generator.

### Step 6: Deploy

1. Railway auto-deploys when you push to GitHub
2. To manually redeploy: click **Deploy** in the dashboard
3. Watch the **Deploy Logs** tab for progress
4. Once done, click the **Settings** tab → **Networking** → your service URL will appear (e.g., `https://cliphunter-ai.up.railway.app`)

### Step 7: Verify It's Working

Visit your service URL + `/health`:

```bash
curl https://your-service.up.railway.app/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-07-14T...","uptime":12.34}
```

---

## 🔧 Railway Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `file:./dev.db` | Set to `file:/data/dev.db` for Railway volume |
| `JWT_SECRET` | ✅ | — | Generate with `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | — | `7d` | Token lifetime |
| `NODE_ENV` | — | `production` | Environment mode |
| `VOSK_MODEL` | — | `vosk-model-small-en-us-0.15` | Vosk model folder name (default path is `/app/models/` + this name) |
| `PORT` | — | `5000` | Server port |
| `LOG_LEVEL` | — | `info` | Logger verbosity (`debug`, `info`, `warn`, `error`) |
| `MAX_QUEUE_SIZE` | — | `10` | Max concurrent processing jobs |
| `CLIP_RETENTION_DAYS` | — | `14` | Auto-cleanup clip age |
| `VIDEO_RETENTION_DAYS` | — | `30` | Auto-cleanup video age |
| `CLEANUP_INTERVAL_HOURS` | — | `24` | Cleanup check frequency |

---

## 📦 Docker Image Contents

The Dockerfile builds an image with:

| Component | Version / Size | Purpose |
|-----------|---------------|---------|
| Node.js | 22 LTS | JavaScript runtime |
| FFmpeg | latest | Video/audio processing |
| Vosk Model (small) | ~42 MB | Offline speech-to-text |
| Prisma | ^6.6.0 | Database ORM |
| Express | ^5.2.1 | API framework |

**Image size:** ~650 MB compressed, ~1.2 GB expanded.

---

## 🔄 Redeploying After Changes

### Option A: Auto-deploy (recommended)

```bash
git add .
git commit -m "Update backend"
git push
```

Railway auto-deploys from the `main` branch. The database on the `/data` volume is **not affected** by redeploys.

### Option B: Manual Redeploy

In the Railway dashboard, click **Redeploy**.

---

## ⚠️ Important Notes

### SQLite on Railway
- The SQLite database file lives on the **persistent volume** at `/data/dev.db`
- It **survives** restarts, redeploys, and spin-downs ✅
- **Backup regularly:** Download the file from Railway dashboard or use their CLI

### Free Tier Limits
- **0.5 GB** persistent storage (enough for hundreds of users with SQLite)
- Service spins down after **30 minutes of inactivity** (wakes on next request)
- **$5 free credit** — monthly usage is typically < $1 for this app

### Uploaded Files
Video uploads and generated clips are stored **temporarily** in the container (ephemeral). They will be lost on restart. For production, add:
- **Railway Object Storage** (S3-compatible) — or
- External storage like **Backblaze B2** (10 GB free)

---

## ❓ Troubleshooting

### Build fails with "Cannot find module"
```bash
# Check that package.json dependencies are correct
# Redeploy — Railway retries automatically
```

### Health check fails
1. Check the **Deploy Logs** for error messages
2. Verify all environment variables are set
3. Check that the volume is mounted at `/data`

### Database errors
```bash
# Run a Prisma migration manually via Railway CLI:
railway run npx prisma migrate deploy
```

### "FFmpeg not found"
The Dockerfile installs FFmpeg. If missing, check the build logs.

### "Vosk model not loading"
The Dockerfile downloads the small Vosk model to the default location. If you use a different model, set `VOSK_MODEL` to the folder name (e.g. `vosk-model-en-us-0.22`). The model directory is `/app/models/`.

---

## 📚 Resources

- [Railway Docs](https://docs.railway.com)
- [Railway Volumes Reference](https://docs.railway.com/reference/volumes)
- [Railway Node.js Guide](https://docs.railway.com/guides/nodejs)
- [Vosk Speech Models](https://alphacephei.com/vosk/models)

---

**Made with ❤️ by ClipHunter AI** — deploy for free, forever. 🎯
