import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import apiRouter from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { logger } from "./utils/logger";
import prisma from "./lib/prisma";
import { videoService } from "./services/video.service";
import { transcriptionService } from "./services/transcription.service";
import { startCleanupScheduler } from "./services/cleanup.service";

// ─── Load environment variables ────────────────────────
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security & Parsing Middleware ──────────────────────
app.use(helmet());

// Trust the first proxy (Nginx) so req.ip reflects real client IP for rate limiting
app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ─── Static file serving ────────────────────────────────
const uploadsDir = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadsDir));

const generatedClipsDir = path.join(__dirname, "..", "generated-clips");
app.use("/generated-clips", express.static(generatedClipsDir));

// ─── Routes ────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use("/api", apiRouter);

// ─── Error handling ────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Initialize Prisma & Start Server ──────────────────
async function startup() {
  // 1. Ensure required directories exist
  for (const dir of [uploadsDir, generatedClipsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`📁 Created directory: ${dir}`);
    }
  }

  // 2. Connect to database
  await prisma.$connect();
  logger.info("🗄️  SQLite database connected via Prisma");

  // 3. Initialize transcription service (Vosk model)
  await transcriptionService.initialize();

  // 4. Reset any jobs that were stuck in "processing" on last shutdown
  const resetCount = await videoService.resetStuckJobs();
  if (resetCount > 0) {
    logger.info(`♻️  Reset ${resetCount} stuck job(s) from 'processing' to 'pending'`);
  }

  // 5. Start the cleanup scheduler (removes old files periodically)
  startCleanupScheduler();

  // 6. Start the server
  app.listen(PORT, () => {
    logger.info(`🚀 ClipHunter AI backend running at http://localhost:${PORT}`);
    logger.info(`📦 Environment: ${process.env.NODE_ENV || "development"}`);
    logger.info(`🎬 Uploads served at /uploads`);
    logger.info(`🎬 Generated clips served at /generated-clips`);
  });
}

startup().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
