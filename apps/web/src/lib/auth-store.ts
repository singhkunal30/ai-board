'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser } from '@ai-board/shared';

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: PublicUser, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
}

/**
 * Auth/session store, persisted to localStorage so a refresh keeps the user
 * signed in. Tokens are read by the API client for the Authorization header
 * and the realtime connection.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'ai-board-auth' },
  ),
);
