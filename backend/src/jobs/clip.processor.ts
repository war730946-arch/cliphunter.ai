/**
 * Clip processing job handler.
 * Runs the full pipeline: transcribe → score → trim
 */

import { processingQueue } from "./queue";
import { videoService } from "../services/video.service";
import { transcriptionService } from "../services/transcription.service";
import { scoreTranscript } from "../services/highlight.service";
import { logger } from "../utils/logger";

export interface ClipJobPayload {
  videoId: string;
  videoPath: string;
  userId: string;
}

/**
 * Register all job handlers with the queue.
 */
export function registerClipGenerationHandler(): void {
  processingQueue.register("generate-clips", async (payload: Record<string, unknown>) => {
    const { videoId, videoPath, userId } = payload as unknown as ClipJobPayload;
    logger.info(`Starting clip generation for video: ${videoId}`);

    try {
      // Step 1: Find/create job record
      const jobRecord = await videoService.createJob(videoId, userId, "generate_clip");

      // Step 2: Transcribe
      await videoService.updateJobProgress(jobRecord.id, "processing", 20);
      const transcription = await transcriptionService.transcribe(videoPath);

      // Step 3: Score highlights
      await videoService.updateJobProgress(jobRecord.id, "processing", 50);
      const scored = scoreTranscript(transcription.segments, transcription.duration);

      // Step 4: Save highlights
      await videoService.saveHighlights(videoId, userId, scored);
      await videoService.updateJobProgress(jobRecord.id, "completed", 100);

      logger.info(`Clip generation complete for video: ${videoId}`);
    } catch (error) {
      logger.error(`Clip generation failed for video: ${videoId}`, error);
      throw error;
    }
  });

  logger.info("Clip generation handler registered");
}
