// ============================================================
// X (Twitter) OAuth 2.0 PKCE + 投稿API
// ============================================================
// 必要な環境変数:
//   VITE_X_CLIENT_ID — X Developer Portal で OAuth 2.0 アプリを作成
// 必要なスコープ:
//   tweet.read tweet.write users.read offline.access
// リダイレクトURI:
//   https://core-prism-app.vercel.app/   と   http://localhost:5181/

const TOKEN_KEY = 'core_x_token';
const TOKEN_EXPIRY_KEY = 'core_x_expires';
const REFRESH_KEY = 'core_x_refresh';
const USER_KEY = 'core_x_user';
const PKCE_VERIFIER_KEY = 'core_x_pkce_verifier';
const PKCE_STATE_KEY = 'core_x_pkce_state';

const X_AUTHORIZE = 'https://twitter.com/i/oauth2/authorize';
const X_TOKEN     = 'https://api.twitter.com/2/oauth2/token';
const X_TWEETS    = 'https://api.twitter.com/2/tweets';
const X_ME        = 'https://api.twitter.com/2/users/me';

const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'].join(' ');

export interface XUser {
  id: string;
  username: string;
  name?: string;
  profileImageUrl?: string;
}

export function isXConfigured(): boolean {
  return !!(import.meta.env.VITE_X_CLIENT_ID as string | undefined);
}

export function isXConnected(): boolean {
  const t = localStorage.getItem(TOKEN_KEY);
  const e = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
  return !!t && Date.now() < e - 30_000;
}

export function loadXUser(): XUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearXAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PKCE_VERIFIER_KEY);
  localStorage.removeItem(PKCE_STATE_KEY);
}

// ─── PKCE ヘルパー ──────────────────────────────
function randStr(len = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let s = '';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}
async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const bin = String.fromCharCode(...new Uint8Array(buf));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getRedirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}
function getClientId(): string {
  return (import.meta.env.VITE_X_CLIENT_ID as string | undefined) || '';
}

// ─── 認証開始 (リダイレクト) ─────────────────────
export async function startXAuth(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) throw new Error('VITE_X_CLIENT_ID が未設定です');

  const verifier = randStr(64);
  const challenge = await sha256(verifier);
  const state = randStr(32);
  localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  localStorage.setItem(PKCE_STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `${X_AUTHORIZE}?${params}`;
}

// ─── 認証コールバック処理 (URLにcode=がある時) ──
export async function handleXCallbackIfPresent(): Promise<XUser | null> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) return null;

  const expectedState = localStorage.getItem(PKCE_STATE_KEY);
  const verifier = localStorage.getItem(PKCE_VERIFIER_KEY);
  if (!expectedState || !verifier || state !== expectedState) {
    // クリーンアップだけして無視
    cleanUrl();
    return null;
  }
  localStorage.removeItem(PKCE_STATE_KEY);
  localStorage.removeItem(PKCE_VERIFIER_KEY);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: getClientId(),
    code_verifier: verifier,
  });
  const res = await fetch(X_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  cleanUrl();
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`X 認証失敗: ${res.status} ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  saveTokens(data);

  // ユーザー情報取得
  const user = await fetchMe(data.access_token).catch(() => null);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

function saveTokens(data: any) {
  const expiresAt = Date.now() + (Number(data.expires_in) || 7200) * 1000;
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
}

function cleanUrl() {
  // ?code=, ?state= を取り除く
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  window.history.replaceState({}, '', url.toString());
}

async function refreshToken(): Promise<void> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error('再認証が必要です');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: getClientId(),
  });
  const res = await fetch(X_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    clearXAuth();
    throw new Error('X 再認証に失敗しました。再度ログインしてください。');
  }
  saveTokens(await res.json());
}

async function getValidToken(): Promise<string> {
  const t = localStorage.getItem(TOKEN_KEY);
  const e = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
  if (t && Date.now() < e - 30_000) return t;
  await refreshToken();
  return localStorage.getItem(TOKEN_KEY) || '';
}

async function fetchMe(token: string): Promise<XUser | null> {
  const res = await fetch(`${X_ME}?user.fields=profile_image_url,username,name`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.data) return null;
  return {
    id: data.data.id,
    username: data.data.username,
    name: data.data.name,
    profileImageUrl: data.data.profile_image_url,
  };
}

// ─── ツイート投稿 ───────────────────────────────
export async function postTweet(text: string, replyToId?: string): Promise<{ id: string; text: string }> {
  const token = await getValidToken();
  const body: any = { text };
  if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };
  const res = await fetch(X_TWEETS, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`X 投稿失敗: ${res.status} ${txt.slice(0, 240)}`);
  }
  const data = await res.json();
  return { id: data.data.id, text: data.data.text };
}

export async function postThread(posts: string[]): Promise<{ ids: string[] }> {
  const ids: string[] = [];
  let prev: string | undefined = undefined;
  for (const p of posts) {
    const r = await postTweet(p, prev);
    ids.push(r.id);
    prev = r.id;
  }
  return { ids };
}
