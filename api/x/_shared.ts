// ============================================================
// api/x/_shared.ts — X (Twitter) OAuth 2.0 + PKCE のサーバー側共通ロジック
//
// confidential client: client_secret はサーバーのみで保持しクライアントに出さない。
// トークンは Upstash の x:tok:<uid>、OAuth 一時 state は x:st:<state> に保存。
// ============================================================

export const X_AUTHORIZE = 'https://twitter.com/i/oauth2/authorize';
export const X_TOKEN = 'https://api.twitter.com/2/oauth2/token';
export const X_TWEETS = 'https://api.twitter.com/2/tweets';
export const X_ME = 'https://api.twitter.com/2/users/me';

export const X_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'].join(' ');

export const STATE_TTL = 600; // 10 分
// refresh_token は offline.access で長期。アクセストークン更新で延命する。
export const TOKEN_TTL = 60 * 60 * 24 * 120; // 120 日（再認証されなければ消える保険）

export function getClientId(): string {
  return (typeof process !== 'undefined' && process.env?.X_CLIENT_ID) || '';
}
export function getClientSecret(): string {
  return (typeof process !== 'undefined' && process.env?.X_CLIENT_SECRET) || '';
}
export function getRedirectUri(): string {
  return (
    (typeof process !== 'undefined' && process.env?.X_REDIRECT_URI) ||
    'https://core-prism-app.vercel.app/api/x/callback'
  );
}
/** client_id と client_secret が両方揃っていれば設定済み。 */
export function isXConfigured(): boolean {
  return Boolean(getClientId() && getClientSecret());
}

/** Prism 本体（フロント）へ戻るオリジン。redirect_uri から導出。 */
export function appOrigin(): string {
  try {
    return new URL(getRedirectUri()).origin;
  } catch {
    return 'https://core-prism-app.vercel.app';
  }
}

// ─── PKCE ─────────────────────────────────────────
export function randStr(len = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

export async function sha256base64url(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** confidential client の Basic 認証ヘッダ（client_id:client_secret）。 */
export function basicAuthHeader(): string {
  const raw = `${getClientId()}:${getClientSecret()}`;
  // btoa は Edge / Node 双方で利用可。
  return 'Basic ' + btoa(raw);
}

// ─── 保存トークンの型 ─────────────────────────────
export interface StoredXToken {
  access_token: string;
  refresh_token?: string;
  /** epoch ms */
  expires_at: number;
  username?: string;
  user_id?: string;
}

export interface OAuthState {
  uid: string;
  verifier: string;
}

export function tokKey(uid: string): string {
  return `x:tok:${uid}`;
}
export function stateKey(state: string): string {
  return `x:st:${state}`;
}

export function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
