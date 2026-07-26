// ============================================================
// src/lib/googleServerAuth.ts
//   サーバー側 Google 連携（authorization code flow + refresh_token）の
//   クライアントヘルパー。/api/google/* を叩くだけで、client_secret は扱わない。
//
// ★なぜ必要か（2026-07-26 オーナー報告の根治）
//   従来の GIS（ブラウザだけで完結する implicit flow）では refresh_token が
//   原理的に取得できず、1時間ごとに再認可ポップアップが必要だった。
//   サーバーに refresh_token を預けることで「一度つないだら、つなぎっぱなし」にする。
//
// ★後退しない設計
//   サーバー側が未設定（GOOGLE_CLIENT_SECRET 無し）なら configured:false が返る。
//   呼び出し側はその時だけ従来の GIS 方式にフォールバックする。
// ============================================================

const UID_KEY = 'core_google_uid';

/** 匿名ID（無ければ生成して保存）。サーバーのトークン保存キーに使う。 */
export function getGoogleUid(): string {
  try {
    let id = localStorage.getItem(UID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : 'guid-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(UID_KEY, id);
    }
    return id;
  } catch {
    return 'guid-ephemeral';
  }
}

export interface GoogleServerStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  name?: string;
  picture?: string;
}

/**
 * サーバー側連携が使えるか／つながっているか。失敗時は configured:false（＝従来方式へ）。
 *
 * ★t=Date.now() と cache:'no-store' は必須（2026-07-26 の実害）。
 *   Service Worker が API 応答をキャッシュしており、設定を有効化した後も
 *   古い {"configured":false} を返し続けて新方式が使われなかった。
 *   SW 側も /api/ を除外したが、既に配布済みの古い SW を持つ端末でも
 *   正しく動くよう、こちら側でもキャッシュを確実に外す。
 */
export async function fetchGoogleServerStatus(): Promise<GoogleServerStatus> {
  const uid = getGoogleUid();
  try {
    const res = await fetch(
      `/api/google/oauth?action=status&uid=${encodeURIComponent(uid)}&t=${Date.now()}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return { configured: false, connected: false };
    return (await res.json()) as GoogleServerStatus;
  } catch {
    return { configured: false, connected: false };
  }
}

/**
 * サーバーが持つ refresh_token から、いま使えるアクセストークンを取得する。
 * 期限切れならサーバー側が自動更新する＝ユーザーの操作は不要。
 * 未連携・未設定なら null（呼び出し側が従来方式にフォールバックする合図）。
 */
export async function getServerGoogleToken(): Promise<string | null> {
  const uid = getGoogleUid();
  try {
    // 期限切れ間際のトークンをキャッシュから掴むと必ず 401 になるため no-store 必須。
    const res = await fetch(
      `/api/google/oauth?action=token&uid=${encodeURIComponent(uid)}&t=${Date.now()}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { ok?: boolean; access_token?: string };
    return j?.ok && j.access_token ? j.access_token : null;
  } catch {
    return null;
  }
}

/** 連携開始：サーバーの /api/google/oauth?action=start へ遷移（state はサーバーが発行）。 */
export async function startGoogleServerConnect(): Promise<{ ok: boolean; message?: string }> {
  const uid = getGoogleUid();
  const url = `/api/google/oauth?action=start&uid=${encodeURIComponent(uid)}`;
  try {
    // 未設定のまま遷移すると「白い画面に英語のエラー」になるので、先に判定する
    // （X 連携 startXConnect と同じ配慮）。
    const r = await fetch(`${url}&t=${Date.now()}`, { redirect: 'manual', cache: 'no-store' });
    if (r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400)) {
      window.location.href = url;
      return { ok: true };
    }
    const j = await r.json().catch(() => ({}) as { message?: string });
    return { ok: false, message: j?.message || 'Google 連携を開始できませんでした。' };
  } catch {
    return { ok: false, message: 'ネットワークエラーで Google 連携を開始できませんでした。' };
  }
}

/** サーバー側の連携を解除。 */
export async function disconnectGoogleServer(): Promise<void> {
  const uid = getGoogleUid();
  try {
    await fetch(`/api/google/oauth?action=disconnect&uid=${encodeURIComponent(uid)}`);
  } catch {
    /* best-effort */
  }
}

/**
 * コールバックから戻ってきた直後の結果を読む（?gcal_connected=1 / ?gcal_error=...）。
 * 読んだら URL からクエリを消して、リロードで二重に出ないようにする。
 */
export function readGoogleCallbackResult(): { ok?: boolean; error?: string } | null {
  try {
    const p = new URLSearchParams(window.location.search);
    const ok = p.get('gcal_connected');
    const err = p.get('gcal_error');
    if (!ok && !err) return null;
    p.delete('gcal_connected');
    p.delete('gcal_error');
    const rest = p.toString();
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    if (ok) return { ok: true };
    return { ok: false, error: err || 'unknown' };
  } catch {
    return null;
  }
}

/** エラーコードをやさしい日本語にする。 */
export function translateGoogleCallbackError(code: string): string {
  switch (code) {
    case 'not-configured':
      return 'Google 連携のサーバー設定がまだ完了していません。';
    case 'no-refresh-token':
      return 'Google から「継続利用の許可」が返ってきませんでした。お手数ですが、もう一度「連携」を押し、同意画面で最後まで進めてください。';
    case 'token-exchange-failed':
      return 'Google との認証に失敗しました。少し待ってからもう一度お試しください。';
    case 'state-mismatch':
    case 'state-lookup-failed':
      return '認証の有効期限が切れました。もう一度「連携」を押してください。';
    case 'access_denied':
      return '連携がキャンセルされました。';
    default:
      return 'Google 連携に失敗しました。もう一度お試しください。';
  }
}
