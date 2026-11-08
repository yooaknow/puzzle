import { AuthError } from '@supabase/supabase-js';

import { readStoredJson, removeStoredItem, writeStoredJson } from './browserStorage';
import { deleteSentPuzzleImages } from './puzzleStore';
import { supabase } from './supabaseClient';

// 로그인은 Supabase Auth가 맡는다. 화면이 바로 뜨도록 마지막 로그인 계정만 브라우저에 기억해 두고,
// 앱이 켜지면 서버 세션으로 다시 확인한다.
const ACCOUNT_CACHE_KEY = 'puzzlw:account';
// Supabase 기본 비밀번호 최소 길이
const MIN_PASSWORD_LENGTH = 6;

export type AuthAccount = {
  id: string;
  name: string;
  email: string;
  slug: string;
  createdAt?: number;
};

export type PublicProfile = {
  name: string;
  slug: string;
};

export type AuthCredentials = {
  mode: 'login' | 'signup';
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

export type AuthResult = { account: AuthAccount | null; error: string | null };

export async function authenticateAccount(credentials: AuthCredentials): Promise<AuthResult> {
  const email = credentials.email.trim().toLowerCase();
  const password = credentials.password;

  if (!email.includes('@')) {
    return { account: null, error: '이메일 형식을 확인해주세요.' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { account: null, error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해주세요.` };
  }

  try {
    if (credentials.mode === 'signup') {
      return await signUp(credentials.name.trim(), email, password, credentials.passwordConfirm);
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { account: null, error: describeAuthError(error) };
    }
    return await finishLogin(data.user.id, data.user.email ?? email);
  } catch {
    return { account: null, error: '서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.' };
  }
}

async function signUp(name: string, email: string, password: string, passwordConfirm: string): Promise<AuthResult> {
  if (name.length === 0) {
    return { account: null, error: '이름을 입력해주세요.' };
  }

  if (password !== passwordConfirm) {
    return { account: null, error: '비밀번호 확인이 일치하지 않아요.' };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // 프로필(이름, 공유 링크용 slug)은 서버의 가입 트리거가 이 값으로 만든다.
    options: { data: { name, slug_base: createProfileSlug(name) } },
  });

  if (error || !data.user) {
    return { account: null, error: describeAuthError(error) };
  }

  // 이메일 인증을 켜 둔 프로젝트에서는 이미 가입한 메일이어도 오류 대신 빈 계정이 온다.
  if (data.user.identities?.length === 0) {
    return { account: null, error: '이미 가입된 이메일이에요. 로그인해주세요.' };
  }

  if (!data.session) {
    return { account: null, error: '가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해주세요.' };
  }

  return finishLogin(data.user.id, data.user.email ?? email);
}

async function finishLogin(userId: string, email: string): Promise<AuthResult> {
  const account = await loadAccount(userId, email);
  if (!account) {
    await supabase.auth.signOut({ scope: 'local' });
    return { account: null, error: '계정 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.' };
  }
  return { account, error: null };
}

// 프로필이 없으면 null, 서버에 못 닿으면 예외.
async function loadAccount(userId: string, email: string): Promise<AuthAccount | null> {
  const { data, error } = await supabase.from('profiles').select('name, slug, created_at').eq('id', userId).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  const account: AuthAccount = {
    id: userId,
    name: data.name,
    email,
    slug: data.slug,
    createdAt: Date.parse(data.created_at),
  };
  writeStoredJson(ACCOUNT_CACHE_KEY, account);
  return account;
}

// 화면을 처음 그릴 때 쓰는 값. 서버 확인 전이라 틀릴 수 있어서 restoreAccount로 다시 맞춘다.
export function getCachedAccount() {
  const account = readStoredJson<unknown>(ACCOUNT_CACHE_KEY, null);
  return isAuthAccount(account) ? account : null;
}

// 저장된 서버 세션으로 계정을 되살린다. 세션이 없거나 만료됐으면 null.
// 서버에 닿지 못한 경우엔 지금 보이는 계정을 그대로 두도록 undefined를 준다.
export async function restoreAccount(): Promise<AuthAccount | null | undefined> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    const account = user ? await loadAccount(user.id, user.email ?? '') : null;
    if (!account) {
      // 세션이 없거나, 탈퇴 등으로 프로필이 사라진 경우
      removeStoredItem(ACCOUNT_CACHE_KEY);
      if (user) {
        await supabase.auth.signOut({ scope: 'local' });
      }
      return null;
    }
    return account;
  } catch {
    return undefined;
  }
}

export async function signOut() {
  removeStoredItem(ACCOUNT_CACHE_KEY);
  try {
    await supabase.auth.signOut();
  } catch {
    // 서버에 못 닿아도 이 기기에서는 로그아웃된 상태가 된다.
  }
}

// 보낸 퍼즐 이미지를 먼저 지우고, 계정과 퍼즐 기록은 서버 함수로 한 번에 지운다.
export async function deleteAccount() {
  await deleteSentPuzzleImages();
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    throw error;
  }
  removeStoredItem(ACCOUNT_CACHE_KEY);
  await supabase.auth.signOut({ scope: 'local' });
}

export async function findProfileBySlug(slug: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('get_profile_by_slug', { p_slug: slug });
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as PublicProfile[];
  return rows[0] ?? null;
}

// 프로필 링크의 user 값은 이름으로 만든 슬러그라, 계정을 못 찾아도 이름은 되살릴 수 있다.
export function getDisplayNameFromSlug(slug: string) {
  try {
    return decodeURIComponent(slug).replace(/-\d+$/, '').replace(/-/g, ' ');
  } catch {
    return slug;
  }
}

// 이름이 같은 사람이 있으면 서버가 뒤에 -2, -3을 붙인다.
function createProfileSlug(value: string) {
  const rawSlug = value.trim().split('@')[0]?.trim() || 'minji';
  return encodeURIComponent(rawSlug.replace(/\s+/g, '-').toLowerCase());
}

function describeAuthError(error: AuthError | null) {
  switch (error?.code) {
    case 'invalid_credentials':
      return '이메일 또는 비밀번호가 맞지 않아요.';
    case 'user_already_exists':
    case 'email_exists':
      return '이미 가입된 이메일이에요. 로그인해주세요.';
    case 'email_not_confirmed':
      return '가입 확인 메일의 링크를 먼저 눌러주세요.';
    case 'weak_password':
      return '비밀번호가 너무 쉬워요. 다른 비밀번호를 입력해주세요.';
    case 'email_address_invalid':
      return '사용할 수 없는 이메일이에요. 다른 이메일을 입력해주세요.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return '요청이 너무 많아요. 잠시 후 다시 시도해주세요.';
    default:
      return '로그인하지 못했어요. 잠시 후 다시 시도해주세요.';
  }
}

function isAuthAccount(value: unknown): value is AuthAccount {
  const account = value as Partial<AuthAccount>;
  return (
    typeof account?.id === 'string' &&
    typeof account.name === 'string' &&
    typeof account.email === 'string' &&
    typeof account.slug === 'string'
  );
}
