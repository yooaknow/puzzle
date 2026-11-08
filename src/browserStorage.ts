import { WebStorage } from './types';

// 서버에 저장하기 전 버전이 계정(비밀번호 포함)과 퍼즐 이미지를 통째로 넣어두던 키들.
// 이제 쓰지 않고, 브라우저 저장 공간을 차지해 로그인 정보 저장까지 막을 수 있어서 지운다.
const LEGACY_KEY_PREFIXES = [
  'puzzlw:authAccounts',
  'puzzlw:authSession',
  'puzzlw:puzzleIndex',
  'puzzlw:inbox:',
  'puzzlw:sharedPuzzle',
];

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

export function clearLegacyLocalData() {
  try {
    const storage = getBrowserStorage();
    if (!storage) {
      return;
    }
    const staleKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && LEGACY_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        staleKeys.push(key);
      }
    }
    staleKeys.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage can be unavailable in private browsing or restricted webviews.
  }
}
