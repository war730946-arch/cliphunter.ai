import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { videoService } from "../services/video.service";
import { processingQueue } from "../jobs/queue";
import { AppError } from "../middlewares/error.middleware";
import { videoUrlSchema } from "../validations/video.validation";
import { logger } from "../utils/logger";

/**
 * POST /api/videos
 * Accepts either a source_url (JSON) or a video file upload (multipart).
 */
export async function createVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const file = req.file;

    // ─── Determine submission type ────────────────────
    const isFileUpload = !!file;
    const sourceUrl = req.body.source_url?.trim();

    if (!isFileUpload && !sourceUrl) {
      throw new AppError(
        "Please provide either a video file to upload or a source_url for a web video.",
        400
      );
    }

    // ─── URL Submission ───────────────────────────────
    if (sourceUrl) {
      const parsed = videoUrlSchema.safeParse({ source_url: sourceUrl });
      if (!parsed.success) {
        const firstError = parsed.error.issues[0];
        throw new AppError(firstError.message, 400);
      }
    }

    // ─── Check job limit ──────────────────────────────
    const { allowed, reason } = await videoService.canEnqueueJob(userId);
    if (!allowed) {
      throw new AppError(reason!, 429);
    }

    // ─── Create the video record ──────────────────────
    const video = await videoService.createVideo(userId, {
      source_url: isFileUpload ? undefined : sourceUrl,
      file_url: isFileUpload ? (file ? file.path : undefined) : undefined,
      title: req.body.title || (file ? file.originalname : null),
      duration: null, // Will be extracted during processing
      thumbnail: null,
    });

    // ─── Enqueue processing job ───────────────────────
    processingQueue.add("process-video", { videoId: video.id, userId });

    logger.info(`Video submitted: ${video.id} (${isFileUpload ? "file" : "url"})`);

    res.status(201).json({
      status: "success",
      data: {
        video: {
          id: video.id,
          title: video.title,
          source_url: video.source_url,
          file_url: video.file_url,
          duration: video.duration,
          status: video.status,
          created_at: video.created_at,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/videos
 * List all videos for the authenticated user.
 */
export async function listVideos(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const videos = await videoService.listUserVideos(userId);

    res.json({
      status: "success",
      data: {
        videos,
        total: videos.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/videos/:id
 * Get a single video by ID.
 */
export async function getVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const video = await videoService.getVideoById(id, userId);

    if (!video) {
      throw new AppError("Video not found", 404);
    }

    res.json({
      status: "success",
      data: { video },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/videos/:id
 * Delete a video and its associated records.
 */
export async function deleteVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const deleted = await videoService.deleteVideo(id, userId);

    if (!deleted) {
      throw new AppError("Video not found", 404);
    }

    logger.info(`Video deleted: ${id}`);

    res.json({
      status: "success",
      data: { message: "Video deleted successfully" },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/videos/:id/analyze
 * Runs the full pipeline: transcribe → score highlights → save results.
 * Updates job progress after each step so the frontend can show live status.
 */
export async function analyzeVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const videoId = req.params.id as string;

    // ─── Verify video exists and belongs to user ─────────
    const video = await videoService.getVideoById(videoId, userId);
    if (!video) {
      throw new AppError("Video not found", 404);
    }

    // ─── Determine the video file path ────────────────
    const videoPath = video.file_url || video.source_url;
    if (!videoPath) {
      throw new AppError("No video file or source URL available for analysis", 400);
    }

    // ─── Find or create a job record ───────────────────
    let job = video.jobs?.[0];
    if (!job) {
      job = await prisma.job.create({
        data: {
          video_id: videoId,
          user_id: userId,
          type: "process_video",
          status: "pending",
          progress: 0,
        },
      });
    }

    // ─── Don't re-analyze if already processing ───────
    if (job.status === "processing") {
      throw new AppError("Analysis is already in progress for this video", 409);
    }

    // ─── Run analysis asynchronously ───────────────────
    // Respond immediately, process in background
    res.status(202).json({
      status: "accepted",
      message: "Analysis started. Poll GET /api/videos/:id for progress updates.",
      data: { job_id: job.id },
    });

    // Process in the background (no await — response already sent)
    videoService.runAnalysisPipeline(videoId, userId, videoPath, job.id).catch((err) => {
      logger.error(`Background analysis failed for video ${videoId}:`, err);
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/videos/:id/highlights
 * Returns the top 10 scored highlights for a video.
 */
export async function getHighlights(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const videoId = req.params.id as string;

    // ─── Verify video exists ───────────────────────────
    const video = await prisma.video.findFirst({
      where: { id: videoId, user_id: userId },
    });
    if (!video) {
      throw new AppError("Video not found", 404);
    }

    // ─── Fetch highlights ─────────────────────────────
    const highlights = await videoService.getHighlights(videoId, userId);

    res.json({
      status: "success",
      data: {
        video_id: videoId,
        highlights: highlights.map((h) => ({
          id: h.id,
          start_time: h.start_time,
          end_time: h.end_time,
          score: h.score,
          summary: h.summary,
          created_at: h.created_at,
        })),
        total: highlights.length,
      },
    });
  } catch (err) {
    next(err);
  }
}
