import fs from "fs";
import prisma from "../lib/prisma";
import { logger } from "../utils/logger";
import { transcriptionService } from "./transcription.service";
import { scoreTranscript } from "./highlight.service";
import type { TranscriptionResult } from "./transcription.service";
import type { HighlightScore } from "./highlight.service";

const MAX_PENDING_JOBS = 5;

export class VideoService {
  /**
   * Count how many pending jobs the user already has.
   */
  async countUserPendingJobs(userId: string): Promise<number> {
    return prisma.job.count({
      where: {
        user_id: userId,
        status: { in: ["pending", "processing"] },
      },
    });
  }

  /**
   * Check if user has exceeded the maximum pending job limit.
   */
  async canEnqueueJob(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const pending = await this.countUserPendingJobs(userId);
    if (pending >= MAX_PENDING_JOBS) {
      return {
        allowed: false,
        reason: `You already have ${pending} videos queued for processing. Maximum allowed is ${MAX_PENDING_JOBS}. Please wait for some to finish before adding more.`,
      };
    }
    return { allowed: true };
  }

  /**
   * Create a video record and its initial job entry.
   */
  async createVideo(
    userId: string,
    data: {
      source_url?: string;
      file_url?: string;
      title?: string | null;
      duration?: number | null;
      thumbnail?: string | null;
    }
  ) {
    const video = await prisma.video.create({
      data: {
        user_id: userId,
        source_url: data.source_url || "",
        file_url: data.file_url || null,
        title: data.title || null,
        thumbnail: data.thumbnail || null,
        duration: data.duration || null,
        status: "pending",
      },
    });

    // Create a processing job entry
    await prisma.job.create({
      data: {
        video_id: video.id,
        user_id: userId,
        type: "process_video",
        status: "pending",
        progress: 0,
      },
    });

    logger.info(`Video created: ${video.id} by user ${userId}`);
    return video;
  }

  /**
   * Get all videos for a user, newest first.
   */
  async listUserVideos(userId: string) {
    return prisma.video.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      include: {
        _count: { select: { clips: true, highlights: true } },
        jobs: {
          select: { id: true, status: true, progress: true, type: true },
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    });
  }

  /**
   * Get a single video by ID, ensuring it belongs to the user.
   */
  async getVideoById(videoId: string, userId: string) {
    return prisma.video.findFirst({
      where: { id: videoId, user_id: userId },
      include: {
        transcripts: { orderBy: { created_at: "desc" }, take: 1 },
        highlights: { orderBy: { created_at: "desc" } },
        clips: { orderBy: { created_at: "desc" } },
        jobs: { orderBy: { created_at: "desc" } },
      },
    });
  }

  /**
   * Delete a video, clean up its uploaded file, and all related records.
   */
  async deleteVideo(videoId: string, userId: string) {
    const video = await prisma.video.findFirst({
      where: { id: videoId, user_id: userId },
    });

    if (!video) {
      return null;
    }

    // Clean up the uploaded file from disk (if it exists)
    if (video.file_url) {
      try {
        fs.unlinkSync(video.file_url);
        logger.debug(`Deleted uploaded file: ${video.file_url}`);
      } catch (err) {
        // File may have already been moved or deleted — log but don't fail
        logger.warn(`Could not delete file ${video.file_url}: ${err}`);
      }
    }

    // Prisma cascading deletes handle related records (transcripts, highlights, clips, jobs)
    await prisma.video.delete({ where: { id: videoId } });

    logger.info(`Video deleted: ${videoId} by user ${userId}`);
    return video;
  }

  /**
   * Update video status.
   */
  async updateStatus(videoId: string, status: string) {
    return prisma.video.update({
      where: { id: videoId },
      data: { status },
    });
  }

  /**
   * Save a transcription result to the database.
   */
  async saveTranscript(videoId: string, userId: string, transcription: TranscriptionResult) {
    return prisma.transcript.create({
      data: {
        video_id: videoId,
        user_id: userId,
        content: transcription.text,
        language: transcription.language,
      },
    });
  }

  /**
   * Save scored highlights to the database.
   */
  async saveHighlights(videoId: string, userId: string, highlights: HighlightScore[]) {
    // Delete any existing highlights for this video first
    await prisma.highlight.deleteMany({ where: { video_id: videoId } });

    // Bulk create new highlights
    if (highlights.length > 0) {
      await prisma.highlight.createMany({
        data: highlights.map((h) => ({
          video_id: videoId,
          user_id: userId,
          start_time: h.start_time,
          end_time: h.end_time,
          score: h.score,
          summary: h.summary,
        })),
      });
    }

    return highlights.length;
  }

  /**
   * Get all highlights for a video, ordered by score descending.
   */
  async getHighlights(videoId: string, userId: string) {
    return prisma.highlight.findMany({
      where: { video_id: videoId, user_id: userId },
      orderBy: { score: "desc" },
      take: 10,
    });
  }

  /**
   * Get the latest transcript for a video.
   */
  async getTranscript(videoId: string) {
    return prisma.transcript.findFirst({
      where: { video_id: videoId },
      orderBy: { created_at: "desc" },
    });
  }

  /**
   * Create a new job record.
   */
  async createJob(videoId: string, userId: string, type: string) {
    return prisma.job.create({
      data: {
        video_id: videoId,
        user_id: userId,
        type,
        status: "pending",
        progress: 0,
      },
    });
  }

  /**
   * Update job progress.
   */
  async updateJobProgress(jobId: string, status: string, progress: number) {
    return prisma.job.update({
      where: { id: jobId },
      data: { status, progress },
    });
  }

  /**
   * Run the full analysis pipeline for a video: transcribe → score → save.
   * This runs in the background after the API response is sent.
   */
  async runAnalysisPipeline(
    videoId: string,
    userId: string,
    videoPath: string,
    jobId: string
  ): Promise<void> {
    try {
      // ── Start processing ────────────────────────────
      await this.updateJobProgress(jobId, "processing", 5);
      await this.updateStatus(videoId, "processing");
      logger.info(`Analysis started for video ${videoId}`);

      // ── Step 1: Transcribe ──────────────────────────
      await this.updateJobProgress(jobId, "processing", 15);
      const transcription = await transcriptionService.transcribe(videoPath);
      await this.updateJobProgress(jobId, "processing", 50);

      await this.saveTranscript(videoId, userId, transcription);
      await this.updateJobProgress(jobId, "processing", 60);
      logger.info(`Transcription saved for video ${videoId}`);

      // ── Step 2: Score highlights ────────────────────
      await this.updateJobProgress(jobId, "processing", 70);
      const scored = scoreTranscript(transcription.segments, transcription.duration);
      await this.updateJobProgress(jobId, "processing", 85);

      const highlightCount = await this.saveHighlights(videoId, userId, scored);
      await this.updateJobProgress(jobId, "processing", 95);
      logger.info(`Saved ${highlightCount} highlights for video ${videoId}`);

      // ── Step 3: Mark complete ───────────────────────
      await this.updateStatus(videoId, "ready");
      await this.updateJobProgress(jobId, "completed", 100);
      logger.info(`Analysis complete for video ${videoId}`);
    } catch (error) {
      logger.error(`Analysis failed for video ${videoId}:`, error);
      await this.updateJobProgress(jobId, "failed", 0).catch(() => {});
      await this.updateStatus(videoId, "failed").catch(() => {});
    }
  }

  /**
   * Reset all jobs that were stuck in "processing" state back to "pending".
   * Called on server startup.
   */
  async resetStuckJobs() {
    const result = await prisma.job.updateMany({
      where: { status: "processing" },
      data: { status: "pending", progress: 0 },
    });
    if (result.count > 0) {
      logger.info(`Reset ${result.count} stuck job(s) from 'processing' to 'pending'`);
    }
    return result.count;
  }
}

export const videoService = new VideoService();
