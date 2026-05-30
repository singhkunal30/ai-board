import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const KEY = 'ai-board-api-url';

const fallback =
  (Constants.expoConfig?.extra?.defaultApiUrl as string | undefined) ?? 'http://10.0.2.2:4000';

// In-memory cache so synchronous callers (the API client) always have a value.
let current = fallback;

/** Load the persisted API base URL at app start. */
export async function loadApiUrl(): Promise<string> {
  const stored = await AsyncStorage.getItem(KEY);
  if (stored) current = stored.replace(/\/$/, '');
  return current;
}

export function getApiUrl(): string {
  return current;
}

export async function setApiUrl(url: string): Promise<void> {
  current = url.trim().replace(/\/$/, '');
  await AsyncStorage.setItem(KEY, current);
}

/** Derive the realtime WebSocket URL from the API base URL. */
export function getWsUrl(): string {
  return `${current.replace(/^http/, 'ws')}/realtime`;
}
