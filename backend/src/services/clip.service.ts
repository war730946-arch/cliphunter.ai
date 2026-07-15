/**
 * Clip generation and management service.
 * Uses FFmpeg for all video operations — no cloud storage, no external APIs.
 *
 * Features:
 *   - Extract clips with start/end times
 *   - Crop to 16:9, 9:16, or 1:1 aspect ratios
 *   - Generate thumbnails
 *   - Generate short previews (10s)
 *   - Quality options: 720p, 1080p
 *   - Auto-cleanup of temp files
 */

import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";

// ─── Types ───────────────────────────────────────────────

export type AspectRatio = "16:9" | "9:16" | "1:1";
export type Quality = "720p" | "1080p";

export interface ClipGenerationOptions {
  /** Path to the source video file */
  sourcePath: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Desired duration in seconds (overrides endTime if shorter) */
  duration?: number;
  /** Aspect ratio for cropping */
  aspectRatio: AspectRatio;
  /** Output quality */
  quality: Quality;
  /** Output directory */
  outputDir: string;
}

export interface ClipResult {
  filePath: string;
  thumbnailPath: string;
  previewPath: string;
  duration: number;
  size: number;
}

// ─── Constants ───────────────────────────────────────────

const CLIPS_DIR = path.join(__dirname, "..", "..", "generated-clips");

const ASPECT_RATIO_FILTERS: Record<AspectRatio, string> = {
  "16:9": "crop=iw:iw*9/16",       // Landscape
  "9:16": "crop=ih*9/16:ih",       // Vertical / TikTok-style
  "1:1":  "crop=iw:iw",            // Square (crop to width)
};

const QUALITY_FLAGS: Record<Quality, string> = {
  "720p":  "-vf scale=-2:720 -c:v libx264 -preset medium -crf 23",
  "1080p": "-vf scale=-2:1080 -c:v libx264 -preset medium -crf 23",
};

// ─── Helper ──────────────────────────────────────────────

function execAsync(cmd: string, timeoutMs = 300000): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs, maxBuffer: 500 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(new Error(`Command failed: ${cmd}\n${err.message}`));
      else resolve(stdout);
    });
  });
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Build the FFmpeg crop filter based on aspect ratio.
 * Detects input video dimensions first for accurate cropping.
 */
async function buildCropFilter(sourcePath: string, aspectRatio: AspectRatio): Promise<string> {
  if (aspectRatio === "16:9") {
    // 16:9 is the default — no cropping needed in most cases
    return "";
  }

  // Get video dimensions via FFprobe
  try {
    const probeOut = await execAsync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${sourcePath}"`,
      10000
    );
    const parts = probeOut.trim().split(",");
    const width = parseInt(parts[0], 10);
    const height = parseInt(parts[1], 10);

    if (!width || !height) return ASPECT_RATIO_FILTERS[aspectRatio];

    if (aspectRatio === "9:16") {
      // Vertical: width = height * 9/16
      const newWidth = Math.floor(height * 9 / 16);
      if (newWidth > width) return ""; // Can't crop wider than source
      const xOffset = Math.floor((width - newWidth) / 2);
      return `crop=${newWidth}:${height}:${xOffset}:0`;
    } else if (aspectRatio === "1:1") {
      // Square: crop to min(width, height)
      const size = Math.min(width, height);
      const xOffset = Math.floor((width - size) / 2);
      const yOffset = Math.floor((height - size) / 2);
      return `crop=${size}:${size}:${xOffset}:${yOffset}`;
    }
  } catch {
    // Fallback to generic filter
    return ASPECT_RATIO_FILTERS[aspectRatio];
  }

  return "";
}

/**
 * Generate a thumbnail at the midpoint of the clip.
 */
async function generateThumbnail(
  sourcePath: string,
  timeSeconds: number,
  outputPath: string
): Promise<string> {
  const timeStr = formatTime(timeSeconds);
  await execAsync(
    `ffmpeg -y -ss ${timeStr} -i "${sourcePath}" -vframes 1 -q:v 2 "${outputPath}"`,
    60000
  );
  logger.debug(`Thumbnail generated: ${outputPath}`);
  return outputPath;
}

/**
 * Generate a 10-second preview from the clip.
 */
async function generatePreview(
  sourcePath: string,
  startTime: number,
  outputPath: string
): Promise<string> {
  const timeStr = formatTime(startTime);
  await execAsync(
    `ffmpeg -y -ss ${timeStr} -i "${sourcePath}" -t 10 -c:v libx264 -preset ultrafast -crf 28 -c:a aac "${outputPath}"`,
    120000
  );
  logger.debug(`Preview generated: ${outputPath}`);
  return outputPath;
}

// ─── Service Class ───────────────────────────────────────

export class ClipService {
  /**
   * Generate a clip from a source video.
   *
   * The full pipeline:
   *   1. Extract clip segment with FFmpeg (trim + crop + quality)
   *   2. Generate a thumbnail (midpoint frame)
   *   3. Generate a 10-second preview
   *   4. Report file size
   *
   * Temp intermediate files are cleaned up automatically.
   */
  async generateClip(options: ClipGenerationOptions): Promise<ClipResult> {
    const {
      sourcePath,
      startTime,
      endTime,
      duration,
      aspectRatio,
      quality,
      outputDir,
    } = options;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const clipId = uuidv4();
    const actualEnd = duration ? Math.min(startTime + duration, endTime) : endTime;
    const clipDuration = actualEnd - startTime;

    if (clipDuration <= 0) {
      throw new Error("Clip duration must be greater than 0 seconds");
    }

    if (clipDuration > 300) {
      throw new Error("Clip duration cannot exceed 5 minutes (300 seconds)");
    }

    // ── Step 1: Extract & process the clip ─────────────
    const clipPath = path.join(outputDir, `${clipId}.mp4`);
    const startStr = formatTime(startTime);
    const endStr = formatTime(actualEnd);

    // Build the crop filter if needed
    const cropFilter = await buildCropFilter(sourcePath, aspectRatio);

    let ffmpegCmd: string;

    if (cropFilter) {
      // With cropping
      ffmpegCmd =
        `ffmpeg -y -ss ${startStr} -i "${sourcePath}" -to ${endStr} ` +
        `-vf "${cropFilter}" ${QUALITY_FLAGS[quality]} -c:a aac -movflags +faststart "${clipPath}"`;
    } else {
      // No cropping (16:9 or native ratio) — fast stream copy
      ffmpegCmd =
        `ffmpeg -y -ss ${startStr} -i "${sourcePath}" -to ${endStr} ` +
        `${QUALITY_FLAGS[quality]} -c:a aac -movflags +faststart "${clipPath}"`;
    }

    logger.info(`Generating clip: ${clipId} (${startStr} → ${endStr}, ${aspectRatio}, ${quality})`);
    await execAsync(ffmpegCmd, 600000);
    logger.info(`Clip extracted: ${clipPath}`);

    // ── Step 2: Generate thumbnail at midpoint ─────────
    const thumbnailTime = startTime + clipDuration / 2;
    const thumbnailPath = path.join(outputDir, `${clipId}_thumb.jpg`);
    await generateThumbnail(clipPath, clipDuration / 2, thumbnailPath);

    // ── Step 3: Generate preview (first 10s of clip) ───
    const previewPath = path.join(outputDir, `${clipId}_preview.mp4`);
    await generatePreview(clipPath, 0, previewPath);

    // ── Step 4: Get file size ───────────────────────────
    const size = getFileSize(clipPath);

    logger.info(`Clip complete: ${clipId} (${(size / 1024 / 1024).toFixed(1)}MB)`);

    return {
      filePath: clipPath,
      thumbnailPath,
      previewPath,
      duration: clipDuration,
      size,
    };
  }

  /**
   * Delete clip files from disk.
   */
  cleanupClipFiles(filePath: string, thumbnailPath?: string, previewPath?: string): void {
    const files = [filePath, thumbnailPath, previewPath].filter(Boolean) as string[];
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          logger.debug(`Deleted clip file: ${file}`);
        }
      } catch (err) {
        logger.warn(`Could not delete clip file ${file}: ${err}`);
      }
    }
  }

  /**
   * Get the directory where generated clips are stored.
   */
  getClipsDir(): string {
    if (!fs.existsSync(CLIPS_DIR)) {
      fs.mkdirSync(CLIPS_DIR, { recursive: true });
    }
    return CLIPS_DIR;
  }

  /**
   * Re-encode a clip to a different quality for download.
   */
  async reencodeForDownload(
    sourcePath: string,
    quality: Quality,
    outputPath: string
  ): Promise<string> {
    logger.info(`Re-encoding clip for download: ${quality}`);
    await execAsync(
      `ffmpeg -y -i "${sourcePath}" ${QUALITY_FLAGS[quality]} -c:a aac -movflags +faststart "${outputPath}"`,
      300000
    );
    return outputPath;
  }
}

export const clipService = new ClipService();
