# 🚀 ClipHunter AI — Free Oracle Cloud Deployment Guide

Deploy ClipHunter AI on **Oracle Cloud "Always Free" tier** (or any free Ubuntu VPS).  
**No hidden costs, no trial expiry.** This guide covers everything from a fresh Ubuntu 22.04 VM to a fully running production instance.

---

## 📋 Table of Contents

1. [Oracle Cloud Free Tier Specs & Limits](#1-oracle-cloud-free-tier-specs--limits)
2. [Initial VPS Setup](#2-initial-vps-setup)
3. [Install Node.js, FFmpeg & Dependencies](#3-install-nodejs-ffmpeg--dependencies)
4. [Clone & Configure the Application](#4-clone--configure-the-application)
5. [Set Up SQLite Database](#5-set-up-sqlite-database)
6. [Build & Test the Backend](#6-build--test-the-backend)
7. [Build the Frontend](#7-build-the-frontend)
8. [Process Manager — PM2](#8-process-manager--pm2)
9. [Nginx Reverse Proxy](#9-nginx-reverse-proxy)
10. [SSL Certificate — Let's Encrypt](#10-ssl-certificate--lets-encrypt)
11. [Frontend via Static Serve (Alternative)](#11-frontend-via-static-serve-alternative)
12. [Free Domain Options](#12-free-domain-options)
13. [Monitoring & Maintenance](#13-monitoring--maintenance)
14. [Realistic Expectations](#14-realistic-expectations)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Oracle Cloud Free Tier Specs & Limits

Oracle Cloud's **Always Free** tier includes:

| Resource | AMD Shape (VM.Standard.E2.1.Micro) | ARM Shape (VM.Standard.A1.Flex) |
|----------|-----------------------------------|-------------------------------|
| vCPUs | 1 (OCPU = 1 core) | Up to **4** (arm64) |
| RAM | **1 GB** | **24 GB** (shared across all ARM VMs) |
| Disk | **200 GB** (block storage, boot volume) | Same 200 GB |
| Network | 1 Gbps, 10 TB/month outbound | 1 Gbps, 10 TB/month outbound |

**Key limitations:**
- **Total AMD + ARM:** You can have **2 AMD instances** + up to **4 ARM instances** (total of 4 OCPUs across all ARM)
- **Disk:** 200 GB total (shared across all block volumes)
- **RAM:** 24 GB total across all ARM instances, 1 GB for AMD
- **No GPU** — all processing is CPU-based
- **Outbound data:** 10 TB/month (very generous)

**Recommendation for ClipHunter AI:**  
Use **1 AMD instance** for the Node.js backend + Nginx. The 1 GB RAM is tight but sufficient for:
- Express server + Prisma (SQLite)
- Vosk speech-to-text model (loads ~500 MB into RAM)
- FFmpeg video processing

> ⚠️ **Heads-up:** If 1 GB RAM proves too tight for Vosk + FFmpeg simultaneously, switch to an ARM instance with more RAM (you get 4 ARM OCPUs and 24 GB RAM for free).

---

## 2. Initial VPS Setup

### 2.1 Create an Oracle Cloud Account

1. Go to [cloud.oracle.com](https://cloud.oracle.com)
2. Sign up for the **Free Tier** (requires a credit card for identity verification — you will **not** be charged)
3. Wait for your tenancy to be provisioned (usually 1–5 minutes)

### 2.2 Launch a VM Instance

1. From the Oracle Cloud Console, navigate to **Compute → Instances**
2. Click **Create Instance**
3. Configure:
   - **Name:** `cliphunter`
   - **Image:** Canonical Ubuntu 22.04 (Minimal is fine)
   - **Shape:** VM.Standard.E2.1.Micro (AMD)
   - **Add SSH keys:** Download or paste your public SSH key
   - **Boot volume:** 50 GB (you get 200 GB free, but 50 GB is plenty)
4. Click **Create**

### 2.3 Open Firewall Ports

In the instance's VCN (Virtual Cloud Network):

1. Go to **Networking → Virtual Cloud Networks**
2. Click your VCN → **Security Lists → Default Security List**
3. Click **Add Ingress Rules** and add:

| Source Type | Source | Protocol | Port | Description |
|-------------|--------|----------|------|-------------|
| CIDR | `0.0.0.0/0` | TCP | 22 | SSH |
| CIDR | `0.0.0.0/0` | TCP | 80 | HTTP |
| CIDR | `0.0.0.0/0` | TCP | 443 | HTTPS |
| CIDR | `0.0.0.0/0` | TCP | 3000 | Next.js dev (optional, temporary) |
| CIDR | `0.0.0.0/0` | TCP | 5000 | Backend API (optional, temporary) |

> 🔒 **In production**, you only need ports 22, 80, 443. Ports 3000 and 5000 are for initial testing.

### 2.4 Connect to Your Server

```bash
ssh -i ~/.ssh/your_key ubuntu@<YOUR_SERVER_IP>
```

### 2.5 Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip build-essential
```

---

## 3. Install Node.js, FFmpeg & Dependencies

### 3.1 Install Node.js 22 (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # Should show v22.x
npm -v    # Should show 10.x
```

### 3.2 Install FFmpeg

```bash
sudo apt install -y ffmpeg
ffmpeg -version   # Should show ffmpeg version with libx264 support
```

### 3.3 Install Vosk Speech Model

Vosk is used for local speech-to-text. Download a small English model (~42 MB):

```bash
cd ~
mkdir -p vosk-models && cd vosk-models
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip
rm vosk-model-small-en-us-0.15.zip
echo "Vosk model downloaded to: ~/vosk-models/vosk-model-small-en-us-0.15"
```

> **Larger (more accurate) models:** Available at https://alphacephei.com/vosk/models  
> `vosk-model-en-us-0.22` (~1.5 GB) is more accurate but uses more RAM.

### 3.4 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 --version
```

Make PM2 auto-start on reboot:

```bash
pm2 startup systemd
# Copy and run the command it outputs
```

---

## 4. Clone & Configure the Application

### 4.1 Clone the Repository

> If your code is on GitHub/GitLab:
```bash
cd ~
git clone <YOUR_REPO_URL> cliphunter
cd cliphunter
```

> If transferring from your local machine:
```bash
# On your local machine:
cd cliphunter-ai
zip -r ../cliphunter.zip . -x "node_modules/*" -x ".git/*" -x "backend/prisma/dev.db" -x "frontend/.next/*"
scp -i ~/.ssh/your_key ../cliphunter.zip ubuntu@<YOUR_SERVER_IP>:~/

# On the server:
cd ~
unzip cliphunter.zip -d cliphunter
cd cliphunter
```

### 4.2 Create Environment File

```bash
cd ~/cliphunter/backend
cp .env.example .env
nano .env
```

Edit `.env` with these values:

```env
# ─── Server ────────────────────────────────────────
PORT=5000
NODE_ENV=production
LOG_LEVEL=info

# ─── Database (SQLite — file-based, zero config) ───
DATABASE_URL="file:./dev.db"

# ─── Auth ──────────────────────────────────────────
JWT_SECRET=<GENERATE_A_STRONG_SECRET>
JWT_EXPIRES_IN=7d

# ─── Vosk Speech-to-Text ──────────────────────────
VOSK_MODEL_PATH=/home/ubuntu/vosk-models/vosk-model-small-en-us-0.15

# ─── Cleanup (safety limits) ──────────────────────
MAX_QUEUE_SIZE=10
CLIP_RETENTION_DAYS=14
VIDEO_RETENTION_DAYS=30
CLEANUP_INTERVAL_HOURS=24
```

**Generate a JWT secret:**
```bash
# Run this on the server to generate a random 64-char string:
openssl rand -hex 32
```

### 4.3 Verify Directory Permissions

```bash
cd ~/cliphunter/backend
mkdir -p uploads generated-clips
chmod 755 uploads generated-clips
```

---

## 5. Set Up SQLite Database

```bash
cd ~/cliphunter/backend
npm install
npx prisma generate
npx prisma migrate deploy
```

This creates `backend/prisma/dev.db` — the SQLite database file.

> SQLite is perfect for a small VPS: zero configuration, no separate database process, all data in one file.

---

## 6. Build & Test the Backend

### 6.1 Build TypeScript

```bash
cd ~/cliphunter/backend
npm run build
```

### 6.2 Start & Test

```bash
node dist/index.js
```

In another terminal:
```bash
curl http://localhost:5000/health
# Should return: {"status":"ok","timestamp":"...","uptime":...}
```

Test registration:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

Stop the server with `Ctrl+C`.

---

## 7. Build the Frontend

```bash
cd ~/cliphunter/frontend
npm install
npm run build
```

The frontend is a Next.js app that builds into `.next/`. We'll serve it via Nginx as a reverse proxy (see below).

---

## 8. Process Manager — PM2

### 8.1 Start the Backend

```bash
cd ~/cliphunter/backend
pm2 start dist/index.js --name cliphunter-api \
  --max-memory-restart 800M \
  --kill-timeout 10000
```

| Flag | Purpose |
|------|---------|
| `--name` | Give the process a recognizable name |
| `--max-memory-restart 800M` | Auto-restart if process exceeds 800 MB RAM |
| `--kill-timeout 10000` | Wait 10s for graceful shutdown before force-kill |

### 8.2 Save PM2 Process List

```bash
pm2 save
```

### 8.3 Useful PM2 Commands

```bash
pm2 status                  # List all processes
pm2 logs cliphunter-api     # Watch logs in real-time
pm2 logs cliphunter-api --lines 100  # Last 100 log lines
pm2 restart cliphunter-api  # Restart the backend
pm2 stop cliphunter-api     # Stop the backend
pm2 monitor                 # Dashboard (CPU, memory per process)
```

---

## 9. Nginx Reverse Proxy

### 9.1 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 9.2 Configure Nginx for ClipHunter

Create a new Nginx config:

```bash
sudo nano /etc/nginx/sites-available/cliphunter
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com <YOUR_SERVER_IP>;

    # ─── Security headers ──────────────────────────
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ─── Frontend (Next.js static export or proxy) ─
    location / {
        proxy_pass http://localhost:3000;  # If running Next.js as a service
        # -- OR use static export below --
        # root /home/ubuntu/cliphunter/frontend/out;
        # index index.html;
        # try_files $uri $uri.html $uri/ /index.html;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # ─── Backend API ───────────────────────────────
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeouts for long video processing
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        
        # Increase max body size (for video uploads)
        client_max_body_size 300M;
    }

    # ─── Serve uploaded files ──────────────────────
    location /uploads/ {
        alias /home/ubuntu/cliphunter/backend/uploads/;
        add_header Cache-Control "public, max-age=86400";
    }

    location /generated-clips/ {
        alias /home/ubuntu/cliphunter/backend/generated-clips/;
        add_header Cache-Control "public, max-age=86400";
    }
}
```

### 9.3 Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/cliphunter /etc/nginx/sites-enabled/
sudo nginx -t               # Test configuration
sudo systemctl reload nginx  # Apply changes
```

---

## 10. SSL Certificate — Let's Encrypt

### 10.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 10.2 Get a Certificate

If you have a domain:
```bash
sudo certbot --nginx -d your-domain.com
```

If you only have an IP address (no domain):
```bash
# Self-signed certificate (browsers will show a warning)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/cliphunter.key \
  -out /etc/ssl/certs/cliphunter.crt

# Then create a separate Nginx config for HTTPS
sudo nano /etc/nginx/sites-available/cliphunter-ssl
```

### 10.3 Auto-Renewal

Certbot sets up auto-renewal by default. Verify:

```bash
sudo certbot renew --dry-run
```

---

## 11. Frontend via Static Serve (Alternative)

If you don't want to run Next.js as a service, export a static build:

### 11.1 On the Server

```bash
cd ~/cliphunter/frontend

# If using next export (requires output: export in next.config.ts):
npm run build
# Check if there's an 'out/' directory with static files
```

### 11.2 Update Nginx Config

Use this for the `location /` block instead:

```nginx
location / {
    root /home/ubuntu/cliphunter/frontend/out;
    index index.html;
    try_files $uri $uri.html $uri/ /index.html;
    
    # Don't proxy — serve static files directly
}
```

> **Note:** Static export loses SSR/ISR benefits but uses less RAM.

---

## 12. Free Domain Options

| Service | Type | Notes |
|---------|------|-------|
| [freenom.com](https://freenom.com) | Free domain (.tk, .ml, .ga, .cf, .gq) | Requires yearly renewal |
| [duckdns.org](https://duckdns.org) | Free dynamic DNS (yourdomain.duckdns.org) | Works with Let's Encrypt |
| [nip.io](https://nip.io) | Magic DNS (10.0.0.1.nip.io → 10.0.0.1) | No registration needed |
| [sslip.io](https://sslip.io) | Similar to nip.io | No registration needed |

**For Let's Encrypt SSL**, you need an actual domain. DuckDNS works great and is free.

---

## 13. Monitoring & Maintenance

### 13.1 Check Disk Usage

```bash
df -h /                    # Overall disk usage
du -sh ~/cliphunter/backend/uploads/           # Uploads size
du -sh ~/cliphunter/backend/generated-clips/   # Clips size
```

### 13.2 Check System Resources

```bash
htop                      # Real-time CPU & memory (install: sudo apt install htop)
pm2 monit                 # PM2 dashboard
sudo journalctl -u nginx  # Nginx logs
```

### 13.3 Backup the Database

SQLite = single file. Backup is trivial:

```bash
# Create a daily backup cron job
sudo crontab -e
# Add this line to run at 3 AM daily:
0 3 * * * cp /home/ubuntu/cliphunter/backend/prisma/dev.db /home/ubuntu/backups/dev.db.$(date +\%Y\%m\%d)
```

### 13.4 Update the Application

```bash
cd ~/cliphunter
git pull
cd backend && npm install && npm run build
pm2 restart cliphunter-api
cd ../frontend && npm install && npm run build
```

---

## 14. Realistic Expectations

### 14.1 How Many Concurrent Users Can This Handle?

| Scenario | Users | Notes |
|----------|-------|-------|
| **Browsing highlights gallery / downloads** | 10–20 concurrent | Nginx caches static assets, API calls are lightweight |
| **Uploading a video** | 1–2 concurrent | FFmpeg + Vosk processing uses 1 CPU core fully; only 1 job runs at a time |
| **Analyzing / transcribing** | 1 at a time | Queue processes one job; others wait |
| **Downloading clips** | 3–5 concurrent | File serving is cheap; mainly I/O bound |
| **Admin browsing** | 1–2 concurrent | Dashboard queries are lightweight SQL |

**Real-world total:** ~15–30 **active daily users** (DAU) with occasional use, or  
**~5–10 power users** uploading and processing videos regularly.

### 14.2 What Will Break First?

| Warning Sign | What's Happening | What To Do |
|-------------|-----------------|------------|
| **CPU 100% for minutes** | FFmpeg transcoding maxes out 1 vCPU | Users can still browse; uploads go to queue. Acceptable. |
| **RAM > 80% (800 MB+)** | Vosk model + Node.js + FFmpeg competing | Switch to ARM shape (24 GB RAM free) |
| **Disk usage > 80%** | Generated clips accumulating | Check cleanup is running; reduce `CLIP_RETENTION_DAYS` |
| **API response > 2 seconds** | N+1 queries or SQLite lock contention | Add indexes; consider SQLite WAL mode |
| **Queue consistently full** | More uploads than processing capacity | Scale up or reduce `MAX_QUEUE_SIZE` |
| **Outbound bandwidth > 8 TB/month** | Many large video downloads | Offer lower quality defaults; compress clips |

### 14.3 Performance Benchmarks (Oracle Free AMD)

| Operation | Time | Notes |
|-----------|------|-------|
| Transcribe 5-min video (small model) | ~3–5 min | Vosk small model, CPU-bound |
| Transcribe 5-min video (large model) | ~8–15 min | More accurate, uses more RAM |
| Generate 30s clip (720p) | ~30–60s | FFmpeg encoding |
| Generate 30s clip (1080p) | ~1–3 min | Higher resolution = more pixels |
| Thumbnail generation | ~2–5s | Single frame extraction |
| SQLite query (simple) | <50ms | Even with thousands of records |

### 14.4 When to Upgrade

Consider upgrading to a paid VPS (or a larger free ARM instance) when:

1. **CPU stays at 100% for >30 minutes** — queue is backing up
2. **Disk is consistently >70% full** — even after cleanup
3. **Users report slow page loads** — Node.js can't keep up
4. **You need concurrent video processing** — more CPUs/cores needed
5. **SQLite writes block reads** — hundreds of concurrent users hitting the same DB

### 14.5 Free Upgrade Paths (No Payment Needed)

| Step | Action | Benefit |
|------|--------|---------|
| 1 | Move to **ARM shape** (4 OCPUs, 24 GB RAM) | 4× more processing power |
| 2 | Add a **second AMD instance** for Nginx/static files | Separate serving from processing |
| 3 | Use **Object Storage** (Oracle free tier: 20 GB) | Offload old media files |
| 4 | **Reduce model size** → switch to smaller Vosk model | Frees RAM for more Node.js workers |

---

## 15. Troubleshooting

### "Cannot find module 'xyz'"

```bash
cd ~/cliphunter/backend && npm install && npm run build
cd ~/cliphunter/frontend && npm install && npm run build
```

### "Port 5000 already in use"

```bash
sudo lsof -i :5000   # Find what's using the port
pm2 stop cliphunter-api && pm2 delete cliphunter-api
```

### "Nginx fails to start"

```bash
sudo nginx -t   # Check config syntax
sudo systemctl status nginx   # See error messages
```

### "SQLite database is locked"

```bash
# This happens during concurrent writes. Switch to WAL mode:
sqlite3 ~/cliphunter/backend/prisma/dev.db "PRAGMA journal_mode=WAL;"
```

### "FFmpeg not found" in clip generation

```bash
which ffmpeg   # Should show /usr/bin/ffmpeg
ffmpeg -version
```

### "Vosk model not loading"

```bash
# Verify the model path:
ls -la ~/vosk-models/vosk-model-small-en-us-0.15/
# Should show files like: am/, conf/, ivector.conf, ...

# Check .env VOSK_MODEL_PATH is set correctly
cat ~/cliphunter/backend/.env | grep VOSK
```

---

## ✅ Quick Start Checklist

- [ ] Oracle Cloud VM is running (Ubuntu 22.04)
- [ ] SSH key configured, can connect
- [ ] Ports 22, 80, 443 open in firewall
- [ ] Node.js 22 installed
- [ ] FFmpeg installed (with libx264)
- [ ] Vosk model downloaded
- [ ] PM2 installed and startup configured
- [ ] Repository cloned
- [ ] `.env` file configured with secure JWT secret
- [ ] `npm install` in both `backend/` and `frontend/`
- [ ] Prisma migration applied (database created)
- [ ] Backend builds and starts successfully
- [ ] Frontend builds successfully
- [ ] PM2 manages the backend process
- [ ] Nginx configured as reverse proxy
- [ ] SSL certificate installed (or self-signed)
- [ ] Server accessible from browser
- [ ] `/health` endpoint returns `{"status":"ok"}`
- [ ] Can register, login, upload a video

---

**Maintained by the ClipHunter AI team** — free to use, free to deploy, forever. 🎯
