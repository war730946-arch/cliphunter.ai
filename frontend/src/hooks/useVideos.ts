"use client";

import { create } from "zustand";
import { videoApi } from "@/services/api";
import type { Video } from "@/types";

// ─── Video Store ─────────────────────────────────────────
interface VideoState {
  videos: Video[];
  total: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchVideos: (params?: { page?: number; limit?: number; status?: string }) => Promise<void>;
  deleteVideo: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useVideos = create<VideoState>()((set, get) => ({
  videos: [],
  total: 0,
  isLoading: false,
  error: null,

  fetchVideos: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await videoApi.list(params);
      const { data: responseBody } = res;
      set({ videos: responseBody.data.videos, total: responseBody.data.total, isLoading: false });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load videos.";
      set({ error: message, isLoading: false });
    }
  },

  deleteVideo: async (id) => {
    try {
      await videoApi.delete(id);
      set((state) => ({
        videos: state.videos.filter((v) => v.id !== id),
        total: state.total - 1,
      }));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to delete video.";
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
