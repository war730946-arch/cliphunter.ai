import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  getMe,
} from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// ─── Rate Limiter (100 req / 15 min) ───────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests, please try again later",
  },
});

// Apply rate limiter to all auth routes
router.use(authLimiter);

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, getMe);

export default router;
