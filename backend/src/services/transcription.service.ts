/**
 * Speech-to-text transcription service using FFmpeg + Vosk.
 *
 * Pipeline:
 *   1. Extract audio from video using FFmpeg (16kHz mono WAV)
 *   2. Run Vosk offline speech recognition on the audio
 *   3. Return structured transcript with word-level timestamps
 *
 * Vosk model (~50MB) is downloaded separately from:
 *   https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
 * Extract into backend/models/vosk-model-small-en-us-0.15/
 */

import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { logger } from "../utils/logger";

// ─── Types ───────────────────────────────────────────────

export interface WordTimestamp {
  start: number;
  end: number;
  word: string;
  confidence: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
  words: WordTimestamp[];
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  duration: number;
}

// ─── Paths ───────────────────────────────────────────────

const MODELS_DIR = path.join(__dirname, "..", "..", "models");
const TEMP_DIR = path.join(__dirname, "..", "..", "temp");

function getModelPath(): string {
  const modelName = process.env.VOSK_MODEL || "vosk-model-small-en-us-0.15";
  return path.join(MODELS_DIR, modelName);
}

/**
 * Run a shell command asynchronously and return stdout.
 * Keeps the event loop responsive during long operations like FFmpeg extraction.
 */
function execAsync(cmd: string, timeoutMs = 600000): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs, maxBuffer: 500 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(new Error(`Command failed: ${cmd}\n${err.message}`));
      else resolve(stdout);
    });
  });
}

// ─── Service ─────────────────────────────────────────────

export class TranscriptionService {
  private voskModel: any = null;
  private vosk: any = null;
  private initialized = false;

  /**
   * Initialize the Vosk model.
   * Called once when the server starts. Gracefully skips if model files
   * are not found — transcription will fail with a clear error later.
   */
  async initialize(): Promise<void> {
    const modelPath = getModelPath();
    if (!fs.existsSync(modelPath)) {
      logger.warn(
        `Vosk model not found at ${modelPath}. ` +
          `Download from https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip ` +
          `and extract to backend/models/`
      );
      return;
    }

    try {
      // Dynamically require vosk to avoid crash if native bindings fail
      this.vosk = require("vosk");
      this.vosk.setLogLevel(-1); // Suppress Vosk's internal logs
      this.voskModel = new this.vosk.Model(modelPath);
      this.initialized = true;
      logger.info(`🎤 Vosk model loaded: ${modelPath}`);
    } catch (err) {
      logger.error("Failed to initialize Vosk:", err);
      logger.warn("Transcription will not be available. Install vosk and ensure native bindings compile.");
    }
  }

  /**
   * Transcribe a video/audio file to text with word-level timestamps.
   *
   * Steps:
   *   1. Get video duration via FFprobe
   *   2. Extract audio as 16kHz mono WAV via FFmpeg
   *   3. Run Vosk recognition on the audio
   *   4. Parse results into structured segments
   */
  async transcribe(videoPath: string): Promise<TranscriptionResult> {
    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const baseName = path.basename(videoPath, path.extname(videoPath));
    const audioPath = path.join(TEMP_DIR, `${baseName}.wav`);

    try {
      // ── Step 1: Get video duration via FFprobe ──────────
      let duration = 0;
      try {
        const probeOutput = await execAsync(
          `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`,
          30000
        );
        duration = parseFloat(probeOutput.trim()) || 0;
        logger.debug(`Video duration: ${duration}s`);
      } catch (err) {
        logger.warn(`Could not probe video duration for ${videoPath}: ${err}`);
      }

      // ── Step 2: Extract audio via FFmpeg ────────────────
      logger.info(`Extracting audio from ${videoPath}...`);
      try {
        await execAsync(
          `ffmpeg -y -i "${videoPath}" -ar 16000 -ac 1 -sample_fmt s16 "${audioPath}"`,
          600000 // 10 min timeout
        );
        logger.info(`Audio extracted to ${audioPath}`);
      } catch (err) {
        throw new Error(`FFmpeg audio extraction failed: ${err}`);
      }

      // ── Step 3: Run Vosk recognition ────────────────────
      if (!this.initialized || !this.vosk || !this.voskModel) {
        throw new Error(
          "Vosk is not initialized. Please download the model and restart the server."
        );
      }

      const recognizer = new this.vosk.Recognizer({
        model: this.voskModel,
        sampleRate: 16000,
      });
      recognizer.SetWords(true); // Enable word-level timestamps

      logger.info("Running Vosk speech recognition...");
      const audioBuffer = fs.readFileSync(audioPath);

      // Process audio in chunks (Vosk processes streaming audio)
      const chunkSize = 8000; // bytes per chunk
      let finalResult: any = null;

      for (let i = 0; i < audioBuffer.length; i += chunkSize) {
        const chunk = audioBuffer.subarray(i, i + chunkSize);
        if (recognizer.AcceptWaveform(chunk)) {
          finalResult = JSON.parse(recognizer.Result());
        }
      }

      // Get the final result (remaining audio)
      const finalPartial = JSON.parse(recognizer.FinalResult());
      recognizer.Free();

      // ── Step 4: Parse results ───────────────────────────
      const allSegments: TranscriptSegment[] = [];
      let fullText = "";

      // Parse intermediate results
      if (finalResult && finalResult.result) {
        const seg = this.voskResultToSegment(finalResult);
        allSegments.push(seg);
        fullText += seg.text + " ";
      }

      // Parse final result
      if (finalPartial && finalPartial.result) {
        const seg = this.voskResultToSegment(finalPartial);
        allSegments.push(seg);
        fullText += seg.text;
      }

      // Clean up temp audio file
      try {
        fs.unlinkSync(audioPath);
      } catch {
        // Non-critical
      }

      const result: TranscriptionResult = {
        text: fullText.trim(),
        segments: allSegments,
        language: "en",
        duration,
      };

      logger.info(
        `Transcription complete: ${result.segments.length} segments, ${result.text.split(/\s+/).length} words`
      );

      return result;
    } catch (error) {
      // Clean up temp file on failure
      try {
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      } catch {
        // Non-critical
      }
      throw error;
    }
  }

  /**
   * Convert a Vosk JSON result into our TranscriptSegment format.
   */
  private voskResultToSegment(voskResult: any): TranscriptSegment {
    const words: WordTimestamp[] = (voskResult.result || []).map((w: any) => ({
      start: w.start,
      end: w.end,
      word: w.word,
      confidence: w.conf,
    }));

    const text = words.map((w) => w.word).join(" ");
    const start = words.length > 0 ? words[0].start : 0;
    const end = words.length > 0 ? words[words.length - 1].end : 0;
    const avgConfidence =
      words.length > 0
        ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length
        : 0;

    return {
      start,
      end,
      text,
      confidence: avgConfidence,
      words,
    };
  }

  /**
   * Clean up resources.
   */
  async destroy(): Promise<void> {
    if (this.voskModel) {
      this.voskModel.Free();
      this.voskModel = null;
    }
    this.initialized = false;
    logger.info("Vosk transcription service destroyed");
  }
}

export const transcriptionService = new TranscriptionService();
