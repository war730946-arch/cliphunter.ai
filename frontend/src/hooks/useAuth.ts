"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/services/api";
import type { User, LoginInput, RegisterInput } from "@/types";

// ─── Auth Store ──────────────────────────────────────────
interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  loadProfile: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (input) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.login(input);
          const { data: responseBody } = res;
          localStorage.setItem("cliphunter_token", responseBody.token);
          set({ user: responseBody.data.user, token: responseBody.token, isLoading: false });
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || "Login failed. Please try again.";
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      register: async (input) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.register(input);
          const { data: responseBody } = res;
          localStorage.setItem("cliphunter_token", responseBody.token);
          set({ user: responseBody.data.user, token: responseBody.token, isLoading: false });
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || "Registration failed. Please try again.";
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem("cliphunter_token");
        set({ user: null, token: null });
      },

      loadProfile: async () => {
        const { token } = get();
        if (!token) return;

        try {
          const res = await authApi.getProfile();
          set({ user: res.data.data.user });
        } catch {
          set({ user: null, token: null });
          localStorage.removeItem("cliphunter_token");
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "cliphunter_auth",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
