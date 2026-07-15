/**
 * NLP-based highlight detection service.
 *
 * NO external APIs, NO LLM, NO GPU needed — pure library-based text analysis.
 *
 * Scoring methodology (each chunk gets 0-100, weighted combined):
 *   1. Keyword Density (20%)   — key nouns/verbs frequency & relevance
 *   2. Sentence Importance (40%) — length, position, emphasis cues
 *   3. Energy/Pace (20%)       — speech rate from word timestamps
 *   4. Topic Shift (10%)       — vocabulary overlap between consecutive chunks
 *   5. Position/Structure Bonus (10%) — penalize intro/outro, favor middle
 */

import { logger } from "../utils/logger";
import type { TranscriptSegment, WordTimestamp } from "./transcription.service";

// ─── Types ───────────────────────────────────────────────

export interface HighlightScore {
  start_time: number;
  end_time: number;
  score: number;         // 0-100 final weighted score
  keyword_score: number;
  importance_score: number;
  energy_score: number;
  topic_shift_score: number;
  position_bonus: number;
  summary: string;
  word_count: number;
  text: string;
}

export interface ScoredHighlight {
  start_time: number;
  end_time: number;
  score: number;
  summary: string;
}

const CHUNK_DURATION = 25; // seconds per chunk

// ─── Keyword lists (curated for sports / highlight content) ───

const HIGH_IMPACT_KEYWORDS = new Set([
  "goal", "touchdown", "home run", "slam dunk", "score", "win",
  "champion", "record", "amazing", "incredible", "unbelievable",
  "spectacular", "sensational", "magnificent", "outstanding",
  "legendary", "epic", "historic", "perfect", "brilliant",
  "extraordinary", "remarkable", "phenomenal", "superb",
]);

const EXCITEMENT_KEYWORDS = new Set([
  "wow", "oh", "yes", "no way", "come on", "let's go",
  "look at that", "did you see", "can you believe",
  "oh my god", "oh my goodness", "holy", "what a",
  "are you kidding", "unreal", "huge", "massive",
  "crucial", "dramatic", "thrilling", "exciting",
]);

const SUPERLATIVES = new Set([
  "best", "greatest", "most", "fastest", "biggest", "largest",
  "highest", "lowest", "worst", "never", "ever", "always",
  "first", "last", "only",
]);

// ─── Main Scoring Engine ────────────────────────────────

/**
 * Score a full transcript and return the TOP 10 highest-scoring highlights.
 */
export function scoreTranscript(
  segments: TranscriptSegment[],
  totalDuration: number
): HighlightScore[] {
  // ── Step 1: Merge Vosk segments into time-based chunks ──
  const chunks = chunkSegments(segments, totalDuration);
  if (chunks.length === 0) return [];

  // ── Step 2: Score each chunk ────────────────────────────
  const scored: HighlightScore[] = chunks.map((chunk, index) => {
    const keywordScore = computeKeywordDensity(chunk);
    const importanceScore = computeSentenceImportance(chunk);
    const energyScore = computeEnergyPace(chunk);
    const topicShiftScore = computeTopicShift(chunk, chunks, index);
    const positionBonus = computePositionBonus(index, chunks.length);

    // Weighted combination (out of 100)
    const finalScore =
      keywordScore * 0.2 +
      importanceScore * 0.4 +
      energyScore * 0.2 +
      topicShiftScore * 0.1 +
      positionBonus * 0.1;

    return {
      start_time: chunk.start,
      end_time: chunk.end,
      score: Math.round(Math.min(Math.max(finalScore, 0), 100)),
      keyword_score: Math.round(keywordScore),
      importance_score: Math.round(importanceScore),
      energy_score: Math.round(energyScore),
      topic_shift_score: Math.round(topicShiftScore),
      position_bonus: Math.round(positionBonus),
      summary: generateSummary(chunk),
      word_count: chunk.words.length,
      text: chunk.text,
    };
  });

  // ── Step 3: Sort descending by score, return TOP 10 ─────
  scored.sort((a, b) => b.score - a.score);
  const top10 = scored.slice(0, 10);

  logger.info(
    `Scored ${scored.length} chunks, returning ${top10.length} highlights. ` +
    `Top score: ${top10[0]?.score ?? 0}, lowest in top 10: ${top10[top10.length - 1]?.score ?? 0}`
  );

  return top10;
}

// ─── Chunk Builder ───────────────────────────────────────

interface TextChunk {
  start: number;
  end: number;
  text: string;
  words: WordTimestamp[];
}

function chunkSegments(
  segments: TranscriptSegment[],
  totalDuration: number
): TextChunk[] {
  if (segments.length === 0) {
    // No word-level timestamps — create simulated chunks
    return generateFallbackChunks(totalDuration);
  }

  // Flatten all words from all segments
  const allWords: WordTimestamp[] = [];
  for (const seg of segments) {
    for (const word of seg.words) {
      allWords.push(word);
    }
  }

  if (allWords.length === 0) {
    return generateFallbackChunks(totalDuration);
  }

  // Group words into ~CHUNK_DURATION second chunks
  const chunks: TextChunk[] = [];
  let currentStart = allWords[0].start;
  let currentEnd = currentStart + CHUNK_DURATION;
  let chunkWords: WordTimestamp[] = [];

  for (const word of allWords) {
    if (word.start <= currentEnd) {
      chunkWords.push(word);
    } else {
      // Finalize current chunk
      if (chunkWords.length > 0) {
        chunks.push({
          start: chunkWords[0].start,
          end: chunkWords[chunkWords.length - 1].end,
          text: chunkWords.map((w) => w.word).join(" "),
          words: [...chunkWords],
        });
      }
      // Start new chunk
      currentStart = chunkWords.length > 0 ? chunkWords[chunkWords.length - 1].end : word.start;
      currentEnd = currentStart + CHUNK_DURATION;
      chunkWords = [word];
    }
  }

  // Don't forget the last chunk
  if (chunkWords.length > 0) {
    chunks.push({
      start: chunkWords[0].start,
      end: chunkWords[chunkWords.length - 1].end,
      text: chunkWords.map((w) => w.word).join(" "),
      words: [...chunkWords],
    });
  }

  // If we have very few chunks, split more evenly
  if (chunks.length <= 2 && totalDuration > 30) {
    return splitEvenly(allWords, Math.min(10, Math.floor(totalDuration / CHUNK_DURATION)));
  }

  return chunks;
}

/**
 * Fallback: if no word timestamps, split text evenly over duration.
 */
function generateFallbackChunks(totalDuration: number): TextChunk[] {
  if (totalDuration <= 0) return [];
  const numChunks = Math.max(1, Math.floor(totalDuration / CHUNK_DURATION));
  const chunks: TextChunk[] = [];
  for (let i = 0; i < numChunks; i++) {
    const start = i * CHUNK_DURATION;
    const end = Math.min((i + 1) * CHUNK_DURATION, totalDuration);
    chunks.push({ start, end, text: "", words: [] });
  }
  return chunks;
}

function splitEvenly(words: WordTimestamp[], targetChunks: number): TextChunk[] {
  const wordsPerChunk = Math.max(1, Math.ceil(words.length / targetChunks));
  const chunks: TextChunk[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    if (chunkWords.length === 0) continue;
    chunks.push({
      start: chunkWords[0].start,
      end: chunkWords[chunkWords.length - 1].end,
      text: chunkWords.map((w) => w.word).join(" "),
      words: chunkWords,
    });
  }
  return chunks;
}

// ─── Scoring Function 1: Keyword Density (20%) ──────────

function computeKeywordDensity(chunk: TextChunk): number {
  let score = 0;
  const text = chunk.text.toLowerCase();

  // High-impact keywords: +15 each (max 60)
  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (text.includes(kw)) {
      score += 15;
    }
  }

  // Excitement keywords: +10 each (max 40)
  for (const kw of EXCITEMENT_KEYWORDS) {
    if (text.includes(kw)) {
      score += 10;
    }
  }

  // Proper nouns / capitalized words (people, teams)
  const words = chunk.text.split(/\s+/);
  const properNouns = words.filter((w) => /^[A-Z][a-z]+$/.test(w)).length;
  score += Math.min(properNouns * 5, 20);

  return Math.min(score, 100);
}

// ─── Scoring Function 2: Sentence Importance (40%) ──────

function computeSentenceImportance(chunk: TextChunk): number {
  let score = 0;
  const text = chunk.text;

  // Exclamation marks: strong emphasis signal
  const exclamationCount = (text.match(/!/g) || []).length;
  score += Math.min(exclamationCount * 15, 30);

  // Question marks: rhetorical questions often highlight key moments
  const questionCount = (text.match(/\?/g) || []).length;
  score += Math.min(questionCount * 10, 20);

  // Superlatives: "best", "greatest", "never"
  const lower = text.toLowerCase();
  for (const sup of SUPERLATIVES) {
    if (lower.includes(sup)) {
      score += 8;
    }
  }
  score = Math.min(score, 25);

  // ALL CAPS words (shouting/emphasis in transcripts)
  const words = text.split(/\s+/);
  const capsWords = words.filter((w) => w.length > 2 && w === w.toUpperCase()).length;
  score += Math.min(capsWords * 8, 15);

  // Sentence length sweet spot (5-30 words = complete thought)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  let lengthScore = 0;
  for (const sentence of sentences) {
    const wc = sentence.split(/\s+/).length;
    if (wc >= 5 && wc <= 30) {
      lengthScore += 5;
    }
  }
  score += Math.min(lengthScore, 20);

  return Math.min(score, 100);
}

// ─── Scoring Function 3: Energy/Pace (20%) ─────────────

function computeEnergyPace(chunk: TextChunk): number {
  if (chunk.words.length < 3) return 30; // Neutral score for no data

  const duration = chunk.end - chunk.start;
  if (duration <= 0) return 30;

  // Speech rate: words per second
  const wps = chunk.words.length / duration;

  // Score: 2-4 wps is normal range
  // < 2 wps = slow (low energy), > 4 wps = fast (high energy)
  let paceScore = 0;
  if (wps >= 3.5) {
    paceScore = Math.min(((wps - 3.5) / 2) * 100, 60);
  } else if (wps >= 2.5) {
    paceScore = 30; // Normal pace
  } else {
    paceScore = Math.max((wps / 2.5) * 30, 10); // Slow
  }

  // Pause analysis: look for gaps > 0.5s between words
  let longPauses = 0;
  let pauseDuration = 0;
  for (let i = 1; i < chunk.words.length; i++) {
    const gap = chunk.words[i].start - chunk.words[i - 1].end;
    if (gap > 0.5) {
      longPauses++;
      pauseDuration += gap;
    }
  }

  // Fewer pauses = higher energy
  const pauseRatio = chunk.words.length > 0 ? longPauses / chunk.words.length : 0;
  let pauseScore = 0;
  if (pauseRatio < 0.05) {
    pauseScore = 40; // Very few pauses = high energy
  } else if (pauseRatio < 0.1) {
    pauseScore = 25; // Normal
  } else {
    pauseScore = 10; // Many pauses = low energy
  }

  return Math.min(paceScore + pauseScore, 100);
}

// ─── Scoring Function 4: Topic Shift (10%) ─────────────

function computeTopicShift(
  chunk: TextChunk,
  allChunks: TextChunk[],
  currentIndex: number
): number {
  if (currentIndex === 0 || allChunks.length === 0) return 30; // Neutral for first chunk

  const prevChunk = allChunks[currentIndex - 1];
  if (!prevChunk || !prevChunk.text.trim() || !chunk.text.trim()) return 30;

  // Extract unique words (excluding common stop words)
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "this", "that", "these",
    "those", "it", "its", "he", "she", "they", "we", "you", "i",
  ]);

  const chunkWords = new Set(
    chunk.text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
  );

  const prevWords = new Set(
    prevChunk.text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
  );

  if (chunkWords.size === 0 || prevWords.size === 0) return 30;

  // Jaccard similarity: intersection / union
  const intersection = new Set([...chunkWords].filter((w) => prevWords.has(w)));
  const union = new Set([...chunkWords, ...prevWords]);

  const similarity = intersection.size / union.size;

  // Lower similarity = topic shift = potentially more interesting
  // Map: similar=0 → score 10, dissimilar=1 → score 90
  const score = 90 - similarity * 80;

  return Math.min(Math.max(score, 10), 100);
}

// ─── Scoring Function 5: Position/Structure Bonus (10%) ─

function computePositionBonus(chunkIndex: number, totalChunks: number): number {
  if (totalChunks <= 2) return 50; // Short video, all chunks are equally valid

  const position = chunkIndex / (totalChunks - 1); // 0 = start, 1 = end

  // Penalize first 10% (intro) and last 10% (outro)
  // Favor middle 20-80% range
  if (position < 0.1) {
    // First chunk: low score (intro is usually filler)
    return 20;
  } else if (position > 0.9) {
    // Last chunk: low score (outro/credits)
    return 30;
  } else if (position >= 0.15 && position <= 0.85) {
    // Sweet spot: high score
    return 100;
  } else if (position >= 0.1 && position < 0.15) {
    // Early but not first: good
    return 70 + (position - 0.1) / 0.05 * 30;
  } else {
    // Late but not last: decent
    return 70 - (0.9 - position) / 0.05 * 40;
  }
}

// ─── Summary Generation ─────────────────────────────────

function generateSummary(chunk: TextChunk): string {
  if (!chunk.text.trim()) return "";

  // Split into sentences and take the first meaningful one
  const sentences = chunk.text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (sentences.length === 0) {
    // Fallback: first 80 chars of the chunk
    const truncated = chunk.text.substring(0, 80).trim();
    return truncated.length === chunk.text.length ? truncated : truncated + "...";
  }

  // Find the sentence with the most keywords (most "highlight-worthy")
  let bestSentence = sentences[0];
  let bestScore = -1;

  for (const sentence of sentences) {
    let score = 0;
    const lower = sentence.toLowerCase();
    for (const kw of HIGH_IMPACT_KEYWORDS) {
      if (lower.includes(kw)) score += 2;
    }
    for (const kw of EXCITEMENT_KEYWORDS) {
      if (lower.includes(kw)) score += 1;
    }
    if (sentence.includes("!")) score += 2;
    if (sentence.length >= 20 && sentence.length <= 150) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  // Truncate if too long
  if (bestSentence.length > 120) {
    bestSentence = bestSentence.substring(0, 117) + "...";
  }

  return bestSentence;
}

/**
 * Convert scored highlights to the simplified API output format.
 */
export function toApiHighlights(scored: HighlightScore[]): ScoredHighlight[] {
  return scored.map((h) => ({
    start_time: Math.round(h.start_time * 100) / 100,
    end_time: Math.round(h.end_time * 100) / 100,
    score: h.score,
    summary: h.summary,
  }));
}
