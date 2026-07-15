/**
 * Clip controller — handles clip generation, listing, retrieval, and deletion.
 */

import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import prisma from "../lib/prisma";
import { clipService } from "../services/clip.service";
import { videoService } from "../services/video.service";
import { AppError } from "../middlewares/error.middleware";
import { logger } from "../utils/logger";

const OUTPUT_DIR = path.join(__dirname, "..", "..", "generated-clips");

/**
 * POST /api/clips/generate
 * Generate a clip from a highlight
 *
 * Body: { video_id, highlight_id, duration?, custom_start?, custom_end?, aspect_ratio, quality? }
 */
export async function generateClip(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const {
      video_id,
      highlight_id,
      duration,       // "15" | "30" | "45" | "60" | "custom"
      custom_start,   // for custom duration
      custom_end,     // for custom duration
      aspect_ratio,   // "16:9" | "9:16" | "1:1"
      quality,        // "720p" | "1080p"
    } = req.body;

    // ─── Validation ─────────────────────────────────────
    if (!video_id) throw new AppError("video_id is required", 400);
    if (!highlight_id) throw new AppError("highlight_id is required", 400);
    if (!aspect_ratio) throw new AppError("aspect_ratio is required (16:9, 9:16, or 1:1)", 400);

    const validRatios = ["16:9", "9:16", "1:1"];
    if (!validRatios.includes(aspect_ratio)) {
      throw new AppError(`Invalid aspect_ratio. Must be one of: ${validRatios.join(", ")}`, 400);
    }

    const clipQuality = (quality || "720p") as "720p" | "1080p";
    if (!["720p", "1080p"].includes(clipQuality)) {
      throw new AppError("Invalid quality. Must be '720p' or '1080p'", 400);
    }

    // ─── Verify video & highlight ownership ─────────────
    const video = await prisma.video.findFirst({
      where: { id: video_id, user_id: userId },
    });
    if (!video) throw new AppError("Video not found", 404);

    const highlight = await prisma.highlight.findFirst({
      where: { id: highlight_id, video_id, user_id: userId },
    });
    if (!highlight) throw new AppError("Highlight not found", 404);

    // ─── Determine clip boundaries ──────────────────────
    const validDurations = [15, 30, 45, 60];
    let clipDuration: number;
    let startTime: number;
    let endTime: number;

    if (duration === "custom") {
      // Custom: use custom_start and custom_end
      if (custom_start === undefined || custom_end === undefined) {
        throw new AppError("custom_start and custom_end are required for custom duration", 400);
      }
      startTime = Math.max(highlight.start_time, parseFloat(custom_start));
      endTime = Math.min(highlight.end_time, parseFloat(custom_end));
      clipDuration = endTime - startTime;
    } else {
      clipDuration = duration ? parseInt(duration, 10) : 30;
      if (!validDurations.includes(clipDuration)) {
        throw new AppError(`Invalid duration. Choose: ${validDurations.join("s, ")}s or 'custom'`, 400);
      }
      startTime = highlight.start_time;
      endTime = Math.min(highlight.start_time + clipDuration, highlight.end_time);
      clipDuration = endTime - startTime;
    }

    if (clipDuration <= 0) {
      throw new AppError("Clip duration must be greater than 0", 400);
    }
    if (clipDuration > 300) {
      throw new AppError("Clip duration cannot exceed 5 minutes", 400);
    }

    // ─── Get source video path ──────────────────────────
    const videoPath = video.file_url || video.source_url;
    if (!videoPath) {
      throw new AppError("No video file available for clip generation", 400);
    }

    // ─── Generate the clip ──────────────────────────────
    const result = await clipService.generateClip({
      sourcePath: videoPath,
      startTime,
      endTime,
      duration: clipDuration,
      aspectRatio: aspect_ratio as "16:9" | "9:16" | "1:1",
      quality: clipQuality,
      outputDir: OUTPUT_DIR,
    });

    // ─── Save to Clips table ────────────────────────────
    const clip = await prisma.clip.create({
      data: {
        video_id,
        highlight_id,
        user_id: userId,
        file_url: result.filePath,
        duration: result.duration,
        size: result.size,
      },
    });

    logger.info(`Clip generated: ${clip.id} (${clipDuration}s, ${aspect_ratio}, ${clipQuality})`);

    res.status(201).json({
      status: "success",
      data: {
        clip: {
          id: clip.id,
          video_id: clip.video_id,
          highlight_id: clip.highlight_id,
          duration: clip.duration,
          size: clip.size,
          file_url: clip.file_url,
          thumbnail_url: result.thumbnailPath,
          preview_url: result.previewPath,
          aspect_ratio,
          quality: clipQuality,
          created_at: clip.created_at,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/clips
 * List all clips for the authenticated user.
 */
export async function listClips(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { video_id } = req.query;

    const where: any = { user_id: userId };
    if (video_id) where.video_id = video_id as string;

    const clips = await prisma.clip.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        highlight: {
          select: { id: true, summary: true, start_time: true, end_time: true, score: true },
        },
        video: {
          select: { id: true, title: true, source_url: true },
        },
      },
    });

    res.json({
      status: "success",
      data: { clips, total: clips.length },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/clips/:id
 * Get a single clip by ID.
 */
export async function getClip(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const clip = await prisma.clip.findFirst({
      where: { id, user_id: userId },
      include: {
        highlight: {
          select: { id: true, summary: true, start_time: true, end_time: true, score: true },
        },
        video: {
          select: { id: true, title: true, source_url: true },
        },
      },
    });

    if (!clip) {
      throw new AppError("Clip not found", 404);
    }

    // Derive thumbnail and preview paths from clip path
    const basePath = clip.file_url ? clip.file_url.replace(/\.mp4$/, "") : "";
    const thumbnail = basePath ? `${basePath}_thumb.jpg` : null;
    const preview = basePath ? `${basePath}_preview.mp4` : null;

    res.json({
      status: "success",
      data: {
        clip: {
          ...clip,
          thumbnail_url: thumbnail,
          preview_url: preview,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/clips/:id
 * Delete a clip and its associated files.
 */
export async function deleteClip(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const clip = await prisma.clip.findFirst({
      where: { id, user_id: userId },
    });

    if (!clip) {
      throw new AppError("Clip not found", 404);
    }

    // Delete files from disk
    const basePath = clip.file_url ? clip.file_url.replace(/\.mp4$/, "") : "";
    clipService.cleanupClipFiles(
      clip.file_url || "",
      basePath ? `${basePath}_thumb.jpg` : undefined,
      basePath ? `${basePath}_preview.mp4` : undefined
    );

    // Delete from database
    await prisma.clip.delete({ where: { id } });

    logger.info(`Clip deleted: ${id}`);

    res.json({
      status: "success",
      data: { message: "Clip deleted successfully" },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/download/:id
 * Download a clip MP4 file with optional quality re-encoding.
 *
 * Query params:
 *   quality - "720p" (default) or "1080p"
 */
export async function downloadClip(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const targetQuality = (req.query.quality as string) || "720p";

    if (!["720p", "1080p"].includes(targetQuality)) {
      throw new AppError("Invalid quality. Must be '720p' or '1080p'", 400);
    }

    const clip = await prisma.clip.findFirst({
      where: { id, user_id: userId },
    });

    if (!clip || !clip.file_url) {
      throw new AppError("Clip not found", 404);
    }

    if (!fs.existsSync(clip.file_url)) {
      throw new AppError("Clip file not found on disk", 404);
    }

    // If the clip is already at the desired quality (or higher), serve directly
    // Otherwise re-encode
    const downloadId = `download_${id}_${targetQuality}`;
    const downloadPath = path.join(OUTPUT_DIR, `${downloadId}.mp4`);

    let fileToServe: string;

    if (fs.existsSync(downloadPath)) {
      // Cached — serve directly
      fileToServe = downloadPath;
    } else if (targetQuality === "720p") {
      // Quality matches or we serve the source directly
      fileToServe = clip.file_url;
    } else {
      // Re-encode to 1080p
      await clipService.reencodeForDownload(clip.file_url, targetQuality as "720p" | "1080p", downloadPath);
      fileToServe = downloadPath;
    }

    const fileName = `clip_${id}_${targetQuality}.mp4`;

    res.download(fileToServe, fileName, (err) => {
      if (err) {
        logger.error(`Download failed for clip ${id}:`, err);
        if (!res.headersSent) {
          next(new AppError("Download failed", 500));
        }
      }
    });
  } catch (err) {
    next(err);
  }
}
