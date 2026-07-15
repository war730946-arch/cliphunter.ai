import { Router } from "express";
import {
  generateClip,
  listClips,
  getClip,
  deleteClip,
} from "../controllers/clip.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// All clip routes require authentication
router.use(authenticate);

// POST /api/clips/generate — generate a clip from a highlight
router.post("/generate", generateClip);

// GET /api/clips — list all clips (optional ?video_id= filter)
router.get("/", listClips);

// GET /api/clips/:id — get a single clip
router.get("/:id", getClip);

// DELETE /api/clips/:id — delete a clip and its files
router.delete("/:id", deleteClip);

export default router;
