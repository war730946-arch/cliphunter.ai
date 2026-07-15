import { Router } from "express";
import authRoutes from "./auth.routes";
import videoRoutes from "./video.routes";
import clipRoutes from "./clip.routes";
import { authenticate } from "../middlewares/auth.middleware";
import { downloadClip } from "../controllers/clip.controller";

const apiRouter = Router();

// Health check
apiRouter.get("/hello", (_req, res) => {
  res.json({
    message: "ClipHunter AI backend is alive! 🎯",
    version: "0.2.0",
    status: "ready",
  });
});

// Mount route groups
apiRouter.use("/auth", authRoutes);
apiRouter.use("/videos", videoRoutes);
apiRouter.use("/clips", clipRoutes);

// Download endpoint (authenticated)
apiRouter.get("/download/:id", authenticate, downloadClip);

export default apiRouter;
