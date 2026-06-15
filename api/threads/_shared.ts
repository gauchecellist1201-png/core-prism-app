// ============================================================
// api/threads/_shared.ts — Threads (Meta) API のサーバー側共通ロジック
//
// THREADS_APP_SECRET はサーバーのみで保持しクライアントに出さない。
// トークンは Upstash の th:tok:<uid>、OAuth 一時 state は th:st:<state> に保存。
// X (api/x/_shared.ts) の作法に完全に合わせる。PKCE は不要（Threads は code 交換）。
// ============================================================

export const TH_AUTHORIZE = 'https://threads.net/oauth/authorize';
export const TH_TOKEN = 'https://graph.threads.net/oauth/access_token';
export const TH_LONG_TOKEN = 'https://graph.threads.net/access_token';
export const TH_REFRESH = 'https://graph.threads.net/refresh_access_token';
export const TH_ME = 'https://graph.threads.net/v1.0/me';
export const TH_THREADS = 'https://graph.threads.net/v1.0/me/threads';
export const TH_PUBLISH = 'https://graph.threads.net/v1.0/me/threads_publish';

export const TH_SCOPES = ['threads_basic', 'threads_content_publish'].join(',');

export const STATE_TTL = 600; // 10 分
// 長期トークンは 60 日。再認証されなければ消える保険として TTL は長めに。
export const TOKEN_TTL = 60 * 60 * 24 * 120; // 120 日

export function getAppId(): string {
  return (typeof process !== 'undefined' && process.env?.THREADS_APP_ID) || '';
}
export function getAppSecret(): string {
  return (typeof process !== 'undefined' && process.env?.THREADS_APP_SECRET) || '';
}
export function getRedirectUri(): string {
  return (
    (typeof process !== 'undefined' && process.env?.THREADS_REDIRECT_URI) ||
    'https://core-prism-app.vercel.app/api/threads/callback'
  );
}
/** app_id と app_secret が両方揃っていれば設定済み。 */
export function isThreadsConfigured(): boolean {
  return Boolean(getAppId() && getAppSecret());
}

/** Prism 本体（フロント）へ戻るオリジン。redirect_uri から導出。 */
export function appOrigin(): string {
  try {
    return new URL(getRedirectUri()).origin;
  } catch {
    return 'https://core-prism-app.vercel.app';
  }
}

export function randStr(len = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

// ─── 保存トークンの型 ─────────────────────────────
export interface StoredThreadsToken {
  access_token: string;
  /** epoch ms */
  expires_at: number;
  username?: string;
  user_id?: string;
}

export interface OAuthState {
  uid: string;
}

export function tokKey(uid: string): string {
  return `th:tok:${uid}`;
}
export function stateKey(state: string): string {
  return `th:st:${state}`;
}

export function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
