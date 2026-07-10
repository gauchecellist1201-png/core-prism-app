// ============================================================
// Google 共通 OAuth (GIS token client) — Gmail 以外のサービス用
//   Calendar / Drive / Docs などで scope 別にトークンを取得・保存する。
//   gmail.ts の実績ある popup race 対策を踏襲。
//   必要 env: VITE_GOOGLE_CLIENT_ID
// ============================================================

interface GToken { accessToken: string; expiresAt: number; }

declare global {
  interface Window { google?: any; __gisLoaded?: boolean; }
}

function loadGsi(): Promise<void> {
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

export function getGoogleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
}
export function isGoogleConfigured(): boolean { return !!getGoogleClientId(); }

export function translateGoogleError(code: string): string {
  switch (code) {
    case 'access_denied':
      // 本番公開済みだが Google の確認（審査）前のため、多くは「このアプリは確認されていません」画面で
      // 先に進まなかったのが原因。ここを越える手順を最優先で案内する。
      return 'Google の許可画面で先に進めませんでした。よくある原因はこの2つです。\n'
        + '① 「このアプリは Google で確認されていません」と表示されたら、画面左下の「詳細」→「（安全ではないページ）に移動」を押して進んでください（現在 Google に確認申請中のため出る画面で、あなたの情報は CORE 以外に渡りません）。\n'
        + '② 画面で「キャンセル」を押した場合は、もう一度押して、最後まですべて「許可」してください。';
    case 'popup_closed':
    case 'popup_closed_by_user':
      return 'ログイン画面が閉じられました。もう一度押して、最後まで「許可」してください（ポップアップブロックは解除を）。';
    case 'unauthorized_client':
    case 'admin_policy_enforced':
      return '会社・学校の管理アカウントでは外部アプリが制限されています。個人 Google アカウントでお試しください。';
    case 'invalid_client':
      return 'CORE 側の OAuth 設定が不正です (Client ID)。サポートへご連絡ください。';
    case 'idpiframe_initialization_failed':
      return 'ブラウザがサードパーティ Cookie をブロックしています。設定で許可してください。';
    default:
      return `Google 認証エラー (${code})。もう一度お試しください。`;
  }
}

const TOK_PREFIX = 'core_google_tok_';

export function loadGoogleToken(key: string): string | null {
  try {
    const raw = localStorage.getItem(TOK_PREFIX + key);
    if (!raw) return null;
    const t = JSON.parse(raw) as GToken;
    if (Date.now() > t.expiresAt - 30_000) return null;
    return t.accessToken;
  } catch { return null; }
}
function saveGoogleToken(key: string, t: GToken) {
  try { localStorage.setItem(TOK_PREFIX + key, JSON.stringify(t)); } catch { /* quota */ }
}
export function clearGoogleToken(key: string) {
  try { localStorage.removeItem(TOK_PREFIX + key); } catch { /* */ }
}
export function isGoogleConnected(key: string): boolean { return !!loadGoogleToken(key); }

/** scope を指定して Google アクセストークンを取得（popup race 対策込み）。storeKey 別に保存。 */
export async function requestGoogleToken(scopes: string[], storeKey: string): Promise<string> {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error('Google 連携の準備ができていません (VITE_GOOGLE_CLIENT_ID 未設定)。');
  await loadGsi();
  if (!window.google?.accounts?.oauth2) throw new Error('Google Identity Services が利用できません。');

  const token = await new Promise<GToken>((resolve, reject) => {
    let settled = false;
    let pendingClose: { timer: number } | null = null;
    const finalizeReject = (code: string) => {
      if (settled) return; settled = true;
      try { console.warn('[googleAuth] OAuth failed:', code); } catch { /* */ }
      reject(new Error(translateGoogleError(code)));
    };
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes.join(' '),
      prompt: 'consent',
      callback: (resp: any) => {
        if (pendingClose) { window.clearTimeout(pendingClose.timer); pendingClose = null; }
        if (settled) return;
        if (resp.error) { settled = true; reject(new Error(translateGoogleError(resp.error))); return; }
        const expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        const t: GToken = { accessToken: resp.access_token, expiresAt };
        saveGoogleToken(storeKey, t); settled = true; resolve(t);
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
    client.requestAccessToken();
  });
  return token.accessToken;
}

/** トークンを取り、無ければ scope 同意を促してから返す。 */
export async function getValidGoogleToken(scopes: string[], storeKey: string): Promise<string> {
  const t = loadGoogleToken(storeKey);
  if (t) return t;
  return requestGoogleToken(scopes, storeKey);
}
