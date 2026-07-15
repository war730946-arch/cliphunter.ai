/**
 * Lightweight, in-process job queue.
 * Processes ONE job at a time. Tracks progress in the Jobs table.
 * No Redis, no BullMQ — just promises.
 *
 * Safety features:
 *   - Single concurrency (max 1 job at a time)
 *   - Configurable max queue size (rejects when full)
 *   - All jobs are tracked in the database via Job records
 */

import prisma from "../lib/prisma";
import { logger } from "../utils/logger";
import { videoService } from "../services/video.service";

// ─── Configuration ───────────────────────────────────────
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || "10", 10);

// ─── Types ───────────────────────────────────────────────
interface QueueJob {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}

type JobHandler = (payload: Record<string, unknown>, jobId: string) => Promise<void>;

// ─── Queue Implementation ────────────────────────────────
class ProcessingQueue {
  private queue: QueueJob[] = [];
  private handlers = new Map<string, JobHandler>();
  private isProcessing = false;

  /**
   * Register a handler for a job type.
   */
  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Number of jobs currently waiting in the queue.
   */
  get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Maximum number of jobs allowed in the queue.
   */
  get maxSize(): number {
    return MAX_QUEUE_SIZE;
  }

  /**
   * Check whether the queue is full and cannot accept new jobs.
   */
  get isFull(): boolean {
    return this.queue.length >= MAX_QUEUE_SIZE;
  }

  /**
   * Add a job to the queue.
   * Throws if the queue is full.
   */
  add(type: string, payload: Record<string, unknown>, _priority = 0): void {
    if (this.isFull) {
      logger.warn(
        `Queue is full (${this.queue.length}/${MAX_QUEUE_SIZE}). Rejecting job: ${type}`
      );
      throw new Error(
        `Server is at maximum capacity (${MAX_QUEUE_SIZE} pending jobs). ` +
        "Please wait for existing jobs to finish before submitting more."
      );
    }

    const job: QueueJob = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
    };

    this.queue.push(job);
    logger.debug(`Job queued: ${type}[${job.id}] (${this.queue.length}/${MAX_QUEUE_SIZE})`);

    this.processNext();
  }

  /**
   * Get a summary of the current queue state (for admin/monitoring).
   */
  getStatus(): { pending: number; maxSize: number; isProcessing: boolean; full: boolean } {
    return {
      pending: this.queue.length,
      maxSize: MAX_QUEUE_SIZE,
      isProcessing: this.isProcessing,
      full: this.isFull,
    };
  }

  /**
   * Process the next job in the queue (single concurrency).
   */
  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const job = this.queue.shift()!;
    const handler = this.handlers.get(job.type);

    if (!handler) {
      logger.warn(`No handler registered for job type: ${job.type}`);
      this.isProcessing = false;
      this.processNext();
      return;
    }

    try {
      logger.info(`▶️ Processing job: ${job.type}[${job.id}] (${this.queue.length} remaining)`);
      await handler(job.payload, job.id);
      logger.info(`✅ Job completed: ${job.type}[${job.id}]`);
    } catch (error) {
      logger.error(`❌ Job failed: ${job.type}[${job.id}]`, error);
    } finally {
      this.isProcessing = false;
      this.processNext();
    }
  }
}

// ─── Singleton ───────────────────────────────────────────
export const processingQueue = new ProcessingQueue();

// ─── Register job handlers ───────────────────────────────
processingQueue.register("process-video", async (payload) => {
  const { videoId, userId } = payload as { videoId: string; userId: string };

  // Find the job record in the database
  const jobRecord = await prisma.job.findFirst({
    where: { video_id: videoId, type: "process_video" },
    orderBy: { created_at: "desc" },
  });

  if (!jobRecord) {
    logger.warn(`No job record found for video: ${videoId}`);
    return;
  }

  // Determine the video file path
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) {
    logger.warn(`Video not found: ${videoId}`);
    return;
  }

  const videoPath = video.file_url || video.source_url;
  if (!videoPath) {
    logger.warn(`No video file/source for: ${videoId}`);
    return;
  }

  // Run the full analysis pipeline
  await videoService.runAnalysisPipeline(videoId, userId, videoPath, jobRecord.id);
});
