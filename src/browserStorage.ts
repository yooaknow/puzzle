import { WebStorage } from './types';

export function getBrowserStorage() {
  return (globalThis as unknown as { localStorage?: WebStorage }).localStorage;
}

export function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const value = getBrowserStorage()?.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key: string, value: unknown) {
  try {
    getBrowserStorage()?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Storage can be unavailable in private browsing or restricted webviews.
    return false;
  }
}

export function removeStoredItem(key: string) {
  try {
    getBrowserStorage()?.removeItem(key);
  } catch {
    // Storage can be unavailable in private browsing or restricted webviews.
  }
}
