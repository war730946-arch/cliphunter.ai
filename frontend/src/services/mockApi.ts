/**
 * Mock API interceptor for local development.
 * Matches the real backend response shape so the frontend works without a running server.
 *
 * Uses a REQUEST interceptor with a custom adapter to short-circuit API calls
 * BEFORE they hit the network. This avoids CORS issues entirely since no actual
 * HTTP requests are made to the backend.
 *
 * Set NEXT_PUBLIC_USE_MOCK=true (default) to enable.
 * Set NEXT_PUBLIC_USE_MOCK=false to disable.
 */

import api from "./api";
import type { AxiosRequestConfig } from "axios";
import type { Video, Highlight, Clip, Job, User } from "@/types";

let initialized = false;

const MOCK_DELAY = 400;

function delay(ms: number = MOCK_DELAY) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Mock User ───────────────────────────────────────────
const mockUser: User = {
  id: "user_demo_001",
  email: "demo@test.com",
  name: "Demo User",
  role: "admin",
  created_at: new Date().toISOString(),
};

// ─── Mock Videos ─────────────────────────────────────────
const mockVideos: Video[] = [
  {
    id: "vid_001",
    user_id: "user_demo_001",
    title: "Epic Football Highlights 2024",
    source_url: "https://www.w3schools.com/html/mov_bbb.mp4",
    file_url: null,
    duration: 124,
    thumbnail: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&h=225&fit=crop",
    status: "ready",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    _count: { clips: 3, highlights: 8 },
    jobs: [{ id: "job_001", status: "completed", progress: 100, type: "process_video" }],
  },
  {
    id: "vid_002",
    user_id: "user_demo_001",
    title: "Tech Conference Keynote",
    source_url: "https://www.w3schools.com/html/mov_bbb.mp4",
    file_url: null,
    duration: 3600,
    thumbnail: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400&h=225&fit=crop",
    status: "ready",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    _count: { clips: 5, highlights: 12 },
    jobs: [{ id: "job_002", status: "completed", progress: 100, type: "process_video" }],
  },
  {
    id: "vid_003",
    user_id: "user_demo_001",
    title: "Gaming Stream - Final Boss Battle",
    source_url: "https://www.w3schools.com/html/mov_bbb.mp4",
    file_url: null,
    duration: 2456,
    thumbnail: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&h=225&fit=crop",
    status: "processing",
    created_at: new Date().toISOString(),
    _count: { clips: 0, highlights: 0 },
    jobs: [{ id: "job_003", status: "processing", progress: 45, type: "process_video" }],
  },
];

// ─── Mock Highlights ─────────────────────────────────────
const mockHighlights: Record<string, Highlight[]> = {
  vid_001: [
    { id: "hl_001", video_id: "vid_001", start_time: 12.5, end_time: 25.0, score: 92, summary: "A stunning long-range goal that left the crowd in awe.", created_at: new Date().toISOString() },
    { id: "hl_002", video_id: "vid_001", start_time: 45.0, end_time: 58.0, score: 85, summary: "Goalkeeper makes an incredible reflex save.", created_at: new Date().toISOString() },
    { id: "hl_003", video_id: "vid_001", start_time: 78.3, end_time: 95.0, score: 78, summary: "The stadium erupts after the winning moment.", created_at: new Date().toISOString() },
    { id: "hl_004", video_id: "vid_001", start_time: 30.0, end_time: 42.0, score: 72, summary: "Brilliant team play leads to a near perfect goal.", created_at: new Date().toISOString() },
    { id: "hl_005", video_id: "vid_001", start_time: 100.0, end_time: 115.0, score: 68, summary: "Slow motion replay of the match winning moment.", created_at: new Date().toISOString() },
  ],
  vid_002: [
    { id: "hl_006", video_id: "vid_002", start_time: 120.0, end_time: 145.0, score: 88, summary: "The CEO announces a groundbreaking new product.", created_at: new Date().toISOString() },
    { id: "hl_007", video_id: "vid_002", start_time: 600.0, end_time: 620.0, score: 81, summary: "Audience applause as the demo succeeds flawlessly.", created_at: new Date().toISOString() },
  ],
};

// ─── Mock Clips ──────────────────────────────────────────
const mockClips: Clip[] = [
  {
    id: "clip_001", video_id: "vid_001", highlight_id: "hl_001", user_id: "user_demo_001",
    file_url: "/generated-clips/clip_001.mp4", duration: 12.5, size: 2_500_000,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    thumbnail_url: "/generated-clips/clip_001_thumb.jpg",
    preview_url: "/generated-clips/clip_001_preview.mp4",
    highlight: { id: "hl_001", summary: "A stunning long-range goal", start_time: 12.5, end_time: 25.0, score: 92 },
    video: { id: "vid_001", title: "Epic Football Highlights 2024", source_url: "" },
  },
  {
    id: "clip_002", video_id: "vid_001", highlight_id: "hl_002", user_id: "user_demo_001",
    file_url: "/generated-clips/clip_002.mp4", duration: 13.0, size: 2_800_000,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    thumbnail_url: "/generated-clips/clip_002_thumb.jpg",
    preview_url: "/generated-clips/clip_002_preview.mp4",
    highlight: { id: "hl_002", summary: "Goalkeeper makes an incredible reflex save", start_time: 45.0, end_time: 58.0, score: 85 },
    video: { id: "vid_001", title: "Epic Football Highlights 2024", source_url: "" },
  },
];

// ─── Jobs ────────────────────────────────────────────────
const mockJobs: Job[] = [
  { id: "job_001", video_id: "vid_001", type: "transcribe", status: "completed", progress: 100, created_at: new Date().toISOString() },
  { id: "job_002", video_id: "vid_001", type: "analyze", status: "completed", progress: 100, created_at: new Date().toISOString() },
  { id: "job_003", video_id: "vid_001", type: "score", status: "completed", progress: 100, created_at: new Date().toISOString() },
  { id: "job_004", video_id: "vid_001", type: "generate_clips", status: "completed", progress: 100, created_at: new Date().toISOString() },
  { id: "job_005", video_id: "vid_003", type: "transcribe", status: "processing", progress: 45, created_at: new Date().toISOString() },
  { id: "job_006", video_id: "vid_003", type: "analyze", status: "pending", progress: 0, created_at: new Date().toISOString() },
];

// ─── Build mock response ────────────────────────────────
function mockResponse(config: AxiosRequestConfig, status: number, data: any) {
  return {
    data,
    status,
    statusText: status === 200 ? "OK" : status === 201 ? "Created" : status === 404 ? "Not Found" : "Error",
    headers: { "content-type": "application/json" },
    config,
  };
}

// ─── Route handler ───────────────────────────────────────
async function handleMockRoute(config: AxiosRequestConfig): Promise<any> {
  const url = config.url || "";
  const method = (config.method || "get").toUpperCase();

  // Only intercept /api/* routes
  if (!url.startsWith("/api")) return;

  await delay();

  // ── Auth ──
  if (url === "/api/auth/register" && method === "POST") {
    return mockResponse(config, 201, {
      status: "success",
      data: { user: { ...mockUser, id: generateId("user") } },
      token: "mock_token_demo",
    });
  }
  if (url === "/api/auth/login" && method === "POST") {
    return mockResponse(config, 200, {
      status: "success",
      data: { user: mockUser },
      token: "mock_token_demo",
    });
  }
  if (url === "/api/auth/me" && method === "GET") {
    return mockResponse(config, 200, { status: "success", data: { user: mockUser } });
  }

  // ── Videos ──
  if (url === "/api/videos" && method === "POST") {
    const isMultipart = (config.headers?.["Content-Type"] as string || "").includes("multipart");
    let source_url = "";
    let title = null;
    if (isMultipart) {
      source_url = "/uploads/mock_uploaded_video.mp4";
      title = "Uploaded Video";
    } else {
      const body = JSON.parse(config.data || "{}");
      source_url = body.source_url || "";
      title = body.title || "Video from URL";
    }
    const video: Video = {
      id: generateId("vid"), user_id: "user_demo_001",
      title, source_url, file_url: isMultipart ? source_url : null,
      duration: null, thumbnail: null, status: "pending",
      created_at: new Date().toISOString(),
      _count: { clips: 0, highlights: 0 },
      jobs: [{ id: generateId("job"), status: "pending", progress: 0, type: "process_video" }],
    };
    if (!isMultipart) mockVideos.unshift(video);
    return mockResponse(config, 201, {
      status: "success",
      data: {
        video: { id: video.id, title: video.title, source_url: video.source_url, file_url: video.file_url, duration: video.duration, status: video.status, created_at: video.created_at },
      },
    });
  }

  if (url === "/api/videos" && method === "GET") {
    return mockResponse(config, 200, { status: "success", data: { videos: mockVideos, total: mockVideos.length } });
  }

  if (url.startsWith("/api/videos/") && method === "GET") {
    const videoId = url.replace("/api/videos/", "").split("/")[0];
    const video = mockVideos.find((v) => v.id === videoId);
    if (!video) return mockResponse(config, 404, { status: "error", message: "Video not found" });

    const videoJobs = mockJobs.filter((j) => j.video_id === videoId);
    if (videoId === "vid_003") {
      const transcribeJob = videoJobs.find((j) => j.id === "job_005");
      if (transcribeJob) {
        transcribeJob.progress = Math.min(100, (transcribeJob.progress || 0) + 8);
        if (transcribeJob.progress >= 100) {
          transcribeJob.status = "completed";
          const analyzeJob = videoJobs.find((j) => j.id === "job_006");
          if (analyzeJob) { analyzeJob.status = "processing"; analyzeJob.progress = 0; }
        }
      }
      const analyzeJob = videoJobs.find((j) => j.id === "job_006");
      if (analyzeJob && analyzeJob.status === "processing") {
        analyzeJob.progress = Math.min(100, (analyzeJob.progress || 0) + 5);
        if (analyzeJob.progress >= 100) {
          analyzeJob.status = "completed";
          if (videoJobs.every((j) => j.status === "completed")) {
            const v = mockVideos.find((mv) => mv.id === videoId);
            if (v) v.status = "ready";
          }
        }
      }
    }

    return mockResponse(config, 200, {
      status: "success",
      data: { video: { ...video, transcripts: [], highlights: mockHighlights[videoId] || [], jobs: videoJobs } },
    });
  }

  if (url.match(/^\/api\/videos\/[\w-]+\/analyze$/) && method === "POST") {
    return mockResponse(config, 202, { status: "accepted", message: "Analysis started", data: { job_id: generateId("job") } });
  }

  if (url.match(/^\/api\/videos\/[\w-]+\/highlights$/) && method === "GET") {
    const videoId = url.split("/")[4];
    const highlights = mockHighlights[videoId] || [];
    return mockResponse(config, 200, { status: "success", data: { video_id: videoId, highlights, total: highlights.length } });
  }

  if (url.match(/^\/api\/videos\/[\w-]+$/) && method === "DELETE") {
    return mockResponse(config, 200, { status: "success", data: { message: "Video deleted successfully" } });
  }

  // ── Clips ──
  if (url === "/api/clips/generate" && method === "POST") {
    const body = JSON.parse(config.data || "{}");
    const clip: Clip = {
      id: generateId("clip"), video_id: body.video_id, highlight_id: body.highlight_id, user_id: "user_demo_001",
      file_url: "/generated-clips/" + generateId("clip") + ".mp4",
      duration: body.duration ? parseInt(body.duration, 10) : 30,
      size: 3_200_000,
      created_at: new Date().toISOString(),
      thumbnail_url: "/generated-clips/thumb_placeholder.jpg",
      preview_url: "/generated-clips/preview_placeholder.mp4",
    };
    mockClips.unshift(clip);
    return mockResponse(config, 201, {
      status: "success",
      data: { clip: { ...clip, aspect_ratio: body.aspect_ratio || "16:9", quality: body.quality || "720p" } },
    });
  }

  if (url === "/api/clips" && method === "GET") {
    const videoId = config.params?.video_id;
    const clips = videoId ? mockClips.filter((c) => c.video_id === videoId) : mockClips;
    return mockResponse(config, 200, { status: "success", data: { clips, total: clips.length } });
  }

  if (url.match(/^\/api\/clips\/[\w-]+$/) && method === "GET") {
    const clipId = url.split("/").pop()!;
    const clip = mockClips.find((c) => c.id === clipId);
    if (!clip) return mockResponse(config, 404, { status: "error", message: "Clip not found" });
    return mockResponse(config, 200, { status: "success", data: { clip } });
  }

  if (url.match(/^\/api\/clips\/[\w-]+$/) && method === "DELETE") {
    return mockResponse(config, 200, { status: "success", data: { message: "Clip deleted successfully" } });
  }

  if (url.match(/^\/api\/download\/[\w-]+$/) && method === "GET") {
    return mockResponse(config, 200, new Blob(["mock video content"], { type: "video/mp4" }));
  }

  // ── Admin ──
  if (url === "/api/admin/jobs" && method === "GET") {
    return mockResponse(config, 200, {
      status: "success",
      data: {
        jobs: mockJobs, total: mockJobs.length,
        failed_count: mockJobs.filter(j => j.status === "failed").length,
        processing_count: mockJobs.filter(j => j.status === "processing" || j.status === "pending").length,
        completed_count: mockJobs.filter(j => j.status === "completed").length,
      },
    });
  }

  if (url === "/api/admin/users" && method === "GET") {
    const mockUsers = [
      { id: "user_demo_001", email: "demo@test.com", name: "Demo User", role: "admin", created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
      { id: "user_admin_001", email: "admin@cliphunter.ai", name: "System Admin", role: "admin", created_at: new Date(Date.now() - 86400000 * 60).toISOString() },
      { id: "user_002", email: "creator@test.com", name: "Video Creator", role: "user", created_at: new Date(Date.now() - 86400000 * 15).toISOString() },
      { id: "user_003", email: "editor@test.com", name: "Content Editor", role: "user", created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
    ];
    return mockResponse(config, 200, { status: "success", data: { users: mockUsers, total: mockUsers.length } });
  }

  if (url === "/api/admin/storage" && method === "GET") {
    return mockResponse(config, 200, {
      status: "success",
      data: {
        uploads_size: 2_456_000_000, generated_clips_size: 1_234_000_000, total_size: 3_690_000_000,
        free_space: 45_000_000_000, total_space: 100_000_000_000,
        uploads_path: "/app/uploads", generated_clips_path: "/app/generated-clips",
      },
    });
  }

  if (url === "/api/admin/analytics" && method === "GET") {
    return mockResponse(config, 200, {
      status: "success",
      data: {
        total_videos: 47, total_clips: 156, total_users: 12, avg_processing_time: 34.5,
        videos_today: 5, clips_today: 18, videos_this_week: 23, clips_this_week: 72,
        top_video: { id: "vid_001", title: "Epic Football Highlights 2024", clips_count: 8 },
        processing_breakdown: {
          transcribe: { avg_time: 12.3, total: 47 },
          analyze: { avg_time: 18.7, total: 45 },
          generate: { avg_time: 8.5, total: 42 },
        },
      },
    });
  }

  // Not a mock route — let the real request go through
  return;
}

// ─── Setup Axios Request Interceptor ──────────────────────
export function setupMockApi() {
  if (typeof window === "undefined") return;
  if (initialized) return;
  if (process.env.NEXT_PUBLIC_USE_MOCK === "false") return;

  initialized = true;
  console.log("[MockAPI] 🧪 Mock API request interceptor active");

  // Intercept at the REQUEST level and short-circuit with a custom adapter.
  // This completely prevents any actual HTTP request from being made,
  // which means NO CORS preflight requests = no CORS errors.
  api.interceptors.request.use(
    async (config: AxiosRequestConfig) => {
      const mockResult = await handleMockRoute(config);
      if (mockResult) {
        // Override the adapter to return our mock data immediately.
        // The actual HTTP request never fires.
        (config as any).adapter = () => Promise.resolve(mockResult);
      }
      return config;
    },
    (error: any) => Promise.reject(error)
  );
}
