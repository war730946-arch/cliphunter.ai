/**
 * Cleanup Service — scheduled task that removes old generated clips and uploaded videos
 * to prevent disk space exhaustion on a small free-tier VPS.
 *
 * Runs on startup and then every CLEANUP_INTERVAL_HOURS (default: 24).
 */

import fs from "fs";
import path from "path";
import prisma from "../lib/prisma";
import { logger } from "../utils/logger";

// ─── Configuration (from env, with sensible defaults) ───
const CLIP_RETENTION_DAYS = parseInt(process.env.CLIP_RETENTION_DAYS || "14", 10);
const VIDEO_RETENTION_DAYS = parseInt(process.env.VIDEO_RETENTION_DAYS || "30", 10);
const CLEANUP_INTERVAL_HOURS = parseInt(process.env.CLEANUP_INTERVAL_HOURS || "24", 10);

// ─── Helpers ─────────────────────────────────────────────

function isOlderThan(filePath: string, days: number): boolean {
  try {
    const stats = fs.statSync(filePath);
    const ageMs = Date.now() - stats.mtimeMs;
    return ageMs > days * 24 * 60 * 60 * 1000;
  } catch {
    return false; // File doesn't exist, skip
  }
}

function safeDelete(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    logger.warn(`Cleanup: could not delete ${filePath}: ${err}`);
  }
  return false;
}

// ─── Core cleanup logic ──────────────────────────────────

async function cleanOldGeneratedClips(): Promise<number> {
  const cutoff = new Date(Date.now() - CLIP_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const oldClips = await prisma.clip.findMany({
    where: { created_at: { lt: cutoff } },
    select: { id: true, file_url: true },
  });

  let deletedCount = 0;

  for (const clip of oldClips) {
    // Delete the actual MP4 file
    if (clip.file_url) {
      const basePath = clip.file_url.replace(/\.mp4$/, "");
      safeDelete(clip.file_url);
      safeDelete(`${basePath}_thumb.jpg`);
      safeDelete(`${basePath}_preview.mp4`);
    }

    // Delete the database record
    await prisma.clip.delete({ where: { id: clip.id } });
    deletedCount++;
  }

  if (deletedCount > 0) {
    logger.info(`Cleanup: deleted ${deletedCount} old clip(s) (≥${CLIP_RETENTION_DAYS}d old)`);
  }

  return deletedCount;
}

async function cleanOldUploadedVideos(): Promise<number> {
  const cutoff = new Date(Date.now() - VIDEO_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const oldVideos = await prisma.video.findMany({
    where: { created_at: { lt: cutoff } },
    select: { id: true, file_url: true },
  });

  let deletedCount = 0;

  for (const video of oldVideos) {
    // Delete the uploaded file from disk
    if (video.file_url) {
      safeDelete(video.file_url);
    }

    // Delete the database record (cascades to jobs, transcripts, highlights, clips)
    await prisma.video.delete({ where: { id: video.id } });
    deletedCount++;
  }

  if (deletedCount > 0) {
    logger.info(`Cleanup: deleted ${deletedCount} old video(s) (≥${VIDEO_RETENTION_DAYS}d old)`);
  }

  return deletedCount;
}

async function cleanOrphanedFiles(): Promise<number> {
  // Find files in uploads/ and generated-clips/ directories that have no
  // corresponding database record (leftovers from crashes or partial uploads)
  const dirs = [
    path.join(__dirname, "..", "..", "uploads"),
    path.join(__dirname, "..", "..", "generated-clips"),
  ];

  let cleanedCount = 0;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);

      // Skip directories and .gitkeep
      if (fs.statSync(filePath).isDirectory()) continue;
      if (file === ".gitkeep") continue;

      // Check if any database record references this file
      const clipRef = await prisma.clip.findFirst({
        where: { file_url: { contains: file } },
      });
      const videoRef = await prisma.video.findFirst({
        where: { file_url: { contains: file } },
      });

      if (!clipRef && !videoRef) {
        safeDelete(filePath);
        cleanedCount++;
      }
    }
  }

  if (cleanedCount > 0) {
    logger.info(`Cleanup: removed ${cleanedCount} orphaned file(s) with no database reference`);
  }

  return cleanedCount;
}

// ─── Public API ──────────────────────────────────────────

/**
 * Run a full cleanup cycle: old clips → old videos → orphaned files.
 */
export async function runCleanupCycle(): Promise<{
  clipsDeleted: number;
  videosDeleted: number;
  orphansCleaned: number;
}> {
  logger.info("🧹 Starting cleanup cycle...");

  const clipsDeleted = await cleanOldGeneratedClips();
  const videosDeleted = await cleanOldUploadedVideos();
  const orphansCleaned = await cleanOrphanedFiles();

  const total = clipsDeleted + videosDeleted + orphansCleaned;
  if (total === 0) {
    logger.info("🧹 Cleanup cycle complete — nothing to clean.");
  }

  return { clipsDeleted, videosDeleted, orphansCleaned };
}

/**
 * Start the cleanup scheduler. Runs immediately on first call,
 * then every CLEANUP_INTERVAL_HOURS hours.
 */
export function startCleanupScheduler(): void {
  // Run once immediately
  runCleanupCycle().catch((err) => {
    logger.error("Cleanup cycle failed:", err);
  });

  // Schedule recurring runs
  const intervalMs = CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000;
  setInterval(() => {
    runCleanupCycle().catch((err) => {
      logger.error("Cleanup cycle failed:", err);
    });
  }, intervalMs);

  logger.info(`🧹 Cleanup scheduler started (every ${CLEANUP_INTERVAL_HOURS}h)`);
}
