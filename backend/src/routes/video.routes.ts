import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  createVideo,
  getVideo,
  listVideos,
  deleteVideo,
  analyzeVideo,
  getHighlights,
} from "../controllers/video.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { uploadVideo as uploadMiddleware } from "../middlewares/upload.middleware";

const router = Router();

// ─── Rate Limiter: 50 video submissions / IP / day ───────
const videoUploadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message:
      "Daily video submission limit reached (50/day). Please try again tomorrow.",
  },
  // Use IP address as the key (trust proxy in production behind Nginx)
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
});

// ─── Rate Limiter: 20 video analyzes / IP / day ──────────
const videoAnalyzeLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message:
      "Daily analysis limit reached (20 analyses/day). Please try again tomorrow.",
  },
});

// All video routes require authentication
router.use(authenticate);

// Single POST endpoint: accepts file upload OR source_url
router.post("/", videoUploadLimiter, (req, res, next) => {
  // If it's a multipart upload with a file, use Multer middleware first
  if (req.is("multipart/form-data")) {
    uploadMiddleware(req, res, (err) => {
      if (err) return next(err);
      createVideo(req, res, next);
    });
  } else {
    // JSON body with source_url — no Multer needed
    createVideo(req, res, next);
  }
});

router.get("/", listVideos);
router.get("/:id", getVideo);
router.post("/:id/analyze", videoAnalyzeLimiter, analyzeVideo);
router.get("/:id/highlights", getHighlights);
router.delete("/:id", deleteVideo);

export default router;
