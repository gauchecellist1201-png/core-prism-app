// ============================================================
// Google Calendar 連携 (OAuth + REST API + 空き時間計算)
// ============================================================
// 既存の gmail.ts と Token Client を共有しつつ、Calendar スコープを追加
// 必要スコープ:
//   https://www.googleapis.com/auth/calendar.readonly
//   https://www.googleapis.com/auth/calendar.events  (将来書込時)

declare global {
  interface Window {
    google?: any;
    __gisLoaded?: boolean;
  }
}

const CAL_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
].join(' ');

const TOKEN_KEY = 'core_gcal_token';
const TOKEN_EXPIRY_KEY = 'core_gcal_token_expires_at';
const USER_INFO_KEY = 'core_gcal_user';

export interface CalTokenInfo {
  accessToken: string;
  expiresAt: number;
}
export interface CalUserInfo {
  email: string;
  name?: string;
  picture?: string;
}
export interface CalEvent {
  id: string;
  summary: string;
  start: string; // ISO
  end: string;
  status?: string;
  busy?: boolean;
}
export interface BusyInterval {
  start: string;
  end: string;
}
export interface FreeSlot {
  start: Date;
  end: Date;
}

function getClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
}

export function isCalConfigured(): boolean {
  return !!getClientId();
}

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
    s.async = true; s.defer = true; s.dataset.gis = '1';
    s.onload = () => { window.__gisLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('GIS load error'));
    document.head.appendChild(s);
  });
}

function loadToken(): CalTokenInfo | null {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    const e = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!t || !e) return null;
    const expiresAt = Number(e);
    if (Date.now() > expiresAt - 30_000) return null;
    return { accessToken: t, expiresAt };
  } catch { return null; }
}
function saveToken(info: CalTokenInfo) {
  localStorage.setItem(TOKEN_KEY, info.accessToken);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(info.expiresAt));
}
export function clearCalToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_INFO_KEY);
}
export function isCalConnected(): boolean { return !!loadToken(); }

export function loadCalUser(): CalUserInfo | null {
  try {
    const raw = localStorage.getItem(USER_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveCalUser(info: CalUserInfo) {
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(info));
}

async function fetchUserInfo(token: string): Promise<CalUserInfo | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { email: data.email, name: data.name, picture: data.picture };
  } catch { return null; }
}

function translateError(code: string): string {
  // gmail.ts の translateGoogleError と完全に同じ文言。原因別に具体的に案内する。
  switch (code) {
    case 'access_denied':
      return 'Google から「アクセスを許可しない」が返ってきました。考えられる原因と対処:\n'
        + '① テストモード中: ログインに使った Google アドレスを Google Cloud Console の「テストユーザー」欄に追加してください\n'
        + '② 一度開いた画面の「キャンセル」を押した可能性 → もう一度「Google でログイン」を押してすべて「許可」してください\n'
        + '③ ブラウザの「サードパーティ Cookie ブロック」が原因 → 設定で許可するか、Chrome 通常モードでお試しください';
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
    case 'popup_failed_to_open':
      return 'ポップアップを開けませんでした。ブラウザのポップアップブロックを解除して、もう一度お試しください。';
    case 'idpiframe_initialization_failed':
      return 'ブラウザがサードパーティ Cookie をブロックしています。設定で許可していただくか、Chrome 通常モードでお試しください。';
    default:
      return `Google 認証エラー (${code}): もう一度お試しいただくか、ブラウザを変えてお試しください。`;
  }
}

export async function connectCalendar(): Promise<{ token: CalTokenInfo; user: CalUserInfo | null }> {
  const clientId = getClientId();
  if (!clientId) throw new Error('Google Calendar 連携の準備ができていません (VITE_GOOGLE_CLIENT_ID 未設定)');
  await loadGsiScript();
  if (!window.google?.accounts?.oauth2) throw new Error('Google Identity Services が利用できません');

  const token = await new Promise<CalTokenInfo>((resolve, reject) => {
    // ── GIS race condition 対策 (gmail.ts と同じロジック) ───
    // popup_closed が来てもすぐ拒否せず、2 秒だけ callback の到着を待つ。
    // その間に callback(success) が来たら遅延 reject をキャンセル。
    let settled = false;
    let pendingClose: { timer: number } | null = null;
    const finalizeReject = (code: string) => {
      if (settled) return;
      settled = true;
      try { console.warn('[gcal.connect] OAuth failed with code:', code); } catch { /* */ }
      reject(new Error(translateError(code)));
    };
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CAL_SCOPES,
      prompt: 'consent',
      callback: (resp: any) => {
        if (pendingClose) { window.clearTimeout(pendingClose.timer); pendingClose = null; }
        if (settled) return;
        if (resp.error) {
          settled = true;
          try { console.warn('[gcal.connect] callback error:', resp.error, resp); } catch { /* */ }
          reject(new Error(translateError(resp.error)));
          return;
        }
        const expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        const info: CalTokenInfo = { accessToken: resp.access_token, expiresAt };
        saveToken(info);
        settled = true;
        resolve(info);
      },
      error_callback: (err: any) => {
        if (settled) return;
        const code: string = err?.type || 'unknown';
        if (code === 'popup_closed' || code === 'popup_closed_by_user') {
          if (pendingClose) return;
          pendingClose = { timer: window.setTimeout(() => { pendingClose = null; finalizeReject(code); }, 2000) };
          return;
        }
        finalizeReject(code);
      },
    });
    tokenClient.requestAccessToken();
  });

  const user = await fetchUserInfo(token.accessToken);
  if (user) saveCalUser(user);
  return { token, user };
}

async function getValidToken(): Promise<string> {
  const t = loadToken();
  if (t) return t.accessToken;
  const fresh = await connectCalendar();
  return fresh.token.accessToken;
}

async function calFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = await getValidToken();
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) {
    clearCalToken();
    throw new Error('Google Calendar 認証期限切れ。再接続してください。');
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Google Calendar API ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

// ─── 空き時間取得 ────────────────────────────────
export async function fetchBusy(timeMinISO: string, timeMaxISO: string, calendarId = 'primary'): Promise<BusyInterval[]> {
  const data = await calFetch('/calendar/v3/freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      items: [{ id: calendarId }],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  const cal = data?.calendars?.[calendarId];
  return (cal?.busy as BusyInterval[]) || [];
}

// ─── 直近イベント取得 ───────────────────────────
export async function fetchUpcomingEvents(maxDays = 14, calendarId = 'primary'): Promise<CalEvent[]> {
  const now = new Date();
  const future = new Date(now); future.setDate(now.getDate() + maxDays);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const data = await calFetch(`/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  const items: any[] = data?.items || [];
  return items.map(ev => ({
    id: ev.id,
    summary: ev.summary || '(無題)',
    start: ev.start?.dateTime || ev.start?.date,
    end: ev.end?.dateTime || ev.end?.date,
    status: ev.status,
    busy: ev.transparency !== 'transparent',
  }));
}

// ─── イベント作成 (将来用) ──────────────────────
export async function createEvent(opts: {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  attendees?: { email: string }[];
  location?: string;
  calendarId?: string;
}): Promise<{ id: string; htmlLink: string }> {
  const calendarId = opts.calendarId || 'primary';
  const data = await calFetch(`/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`, {
    method: 'POST',
    body: JSON.stringify({
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.startISO, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: opts.endISO, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      attendees: opts.attendees,
      location: opts.location,
    }),
  });
  return { id: data.id, htmlLink: data.htmlLink };
}

// ─── ゲスト用: Google Calendar イベント作成 deeplink ───────
export function buildGcalDeeplink(opts: {
  title: string;
  startISO: string;
  endISO: string;
  details?: string;
  location?: string;
  attendees?: string[]; // email
}): string {
  const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', opts.title);
  params.set('dates', `${fmt(opts.startISO)}/${fmt(opts.endISO)}`);
  if (opts.details) params.set('details', opts.details);
  if (opts.location) params.set('location', opts.location);
  if (opts.attendees && opts.attendees.length > 0) params.set('add', opts.attendees.join(','));
  return `https://calendar.google.com/calendar/render?${params}`;
}
