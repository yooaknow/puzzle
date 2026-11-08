import { readStoredJson, writeStoredJson } from './browserStorage';
import { PUZZLE_IMAGE_BUCKET, supabase } from './supabaseClient';
import { GridSize } from './types';

// 퍼즐은 Supabase에 저장한다. 이미지는 puzzles 버킷, 기록은 서버 함수(supabase/migrations 참고)로 읽고 쓴다.
// 그래서 공유 링크를 다른 기기에서 열어도 같은 퍼즐이 보인다.

// 퍼즐을 만든 브라우저만 아는 값. 로그인 전에 만든 퍼즐을 다시 고치거나 로그인 후 내 것으로 가져올 때 쓴다.
const EDIT_TOKENS_KEY = 'puzzlw:puzzleEditTokens';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PuzzleRecord = {
  id: string;
  gridSize: GridSize;
  createdAt: number;
  senderName: string | null;
  // 사진 위에 그림·글씨까지 합친 원본 이미지 주소. 칸 나누는 선은 들어 있지 않다.
  sourceUri: string;
};

export type ReceivedPuzzle = PuzzleRecord & {
  receivedAt: number;
  solvedAt: number | null;
};

type PuzzleRow = {
  id: string;
  grid_size: number;
  image_path: string;
  created_at: string;
  sender_name: string | null;
};

type ReceivedPuzzleRow = PuzzleRow & {
  received_at: string;
  solved_at: string | null;
};

type CreatedPuzzleRow = {
  id: string;
  edit_token: string;
};

// 같은 사진으로 이미 만든 퍼즐(id)이 있으면 덮어써서 공유 링크를 그대로 유지한다.
export async function savePuzzle({
  id,
  sourceUri,
  gridSize,
  recipientSlug,
}: {
  id?: string | null;
  sourceUri: string;
  gridSize: GridSize;
  recipientSlug: string | null;
}): Promise<PuzzleRecord> {
  const imagePath = await uploadPuzzleImage(sourceUri);
  const editToken = id ? readEditTokens()[id] : undefined;
  let puzzleId: string | null = null;

  if (id && editToken) {
    const { data, error } = await supabase.rpc('update_puzzle', {
      p_puzzle_id: id,
      p_edit_token: editToken,
      p_image_path: imagePath,
      p_grid_size: gridSize,
    });
    if (error) {
      throw error;
    }
    puzzleId = data === true ? id : null;
  }

  if (!puzzleId) {
    const { data, error } = await supabase.rpc('create_puzzle', {
      p_image_path: imagePath,
      p_grid_size: gridSize,
      p_recipient_slug: recipientSlug,
    });
    const created = (data as CreatedPuzzleRow[] | null)?.[0];
    if (error || !created) {
      throw error ?? new Error('퍼즐을 만들지 못했어요.');
    }
    writeEditTokens({ ...readEditTokens(), [created.id]: created.edit_token });
    puzzleId = created.id;
  }

  const puzzle = await getPuzzle(puzzleId);
  if (!puzzle) {
    throw new Error('저장한 퍼즐을 찾지 못했어요.');
  }
  return puzzle;
}

export async function getPuzzle(puzzleId: string): Promise<PuzzleRecord | null> {
  // 서버에 저장하기 전 버전의 공유 링크는 id 모양이 달라서 서버에 물어볼 필요도 없다.
  if (!UUID_PATTERN.test(puzzleId)) {
    return null;
  }
  const { data, error } = await supabase.rpc('get_puzzle', { p_puzzle_id: puzzleId });
  if (error) {
    throw error;
  }
  const row = (data as PuzzleRow[] | null)?.[0];
  return row ? toPuzzleRecord(row) : null;
}

// 로그인하지 않고 만든 퍼즐을 나중에 로그인한 계정의 보낸 퍼즐로 옮긴다.
export async function claimSentPuzzle(puzzleId: string) {
  const editToken = readEditTokens()[puzzleId];
  if (!editToken) {
    return false;
  }
  const { data, error } = await supabase.rpc('claim_puzzle', { p_puzzle_id: puzzleId, p_edit_token: editToken });
  if (error) {
    throw error;
  }
  return data === true;
}

export async function listSentPuzzles(): Promise<PuzzleRecord[]> {
  const { data, error } = await supabase.rpc('list_sent_puzzles');
  if (error) {
    throw error;
  }
  return ((data ?? []) as PuzzleRow[]).map(toPuzzleRecord);
}

// 공유 링크로 열어본 퍼즐 + 내 프로필 링크로 누군가 만들어 준 퍼즐(열어보기 전이어도).
export async function listReceivedPuzzles(): Promise<ReceivedPuzzle[]> {
  const { data, error } = await supabase.rpc('list_received_puzzles');
  if (error) {
    throw error;
  }
  return ((data ?? []) as ReceivedPuzzleRow[]).map(toReceivedPuzzle);
}

// 프로필 링크 화면에 보이는, 그 사람이 다 맞춘 퍼즐.
export async function listProfilePuzzles(slug: string): Promise<ReceivedPuzzle[]> {
  const { data, error } = await supabase.rpc('list_profile_puzzles', { p_slug: slug });
  if (error) {
    throw error;
  }
  return ((data ?? []) as ReceivedPuzzleRow[]).map(toReceivedPuzzle);
}

// 공유 링크로 연 퍼즐을 아직 안 푼 퍼즐로 담아둔다. 내가 만든 퍼즐은 서버가 걸러낸다.
export async function receivePuzzle(puzzleId: string) {
  if (!UUID_PATTERN.test(puzzleId)) {
    return;
  }
  const { error } = await supabase.rpc('receive_puzzle', { p_puzzle_id: puzzleId });
  if (error) {
    throw error;
  }
}

export async function markPuzzleSolved(puzzleId: string) {
  if (!UUID_PATTERN.test(puzzleId)) {
    return;
  }
  const { error } = await supabase.rpc('mark_puzzle_solved', { p_puzzle_id: puzzleId });
  if (error) {
    throw error;
  }
}

// 탈퇴 전에 내가 보낸 퍼즐 이미지 파일을 지운다. 기록은 delete_my_account가 지운다.
export async function deleteSentPuzzleImages() {
  const { data, error } = await supabase.rpc('list_sent_puzzles');
  if (error) {
    throw error;
  }
  const paths = ((data ?? []) as PuzzleRow[]).map((row) => row.image_path);
  if (paths.length === 0) {
    return;
  }
  const { error: removeError } = await supabase.storage.from(PUZZLE_IMAGE_BUCKET).remove(paths);
  if (removeError) {
    throw removeError;
  }
}

async function uploadPuzzleImage(sourceUri: string) {
  // 꾸미기 결과는 data URL, 꾸미기에 실패하면 원본 사진(blob URL)이 온다. fetch로 둘 다 파일로 바꿀 수 있다.
  const image = await (await fetch(sourceUri)).blob();
  const contentType = image.type || 'image/jpeg';
  const path = `${createRandomId()}.${getImageExtension(contentType)}`;
  const { error } = await supabase.storage.from(PUZZLE_IMAGE_BUCKET).upload(path, image, {
    contentType,
    // 파일 이름이 매번 새로 만들어져 내용이 바뀌지 않으니 오래 캐시해도 된다.
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) {
    throw error;
  }
  return path;
}

function getImageUrl(imagePath: string) {
  return supabase.storage.from(PUZZLE_IMAGE_BUCKET).getPublicUrl(imagePath).data.publicUrl;
}

function getImageExtension(contentType: string) {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}

function toPuzzleRecord(row: PuzzleRow): PuzzleRecord {
  return {
    id: row.id,
    gridSize: parseGridSize(row.grid_size),
    createdAt: Date.parse(row.created_at),
    senderName: row.sender_name,
    sourceUri: getImageUrl(row.image_path),
  };
}

function toReceivedPuzzle(row: ReceivedPuzzleRow): ReceivedPuzzle {
  return {
    ...toPuzzleRecord(row),
    receivedAt: Date.parse(row.received_at),
    solvedAt: row.solved_at ? Date.parse(row.solved_at) : null,
  };
}

function parseGridSize(value: number): GridSize {
  return value === 4 || value === 5 ? value : 3;
}

function readEditTokens() {
  const tokens = readStoredJson<unknown>(EDIT_TOKENS_KEY, {});
  return tokens && typeof tokens === 'object' ? (tokens as Record<string, string>) : {};
}

function writeEditTokens(tokens: Record<string, string>) {
  writeStoredJson(EDIT_TOKENS_KEY, tokens);
}

// 파일 이름은 추측할 수 없어야 한다. 휴대폰에서 http 주소로 열면 randomUUID가 없어서 getRandomValues로 만든다.
function createRandomId() {
  const webCrypto = (globalThis as unknown as {
    crypto?: { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => Uint8Array };
  }).crypto;
  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    bytes.forEach((_, index) => {
      bytes[index] = Math.floor(Math.random() * 256);
    });
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
