import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  api,
  authApi,
  clearTokens,
  currentRefreshToken,
  hasSession,
  loadTokens,
  setTokens,
} from './api';
import { loadApiUrl } from './config';
import type { PublicUser } from './types';

interface AuthState {
  ready: boolean;
  user: PublicUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    (async () => {
      await loadApiUrl();
      await loadTokens();
      if (hasSession()) {
        try {
          // Validate the stored session by fetching the profile.
          const me = await api<PublicUser>('/users/me');
          setUser(me);
        } catch {
          await clearTokens();
        }
      }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: u, tokens } = await authApi.login(email, password);
    await setTokens(tokens);
    setUser(u);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { user: u, tokens } = await authApi.register(email, password, name);
    await setTokens(tokens);
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    const rt = currentRefreshToken();
    if (rt) await authApi.logout(rt).catch(() => undefined);
    await clearTokens();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ ready, user, signIn, signUp, signOut }),
    [ready, user, signIn, signUp, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
