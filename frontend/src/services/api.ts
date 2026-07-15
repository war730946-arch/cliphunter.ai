import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import type { ApiError } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// ─── Axios Instance ──────────────────────────────────────
const api = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// ─── Attach JWT ──────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("cliphunter_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Handle 401 ──────────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("cliphunter_token");
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post("/auth/register", data),

  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),

  getProfile: () => api.get("/auth/me"),
};

// ─── Videos ──────────────────────────────────────────────
export const videoApi = {
  /** POST /api/videos — accepts JSON with { source_url, title } */
  createFromUrl: (data: { source_url: string; title?: string }) =>
    api.post("/videos", data),

  /** POST /api/videos — accepts multipart form with a video file */
  createFromFile: (formData: FormData) =>
    api.post("/videos", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
    }),

  /** GET /api/videos — list user's videos */
  list: (params?: { page?: number; limit?: number }) =>
    api.get("/videos", { params }),

  /** GET /api/videos/:id — single video with transcripts, highlights, jobs */
  get: (id: string) => api.get(`/videos/${id}`),

  /** DELETE /api/videos/:id — delete video */
  delete: (id: string) => api.delete(`/videos/${id}`),

  /** POST /api/videos/:id/analyze — trigger analysis pipeline */
  analyze: (id: string) => api.post(`/videos/${id}/analyze`),

  /** GET /api/videos/:id/highlights — get top 10 highlights */
  getHighlights: (id: string) => api.get(`/videos/${id}/highlights`),
};

// ─── Clips ───────────────────────────────────────────────
export const clipApi = {
  /** POST /api/clips/generate — generate a clip from a highlight */
  generate: (data: {
    video_id: string;
    highlight_id: string;
    duration?: string;
    custom_start?: number;
    custom_end?: number;
    aspect_ratio: string;
    quality?: string;
  }) => api.post("/clips/generate", data),

  /** GET /api/clips — list user's clips (optional ?video_id= filter) */
  list: (params?: { video_id?: string }) =>
    api.get("/clips", { params }),

  /** GET /api/clips/:id — single clip detail */
  get: (id: string) => api.get(`/clips/${id}`),

  /** DELETE /api/clips/:id — delete clip */
  delete: (id: string) => api.delete(`/clips/${id}`),

  /** GET /api/download/:id — download clip with optional quality */
  download: (id: string, quality: "720p" | "1080p" = "720p") =>
    api.get(`/download/${id}`, { params: { quality }, responseType: "blob" }),
};

// ─── Admin ───────────────────────────────────────────────
export const adminApi = {
  /** GET /api/admin/jobs — all jobs with status/progress */
  listJobs: () =>
    api.get("/admin/jobs"),

  /** GET /api/admin/users — list all registered users */
  listUsers: () =>
    api.get("/admin/users"),

  /** GET /api/admin/storage — total disk space used */
  getStorage: () =>
    api.get("/admin/storage"),

  /** GET /api/admin/analytics — total videos, clips, avg time */
  getAnalytics: () =>
    api.get("/admin/analytics"),

  /** GET /api/admin/users/:id — single user detail */
  getUser: (id: string) =>
    api.get(`/admin/users/${id}`),
};

export default api;
