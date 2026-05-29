'use client';

import type { AuthTokens, PublicUser } from '@ai-board/shared';
import { API_URL } from './config';
import { useAuthStore } from './auth-store';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip auth header + refresh logic (used by login/register/refresh). */
  anonymous?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Attempts a single refresh-token rotation; dedupes concurrent callers. */
async function tryRefresh(): Promise<boolean> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          clear();
          return false;
        }
        const tokens = (await res.json()) as AuthTokens;
        setTokens(tokens.accessToken, tokens.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * Typed API client. Adds the bearer token, transparently refreshes once on a
 * 401, and throws `ApiError` with the server's structured message on failure.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (!opts.anonymous) {
      const token = useAuthStore.getState().accessToken;
      if (token) headers.authorization = `Bearer ${token}`;
    }
    return fetch(`${API_URL}/api${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  };

  let res = await doFetch();
  if (res.status === 401 && !opts.anonymous && (await tryRefresh())) {
    res = await doFetch();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const message = (data?.message as string) ?? `Request failed (${res.status})`;
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, res.status, data?.details);
  }
  return data as T;
}

// ── Typed endpoint helpers ───────────────────────────────────────────────────

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<AuthResult>('/auth/login', { method: 'POST', body: { email, password }, anonymous: true }),
  register: (email: string, password: string, name: string) =>
    api<AuthResult>('/auth/register', {
      method: 'POST',
      body: { email, password, name },
      anonymous: true,
    }),
  logout: (refreshToken: string) =>
    api<void>('/auth/logout', { method: 'POST', body: { refreshToken }, anonymous: true }),
};
