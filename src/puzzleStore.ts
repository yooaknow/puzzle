import { getBrowserStorage, readStoredJson, removeStoredItem, writeStoredJson } from './browserStorage';
import { GridSize, WebStorage } from './types';

// 지금은 퍼즐을 브라우저 localStorage에 둔다. 그래서 공유 링크도 같은 브라우저에서만 열린다.
// 서버를 붙일 때는 이 파일의 함수들만 API 호출로 바꾸면 된다.
const PUZZLE_INDEX_KEY = 'puzzlw:puzzleIndex';
const INBOX_PREFIX = 'puzzlw:inbox:';
// 이미지 키는 예전에 만든 공유 링크가 계속 열리도록 기존 이름을 그대로 쓴다.
const PUZZLE_SOURCE_PREFIX = 'puzzlw:sharedPuzzleSourceUri:';
const PUZZLE_GRID_SIZE_PREFIX = 'puzzlw:sharedPuzzleGridSize:';
// 예전 버전이 따로 저장하던 칸 선 포함 이미지와 "마지막 퍼즐" 값. 이제는 읽지 않는다.
const LEGACY_KEYS = ['puzzlw:sharedPuzzleUri', 'puzzlw:sharedPuzzleSourceUri', 'puzzlw:sharedPuzzleGridSize'];
const LEGACY_PUZZLE_PREFIX = 'puzzlw:sharedPuzzleUri:';

type PuzzleMeta = {
  id: string;
  gridSize: GridSize;
  createdAt: number;
  senderEmail: string | null;
  senderName: string | null;
  recipientSlug: string | null;
};

type InboxEntry = {
  puzzleId: string;
  receivedAt: number;
  solvedAt: number | null;
};

export type PuzzleRecord = PuzzleMeta & {
  // 사진 위에 그림·글씨까지 합친 원본. 칸 나누는 선은 들어 있지 않다.
  sourceUri: string;
};

export type ReceivedPuzzle = PuzzleRecord & {
  receivedAt: number;
  solvedAt: number | null;
};

export type PuzzleOwner = {
  email: string;
  name: string;
};

export function savePuzzle({
  id,
  sourceUri,
  gridSize,
  sender,
  recipientSlug,
}: {
  id?: string | null;
  sourceUri: string;
  gridSize: GridSize;
  sender: PuzzleOwner | null;
  recipientSlug: string | null;
}): PuzzleRecord | null {
  const index = readIndex();
  const existing = id ? index.find((meta) => meta.id === id) : undefined;
  const meta: PuzzleMeta = existing
    ? {
        ...existing,
        gridSize,
        senderEmail: existing.senderEmail ?? sender?.email ?? null,
        senderName: existing.senderName ?? sender?.name ?? null,
      }
    : {
        id: createPuzzleId(),
        gridSize,
        createdAt: Date.now(),
        senderEmail: sender?.email ?? null,
        senderName: sender?.name ?? null,
        recipientSlug,
      };

  if (!writePuzzleImage(meta.id, sourceUri, gridSize)) {
    return null;
  }

  writeIndex([meta, ...readIndex().filter((item) => item.id !== meta.id)]);
  return { ...meta, sourceUri };
}

export function getPuzzle(puzzleId: string): PuzzleRecord | null {
  const storage = getBrowserStorage();
  try {
    const sourceUri = storage?.getItem(`${PUZZLE_SOURCE_PREFIX}${puzzleId}`);
    if (!sourceUri) {
      return null;
    }

    const meta = readIndex().find((item) => item.id === puzzleId) ?? {
      // 목록이 생기기 전에 만든 퍼즐은 이미지만 남아 있다.
      id: puzzleId,
      gridSize: parseGridSize(storage?.getItem(`${PUZZLE_GRID_SIZE_PREFIX}${puzzleId}`)),
      createdAt: 0,
      senderEmail: null,
      senderName: null,
      recipientSlug: null,
    };
    return { ...meta, sourceUri };
  } catch {
    return null;
  }
}

// 로그인하지 않고 만든 퍼즐을 나중에 로그인한 계정의 보낸 퍼즐로 옮긴다.
export function claimSentPuzzle(puzzleId: string, owner: PuzzleOwner) {
  const index = readIndex();
  writeIndex(
    index.map((meta) =>
      meta.id === puzzleId && !meta.senderEmail ? { ...meta, senderEmail: owner.email, senderName: owner.name } : meta,
    ),
  );
}

export function listSentPuzzles(email: string): PuzzleRecord[] {
  return readIndex()
    .filter((meta) => meta.senderEmail === email)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((meta) => getPuzzle(meta.id))
    .filter((puzzle): puzzle is PuzzleRecord => puzzle !== null);
}

export function listReceivedPuzzles(account: { email: string; slug: string }): ReceivedPuzzle[] {
  const inbox = readInbox(account.email);
  const inboxIds = new Set(inbox.map((entry) => entry.puzzleId));
  // 내 프로필 링크로 누군가 만들어 준 퍼즐은 열어보기 전에도 받은 퍼즐에 들어온다.
  const addressedEntries: InboxEntry[] = readIndex()
    .filter((meta) => meta.recipientSlug === account.slug && !inboxIds.has(meta.id))
    .map((meta) => ({ puzzleId: meta.id, receivedAt: meta.createdAt, solvedAt: null }));

  return [...inbox, ...addressedEntries]
    .map((entry) => {
      const puzzle = getPuzzle(entry.puzzleId);
      return puzzle ? { ...puzzle, receivedAt: entry.receivedAt, solvedAt: entry.solvedAt } : null;
    })
    .filter((puzzle): puzzle is ReceivedPuzzle => puzzle !== null)
    .sort((a, b) => b.receivedAt - a.receivedAt);
}

// 공유 링크로 연 퍼즐을 아직 안 푼 퍼즐로 담아둔다. 내가 만든 퍼즐은 담지 않는다.
export function receivePuzzle(email: string, puzzleId: string) {
  const puzzle = getPuzzle(puzzleId);
  const inbox = readInbox(email);
  if (!puzzle || puzzle.senderEmail === email || inbox.some((entry) => entry.puzzleId === puzzleId)) {
    return;
  }
  writeInbox(email, [{ puzzleId, receivedAt: Date.now(), solvedAt: null }, ...inbox]);
}

export function markPuzzleSolved(email: string, puzzleId: string) {
  const inbox = readInbox(email);
  const solvedAt = Date.now();
  const existing = inbox.find((entry) => entry.puzzleId === puzzleId);
  writeInbox(
    email,
    existing
      ? inbox.map((entry) => (entry.puzzleId === puzzleId ? { ...entry, solvedAt: entry.solvedAt ?? solvedAt } : entry))
      : [{ puzzleId, receivedAt: getPuzzle(puzzleId)?.createdAt || solvedAt, solvedAt }, ...inbox],
  );
}

// 회원 탈퇴 시 그 계정이 보낸 퍼즐과 받은 퍼즐 기록을 지운다.
export function deletePuzzleDataFor(email: string) {
  const index = readIndex();
  index.filter((meta) => meta.senderEmail === email).forEach((meta) => removePuzzleImage(meta.id));
  writeIndex(index.filter((meta) => meta.senderEmail !== email));
  removeStoredItem(`${INBOX_PREFIX}${email}`);
}

function writePuzzleImage(puzzleId: string, sourceUri: string, gridSize: GridSize) {
  const storage = getBrowserStorage();
  if (!storage) {
    return false;
  }

  const write = () => {
    storage.setItem(`${PUZZLE_SOURCE_PREFIX}${puzzleId}`, sourceUri);
    storage.setItem(`${PUZZLE_GRID_SIZE_PREFIX}${puzzleId}`, String(gridSize));
  };

  try {
    write();
    return true;
  } catch {
    // 퍼즐 이미지가 data URL이라 쌓이면 용량이 찬다.
    // 예전 버전이 남긴 이미지부터 비우고, 그래도 모자라면 가장 오래된 퍼즐부터 지운다.
    clearLegacyPuzzleImages(storage);
    let index = readIndex();
    for (;;) {
      try {
        write();
        return true;
      } catch {
        const oldest = index.filter((meta) => meta.id !== puzzleId).sort((a, b) => a.createdAt - b.createdAt)[0];
        if (!oldest) {
          return false;
        }
        removePuzzleImage(oldest.id);
        index = index.filter((meta) => meta.id !== oldest.id);
        writeIndex(index);
      }
    }
  }
}

function removePuzzleImage(puzzleId: string) {
  removeStoredItem(`${PUZZLE_SOURCE_PREFIX}${puzzleId}`);
  removeStoredItem(`${PUZZLE_GRID_SIZE_PREFIX}${puzzleId}`);
}

function clearLegacyPuzzleImages(storage: WebStorage) {
  const staleKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && (LEGACY_KEYS.includes(key) || key.startsWith(LEGACY_PUZZLE_PREFIX))) {
      staleKeys.push(key);
    }
  }
  staleKeys.forEach((key) => storage.removeItem(key));
}

function createPuzzleId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readIndex() {
  const index = readStoredJson<unknown>(PUZZLE_INDEX_KEY, []);
  return Array.isArray(index) ? (index as PuzzleMeta[]) : [];
}

function writeIndex(index: PuzzleMeta[]) {
  writeStoredJson(PUZZLE_INDEX_KEY, index);
}

function readInbox(email: string) {
  const inbox = readStoredJson<unknown>(`${INBOX_PREFIX}${email}`, []);
  return Array.isArray(inbox) ? (inbox as InboxEntry[]) : [];
}

function writeInbox(email: string, inbox: InboxEntry[]) {
  writeStoredJson(`${INBOX_PREFIX}${email}`, inbox);
}

function parseGridSize(value?: string | null): GridSize {
  return value === '4' || value === '5' ? (Number(value) as GridSize) : 3;
}
