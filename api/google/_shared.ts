// ============================================================
// api/google/_shared.ts — Google OAuth 2.0（サーバー側 confidential client）
//
// ★なぜこれが必要か（2026-07-26 オーナー報告「カレンダーだけ毎回つなぎ直し」の根治）
//   これまで Prism の Google 連携はブラウザだけで完結する GIS の implicit flow
//   （initTokenClient）しか使っておらず、得られるのは **1時間で失効する
//   アクセストークンのみ**。refresh_token が原理的に取得できないため、
//   1時間ごとに再認可ポップアップが必要だった。X 連携（api/x/*）と同じく
//   authorization code flow + access_type=offline に切り替え、refresh_token を
//   サーバー（Upstash）に保持して自動更新する。
//
//   client_secret はサーバーのみで保持しクライアントには一切出さない。
//   トークンは Upstash の g:tok:<uid>、OAuth 一時 state は g:st:<state> に保存。
// ============================================================

export const G_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
export const G_TOKEN = 'https://oauth2.googleapis.com/token';
export const G_USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

// src/lib/googleCalendar.ts の CAL_SCOPES と揃える（カレンダー＋本人確認）。
//
// ★2026-08-02 判断: ドライブ (drive.readonly) を **ここに足さない**。
//   ドライブ閲覧は Google の「制限付きスコープ」で、CASA 審査を通すまで
//   一般ユーザーはブロックされる（Gmail 読み取りと同じ扱い）。
//   ここに混ぜると、いま普通に使えているカレンダー連携まで巻き添えで
//   弾かれる恐れがある。ドライブは別の同意 (src/lib/driveIngest.ts の
//   DRIVE_SCOPES) として、押した人だけに求める。
export const G_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
].join(' ');

export const STATE_TTL = 600; // 10 分
// refresh_token は長期。ユーザーが取り消すまで有効なので TTL は保険として長めに取る。
export const TOKEN_TTL = 60 * 60 * 24 * 365; // 365 日

export function getClientId(): string {
  return (
    (typeof process !== 'undefined' &&
      (process.env?.GOOGLE_CLIENT_ID || process.env?.VITE_GOOGLE_CLIENT_ID)) ||
    ''
  );
}
export function getClientSecret(): string {
  return (typeof process !== 'undefined' && process.env?.GOOGLE_CLIENT_SECRET) || '';
}
export function getRedirectUri(): string {
  return (
    (typeof process !== 'undefined' && process.env?.GOOGLE_REDIRECT_URI) ||
    'https://core-prism-app.vercel.app/api/google/callback'
  );
}

/**
 * client_id と client_secret が両方揃っていれば設定済み。
 * client_secret が無い間は connected:false を返し、クライアントは
 * 従来の GIS ポップアップ方式に自動フォールバックする（後退しない）。
 */
export function isGoogleConfigured(): boolean {
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

export function randStr(len = 48): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

// ─── 保存トークンの型 ─────────────────────────────
export interface StoredGoogleToken {
  /** ★これが本体。これがある限り再認可なしで使い続けられる。 */
  refresh_token: string;
  access_token?: string;
  /** epoch ms（60秒のマージンを引いた実効期限） */
  expires_at?: number;
  email?: string;
  name?: string;
  picture?: string;
  connected_at?: string;
}

export interface GoogleOAuthState {
  uid: string;
}

export function tokKey(uid: string): string {
  return `g:tok:${uid}`;
}
export function stateKey(state: string): string {
  return `g:st:${state}`;
}

export function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * 保存済み refresh_token から「いま使えるアクセストークン」を返す。
 * 期限内ならそのまま再利用、切れていれば refresh_token で更新して呼び出し側に返す
 * （呼び出し側が保存し直す）。refresh_token が Google 側で取り消されていれば null。
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_at: number } | null> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(G_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[google] refresh failed:', res.status, t.slice(0, 300));
    return null;
  }
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  return {
    access_token: j.access_token,
    // 60秒のマージン（resonancebot 側 gcal.ts と同じ考え方）
    expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000 - 60_000,
  };
}
