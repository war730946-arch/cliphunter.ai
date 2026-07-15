// ─── User & Auth ──────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  created_at: string;
}

export interface AuthResponse {
  status: "success";
  data: { user: User };
  token: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

// ─── Video ───────────────────────────────────────────────
export type VideoStatus = "pending" | "processing" | "ready" | "failed";

export interface Video {
  id: string;
  user_id: string;
  title: string | null;
  source_url: string;
  file_url: string | null;
  duration: number | null;
  thumbnail: string | null;
  status: VideoStatus;
  created_at: string;
  // Included in list response
  _count?: { clips: number; highlights: number };
  jobs?: JobSummary[];
}

export interface JobSummary {
  id: string;
  status: string;
  progress: number;
  type: string;
}

// ─── Job ─────────────────────────────────────────────────
export interface Job {
  id: string;
  video_id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  created_at: string;
}

// ─── Transcript ──────────────────────────────────────────
export interface Transcript {
  id: string;
  video_id: string;
  content: string;
  language: string;
  created_at: string;
}

// ─── Highlight ───────────────────────────────────────────
export interface Highlight {
  id: string;
  video_id: string;
  start_time: number;
  end_time: number;
  score: number;
  summary: string | null;
  created_at: string;
}

// ─── API Response Wrappers ───────────────────────────────
export interface ApiSuccessResponse<T> {
  status: "success";
  data: T;
}

export interface VideoCreateResponse {
  video: {
    id: string;
    title: string | null;
    source_url: string;
    file_url: string | null;
    duration: number | null;
    status: string;
    created_at: string;
  };
}

export interface VideoListResponse {
  videos: Video[];
  total: number;
}

export interface VideoDetailResponse {
  video: Video & {
    transcripts?: Transcript[];
    highlights?: Highlight[];
    jobs?: Job[];
  };
}

export interface HighlightsResponse {
  video_id: string;
  highlights: Highlight[];
  total: number;
}

// ─── Clip ────────────────────────────────────────────────
export type ClipStatus = "generating" | "ready" | "failed";

export interface Clip {
  id: string;
  video_id: string;
  highlight_id: string | null;
  user_id: string;
  file_url: string | null;
  duration: number | null;
  size: number | null;
  created_at: string;
  // Included in detail response
  thumbnail_url?: string | null;
  preview_url?: string | null;
  highlight?: {
    id: string;
    summary: string | null;
    start_time: number;
    end_time: number;
    score: number;
  } | null;
  video?: {
    id: string;
    title: string | null;
    source_url: string;
  } | null;
}

export interface ClipGenerateResponse {
  status: "success";
  data: {
    clip: {
      id: string;
      video_id: string;
      highlight_id: string;
      duration: number | null;
      size: number | null;
      file_url: string | null;
      thumbnail_url: string;
      preview_url: string;
      aspect_ratio: string;
      quality: string;
      created_at: string;
    };
  };
}

export interface ClipListResponse {
  status: "success";
  data: {
    clips: Clip[];
    total: number;
  };
}

export interface ClipDetailResponse {
  status: "success";
  data: {
    clip: Clip & {
      thumbnail_url: string | null;
      preview_url: string | null;
    };
  };
}

// ─── Analysis ────────────────────────────────────────────
export interface AnalyzeResponse {
  status: "accepted";
  message: string;
  data: {
    job_id: string;
  };
}

// ─── API Error ───────────────────────────────────────────
export interface ApiError {
  status: "error";
  message: string;
}
