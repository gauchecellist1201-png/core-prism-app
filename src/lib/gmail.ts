// ============================================================
// Gmail 連携 (Google Identity Services + Gmail REST API)
// ============================================================
// 必要な環境変数:
//   VITE_GOOGLE_CLIENT_ID  -- Google Cloud Console で発行した OAuth 2.0 Web アプリのクライアントID
// 必要なスコープ:
//   https://www.googleapis.com/auth/gmail.readonly  (受信読み取り)
//   https://www.googleapis.com/auth/gmail.send      (返信送信)
//   https://www.googleapis.com/auth/gmail.modify    (既読・ラベル操作)

declare global {
  interface Window {
    google?: any;
    __gisLoaded?: boolean;
  }
}

// 必要最小限のスコープに絞って verification を通しやすくする
// readonly + send + 自身のメール特定用 profile/email
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
].join(' ');

// ユーザーに表示するスコープの説明（同意画面前の説明モーダル用）
export const GMAIL_SCOPE_DESCRIPTIONS = [
  { icon: '📥', label: '受信メールの読み取り', detail: 'AI トリアージ・要約のため' },
  { icon: '✉️', label: 'あなたの代わりにメール送信', detail: 'AI が作成した返信を送る場合のみ' },
  { icon: '🏷️', label: 'ラベル・既読の管理', detail: '処理済みメールにラベル付け' },
  { icon: '👤', label: 'メールアドレスの確認', detail: '接続中のアカウント表示用' },
];

const TOKEN_KEY = 'core_gmail_token';
const TOKEN_EXPIRY_KEY = 'core_gmail_token_expires_at';
const USER_INFO_KEY = 'core_gmail_user';

export interface GmailTokenInfo {
  accessToken: string;
  expiresAt: number; // unix ms
}

export interface GmailUserInfo {
  email: string;
  name?: string;
  picture?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string; // text/plain or stripped html
  date: string;
  labelIds: string[];
  isUnread: boolean;
}

// ─── GIS スクリプト読み込み ────────────────────────────────
function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('window unavailable'));
  if (window.__gisLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-gis="1"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => { window.__gisLoaded = true; resolve(); });
      existing.addEventListener('error', () => reject(new Error('GIS load error')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.dataset.gis = '1';
    s.onload = () => { window.__gisLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('GIS load error'));
    document.head.appendChild(s);
  });
}

function getClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
}

export function isGmailConfigured(): boolean {
  return !!getClientId();
}

// ─── トークン取得 / 保存 ──────────────────────────────────
function loadToken(): GmailTokenInfo | null {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    const e = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!t || !e) return null;
    const expiresAt = Number(e);
    if (Date.now() > expiresAt - 30_000) return null;
    return { accessToken: t, expiresAt };
  } catch { return null; }
}

function saveToken(info: GmailTokenInfo) {
  localStorage.setItem(TOKEN_KEY, info.accessToken);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(info.expiresAt));
}

export function clearGmailToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_INFO_KEY);
}

export function isGmailConnected(): boolean {
  return !!loadToken();
}

export function loadGmailUser(): GmailUserInfo | null {
  try {
    const raw = localStorage.getItem(USER_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveGmailUser(info: GmailUserInfo) {
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(info));
}

async function fetchUserInfo(token: string): Promise<GmailUserInfo | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  } catch { return null; }
}

export async function connectGmail(): Promise<{ token: GmailTokenInfo; user: GmailUserInfo | null }> {
  const clientId = getClientId();
  if (!clientId) throw new Error('Gmail 連携の準備ができていません。少々お待ちください。(VITE_GOOGLE_CLIENT_ID 未設定)');
  await loadGsiScript();
  if (!window.google?.accounts?.oauth2) throw new Error('Google Identity Services が利用できません');

  const token = await new Promise<GmailTokenInfo>((resolve, reject) => {
    // ── GIS の race condition 対策 ──────────────────────────
    // Google Identity Services は popup を閉じる前後で callback と error_callback が
    // 同時に発火することがある。観測されたパターン:
    //   (A) 同意完了 → callback(success) → 直後に error_callback('popup_closed') が発火
    //       → settled で無視できる (既存対策)
    //   (B) 同意完了直前に popup が一瞬リダイレクトで閉じる → error_callback('popup_closed')
    //       → 1-2 秒後に callback(success) が遅延発火
    //       → 既存対策では (B) で「失敗」と判定してしまう。本当は成功している。
    //
    // 対策: popup_closed 系のエラーが来たら即拒否せず、最大 2 秒だけ callback を待つ。
    //       その間に callback が来たら成功扱いに切り替える。
    let settled = false;
    let pendingClose: { timer: number; type: string } | null = null;
    const finalizeReject = (code: string) => {
      if (settled) return;
      settled = true;
      // 診断ログ (オーナー報告対応 2026-06-03) — どの GIS code が来たかを開発者ツールに残す
      // production でも有効。Sentry や手動報告のときに役立つ。
      try {
        console.warn('[gmail.connect] OAuth failed with code:', code);
      } catch { /* */ }
      reject(new Error(translateGoogleError(code)));
    };
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPES,
      // 'consent' で常に同意画面を表示してスコープを明示する (一般ユーザー向け)
      prompt: 'consent',
      callback: (resp: any) => {
        // 遅延 popup_closed が予約されていればキャンセル (race 回避)
        if (pendingClose) { window.clearTimeout(pendingClose.timer); pendingClose = null; }
        if (settled) return;
        if (resp.error) {
          settled = true;
          try { console.warn('[gmail.connect] callback error:', resp.error, resp); } catch { /* */ }
          reject(new Error(translateGoogleError(resp.error)));
          return;
        }
        const expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        const info: GmailTokenInfo = { accessToken: resp.access_token, expiresAt };
        saveToken(info);
        settled = true;
        resolve(info);
      },
      error_callback: (err: any) => {
        if (settled) {
          // 成功後に発火した stale な popup_closed は無視 (パターン A)
          return;
        }
        const code: string = err?.type || 'unknown';
        // popup_closed 系 — callback が遅延発火する可能性 (パターン B) → 2 秒待つ
        if (code === 'popup_closed' || code === 'popup_closed_by_user') {
          if (pendingClose) return; // 既に予約済み
          pendingClose = {
            type: code,
            timer: window.setTimeout(() => {
              pendingClose = null;
              finalizeReject(code);
            }, 2000),
          };
          return;
        }
        // それ以外 (access_denied / unauthorized_client / invalid_client 等) は即拒否
        finalizeReject(code);
      },
    });
    tokenClient.requestAccessToken();
  });

  const user = await fetchUserInfo(token.accessToken);
  if (user) saveGmailUser(user);
  return { token, user };
}

function translateGoogleError(code: string): string {
  switch (code) {
    case 'access_denied':
      // メール連携は「受信の読み取り」を含む制限付きスコープのため、Google の追加審査を通すまでは
      // 一般ユーザーの許可がブロックされる。正直に「順次開放中」と伝え、他の連携へ誘導する（負の体験を残さない）。
      return 'メール連携（受信メールのAI要約・整理）は現在準備中です。\n'
        + 'この機能は Google の追加確認が必要で、いま申請を進めています。整い次第そのままお使いいただけるので、今しばらくお待ちください。\n'
        + '※ カレンダー・Meet など他の Google 連携は今すぐご利用いただけます。\n'
        + '（キャンセルを押しただけの場合は、もう一度お試しください。）';
    case 'popup_closed':
    case 'popup_closed_by_user':
      return 'ログイン画面が閉じられました。もう一度「Google でログイン」を押して、最後まで「許可」してください。\n'
        + '※ Google 側の許可画面が一瞬しか出ない場合は、ブラウザのポップアップブロックを解除してください。';
    case 'unauthorized_client':
    case 'admin_policy_enforced':
      return 'お使いの Google アカウント (会社・学校等の管理アカウント) では、外部アプリの認可が管理者により制限されています。個人 Gmail アカウントでお試しください。';
    case 'invalid_client':
      return 'CORE 側の OAuth 設定が間違っているようです (Client ID 不正)。サポートまでご連絡ください。';
    case 'origin_mismatch':
    case 'redirect_uri_mismatch':
      return 'CORE のドメインが Google 側に未登録です (origin_mismatch)。サポートまでご連絡ください。';
    case 'access_denied_by_resource_owner':
      return '権限の許可画面で「キャンセル」を押されました。もう一度「許可」を選んでください。';
    case 'popup_failed_to_open':
      return 'ポップアップを開けませんでした。ブラウザのポップアップブロックを解除して、もう一度お試しください。';
    case 'idpiframe_initialization_failed':
      return 'ブラウザがサードパーティ Cookie をブロックしています。設定で許可していただくか、Chrome 通常モードでお試しください。';
    default:
      return `Google 認証エラー (${code}): もう一度お試しいただくか、ブラウザを変えてお試しください。`;
  }
}

async function getValidToken(): Promise<string> {
  const t = loadToken();
  if (t) return t.accessToken;
  const fresh = await connectGmail();
  return fresh.token.accessToken;
}

// ─── Gmail API ヘルパ ────────────────────────────────────
async function gmailFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = await getValidToken();
  const res = await fetch(`https://gmail.googleapis.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) {
    clearGmailToken();
    throw new Error('Gmail 認証期限切れ。再接続してください。');
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Gmail API ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// ─── メール本文をデコード ────────────────────────────────
function b64UrlDecode(input: string): string {
  try {
    const std = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch { return ''; }
}

function extractBody(payload: any): string {
  if (!payload) return '';
  // text/plain 優先
  const findPart = (p: any, mime: string): any => {
    if (p.mimeType === mime && p.body?.data) return p;
    if (Array.isArray(p.parts)) {
      for (const sub of p.parts) {
        const found = findPart(sub, mime);
        if (found) return found;
      }
    }
    return null;
  };
  const plain = findPart(payload, 'text/plain');
  if (plain?.body?.data) return b64UrlDecode(plain.body.data);
  const html = findPart(payload, 'text/html');
  if (html?.body?.data) {
    return b64UrlDecode(html.body.data)
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (payload.body?.data) return b64UrlDecode(payload.body.data);
  return '';
}

function getHeader(headers: any[] = [], name: string): string {
  const h = headers.find(h => (h.name || '').toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

// ─── 受信トレイから取得 ───────────────────────────────────
export async function fetchInbox(maxResults = 20): Promise<GmailMessage[]> {
  // 未読 + 直近 (CATEGORY_PROMOTIONS と SPAM 除外)
  const list = await gmailFetch(
    `/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent('in:inbox -category:promotions -category:social newer_than:14d')}`,
  );
  const ids: string[] = (list.messages || []).map((m: any) => m.id);
  if (ids.length === 0) return [];

  const messages: GmailMessage[] = [];
  // 並列取得 (一度に5件まで)
  const batchSize = 5;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(id =>
      gmailFetch(`/gmail/v1/users/me/messages/${id}?format=full`).catch(() => null),
    ));
    for (const r of results) {
      if (!r) continue;
      const headers = r.payload?.headers || [];
      const body = extractBody(r.payload);
      messages.push({
        id: r.id,
        threadId: r.threadId,
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        subject: getHeader(headers, 'Subject'),
        snippet: r.snippet || '',
        body: body.slice(0, 5000),
        date: getHeader(headers, 'Date'),
        labelIds: r.labelIds || [],
        isUnread: (r.labelIds || []).includes('UNREAD'),
      });
    }
  }
  return messages;
}

// ─── 軽量サマリ (未読数 + 上位件名だけ) ──────────────────
// 能動提案(今日の一手)の根拠用。本文は取らず format=metadata で件名/差出人のみ。
// 接続済みトークンがある時だけ呼ぶこと (getValidToken は再取得の popup を起こしうる)。
export interface GmailInboxLite {
  unreadCount: number;
  top: { from: string; subject: string }[];
}

export async function fetchInboxLite(maxResults = 6): Promise<GmailInboxLite> {
  const list = await gmailFetch(
    `/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent('in:inbox is:unread -category:promotions -category:social newer_than:7d')}`,
  );
  const ids: string[] = (list.messages || []).map((m: any) => m.id);
  const unreadCount = typeof list.resultSizeEstimate === 'number' ? list.resultSizeEstimate : ids.length;
  if (ids.length === 0) return { unreadCount: 0, top: [] };
  const metas = await Promise.all(ids.slice(0, maxResults).map(id =>
    gmailFetch(`/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`).catch(() => null),
  ));
  const top = metas.filter(Boolean).map((r: any) => {
    const headers = r.payload?.headers || [];
    return { from: getHeader(headers, 'From'), subject: getHeader(headers, 'Subject') };
  });
  return { unreadCount, top };
}

// ─── トリアージ用テキストへ変換 ──────────────────────────
export function gmailToTriageText(messages: GmailMessage[]): string {
  return messages.map(m => (
    `From: ${m.from}\nTo: ${m.to}\nSubject: ${m.subject}\nDate: ${m.date}\n\n${m.body || m.snippet}`
  )).join('\n\n---\n\n');
}

// ─── メール送信 ──────────────────────────────────────────
function buildMime(opts: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  // RFC2047 Subject エンコード (UTF-8 base64)
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(opts.subject)))}?=`;
  const lines = [
    `To: ${opts.to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);
  lines.push('', opts.body);
  return lines.join('\r\n');
}

function b64UrlEncode(input: string): string {
  // UTF-8 → bytes → b64
  const bytes = new TextEncoder().encode(input);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendReply(opts: {
  threadId?: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): Promise<{ id: string }> {
  const raw = b64UrlEncode(buildMime(opts));
  const payload: any = { raw };
  if (opts.threadId) payload.threadId = opts.threadId;
  return await gmailFetch('/gmail/v1/users/me/messages/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Gmail に 下書き を 作成 (送信 せず) — オーナー が 自分 で 確認 してから 送る用 */
export async function createGmailDraft(opts: {
  threadId?: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): Promise<{ id: string; messageId?: string }> {
  const raw = b64UrlEncode(buildMime(opts));
  const message: any = { raw };
  if (opts.threadId) message.threadId = opts.threadId;
  const res = await gmailFetch('/gmail/v1/users/me/drafts', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  return { id: res?.id || '', messageId: res?.message?.id };
}

// 受信メッセージから返信に必要な情報を取り出す
export function buildReplyMeta(m: GmailMessage): {
  to: string;
  subject: string;
  inReplyTo: string;
  references: string;
} {
  const subjectPrefix = /^re:/i.test(m.subject) ? '' : 'Re: ';
  return {
    to: m.from,
    subject: subjectPrefix + m.subject,
    inReplyTo: `<${m.id}@mail.gmail.com>`,
    references: `<${m.id}@mail.gmail.com>`,
  };
}
