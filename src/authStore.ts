import { readStoredJson, removeStoredItem, writeStoredJson } from './browserStorage';

// 지금은 계정을 브라우저 localStorage에 둔다. 서버를 붙일 때는 이 파일만 교체하면 된다.
const AUTH_ACCOUNTS_KEY = 'puzzlw:authAccounts';
const AUTH_SESSION_KEY = 'puzzlw:authSession';

export type AuthAccount = {
  name: string;
  email: string;
  password: string;
  slug: string;
  // 생성일 기록 이전에 만든 계정에는 값이 없다.
  createdAt?: number;
};

export type AuthCredentials = {
  mode: 'login' | 'signup';
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

export function authenticateAccount(credentials: AuthCredentials): { account: AuthAccount | null; error: string | null } {
  const email = normalizeEmail(credentials.email);
  const password = credentials.password.trim();

  if (!email.includes('@')) {
    return { account: null, error: '이메일 형식을 확인해주세요.' };
  }

  if (password.length < 4) {
    return { account: null, error: '비밀번호는 4자 이상 입력해주세요.' };
  }

  const accounts = getStoredAuthAccounts();
  const existingAccount = accounts.find((account) => account.email === email);

  if (credentials.mode === 'signup') {
    const name = credentials.name.trim();
    if (name.length === 0) {
      return { account: null, error: '이름을 입력해주세요.' };
    }

    if (credentials.password !== credentials.passwordConfirm) {
      return { account: null, error: '비밀번호 확인이 일치하지 않아요.' };
    }

    if (existingAccount) {
      return { account: null, error: '이미 가입된 이메일이에요. 로그인해주세요.' };
    }

    const account: AuthAccount = {
      name,
      email,
      password,
      slug: createUniqueProfileSlug(name, accounts),
      createdAt: Date.now(),
    };
    saveStoredAuthAccounts([...accounts, account]);
    saveStoredAuthSession(account);
    return { account, error: null };
  }

  if (!existingAccount || existingAccount.password !== password) {
    return { account: null, error: '이메일 또는 비밀번호가 맞지 않아요.' };
  }

  saveStoredAuthSession(existingAccount);
  return { account: existingAccount, error: null };
}

export function getStoredAuthSession() {
  const session = readStoredJson<unknown>(AUTH_SESSION_KEY, null);
  return isAuthAccount(session) ? session : null;
}

export function clearAuthSession() {
  removeStoredItem(AUTH_SESSION_KEY);
}

export function deleteAuthAccount(email: string) {
  saveStoredAuthAccounts(getStoredAuthAccounts().filter((account) => account.email !== email));
  clearAuthSession();
}

export function findAccountBySlug(slug: string) {
  return getStoredAuthAccounts().find((account) => account.slug === slug) ?? null;
}

// 프로필 링크의 user 값은 이름으로 만든 슬러그라, 계정을 못 찾아도 이름은 되살릴 수 있다.
export function getDisplayNameFromSlug(slug: string) {
  try {
    return decodeURIComponent(slug).replace(/-\d+$/, '').replace(/-/g, ' ');
  } catch {
    return slug;
  }
}

function createProfileSlug(value: string) {
  const rawSlug = value.trim().split('@')[0]?.trim() || 'minji';
  return encodeURIComponent(rawSlug.replace(/\s+/g, '-').toLowerCase());
}

// 이름이 같은 사람이 가입해도 프로필 링크가 겹치지 않도록 뒤에 번호를 붙인다.
function createUniqueProfileSlug(name: string, accounts: AuthAccount[]) {
  const baseSlug = createProfileSlug(name);
  const usedSlugs = new Set(accounts.map((account) => account.slug));
  let slug = baseSlug;
  for (let suffix = 2; usedSlugs.has(slug); suffix += 1) {
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getStoredAuthAccounts() {
  const accounts = readStoredJson<unknown>(AUTH_ACCOUNTS_KEY, []);
  return Array.isArray(accounts) ? accounts.filter(isAuthAccount) : [];
}

function saveStoredAuthAccounts(accounts: AuthAccount[]) {
  writeStoredJson(AUTH_ACCOUNTS_KEY, accounts);
}

function saveStoredAuthSession(account: AuthAccount) {
  writeStoredJson(AUTH_SESSION_KEY, account);
}

function isAuthAccount(value: unknown): value is AuthAccount {
  const account = value as Partial<AuthAccount>;
  return (
    typeof account?.name === 'string' &&
    typeof account.email === 'string' &&
    typeof account.password === 'string' &&
    typeof account.slug === 'string'
  );
}
