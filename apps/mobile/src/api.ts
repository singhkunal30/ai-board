import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './config';
import type { AuthResult, AuthTokens } from './types';

const ACCESS_KEY = 'ai-board-access';
const REFRESH_KEY = 'ai-board-refresh';

let accessToken: string | null = null;
let refreshToken: string | null = null;

export async function loadTokens(): Promise<void> {
  accessToken = await AsyncStorage.getItem(ACCESS_KEY);
  refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
}

export async function setTokens(tokens: AuthTokens): Promise<void> {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  await AsyncStorage.multiSet([
    [ACCESS_KEY, tokens.accessToken],
    [REFRESH_KEY, tokens.refreshToken],
  ]);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function hasSession(): boolean {
  return Boolean(accessToken);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  anonymous?: boolean;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          await clearTokens();
          return false;
        }
        await setTokens((await res.json()) as AuthTokens);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

/** Typed API client: adds the bearer token and refreshes once on a 401. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const doFetch = () => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (!opts.anonymous && accessToken) headers.authorization = `Bearer ${accessToken}`;
    return fetch(`${getApiUrl()}/api${path}`, {
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
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, res.status);
  }
  return data as T;
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
  logout: (token: string) =>
    api<void>('/auth/logout', { method: 'POST', body: { refreshToken: token }, anonymous: true }),
};

export function currentRefreshToken(): string | null {
  return refreshToken;
}
