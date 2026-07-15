import { z } from "zod";

const MAX_VIDEO_DURATION_SECONDS = 20 * 60; // 20 minutes

// ─── URL Video Schema ────────────────────────────────────
export const videoUrlSchema = z.object({
  source_url: z
    .string()
    .url("Please provide a valid URL (must start with http:// or https://)")
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          const hostname = parsed.hostname.toLowerCase();
          // Block common non-video domains
          const blockedHostnames = [
            "facebook.com", "www.facebook.com",
            "instagram.com", "www.instagram.com",
            "twitter.com", "www.twitter.com", "x.com", "www.x.com",
          ];
          if (blockedHostnames.includes(hostname)) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid or unsupported video URL" }
    ),
});

// ─── File Upload Schema ──────────────────────────────────
export const videoFileSchema = z.object({
  // File validation happens via Multer — this is just a placeholder
  // for any additional form fields the user might send alongside the file
  title: z.string().min(1).max(200).optional(),
});

// ─── Duration Validation ─────────────────────────────────
export function validateDuration(durationSeconds: number | null | undefined): string | null {
  if (durationSeconds === null || durationSeconds === undefined) {
    return null; // Unknown duration — allow (will be checked during processing)
  }
  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    return `Video is too long. Maximum allowed duration is 20 minutes.`;
  }
  return null;
}

// ─── Inferred Types ──────────────────────────────────────
export type VideoUrlInput = z.infer<typeof videoUrlSchema>;
export type VideoFileInput = z.infer<typeof videoFileSchema>;
