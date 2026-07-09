// ============================================================
// src/lib/xConnect.ts — サーバー側 X 連携（OAuth2+PKCE confidential client）の
// クライアントヘルパ。匿名ID core_x_uid を localStorage で管理し、
// /api/x/* を叩く。client_secret は一切扱わない（サーバー専用）。
// ============================================================

const UID_KEY = 'core_x_uid';

/** 匿名ID（無ければ生成して保存）。サーバーのトークン保存キーに使う。 */
export function getXUid(): string {
  try {
    let id = localStorage.getItem(UID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : 'uid-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(UID_KEY, id);
    }
    return id;
  } catch {
    // localStorage 不可環境のフォールバック（連携は使えないが落とさない）
    return 'uid-ephemeral';
  }
}

export interface XStatus {
  configured: boolean;
  connected: boolean;
  username?: string;
}

export async function fetchXStatus(): Promise<XStatus> {
  const uid = getXUid();
  try {
    const res = await fetch(`/api/x/status?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) return { configured: false, connected: false };
    return (await res.json()) as XStatus;
  } catch {
    return { configured: false, connected: false };
  }
}

/** 連携開始：サーバーの /api/x/start へ遷移（PKCE / state はサーバーが発行）。 */
export function startXConnect(): void {
  const uid = getXUid();
  window.location.href = `/api/x/start?uid=${encodeURIComponent(uid)}`;
}

export interface XPostResult {
  ok?: boolean;
  ids?: string[];
  urls?: string[];
  username?: string;
  error?: string;
  message?: string;
  posted?: string[];
}

/** スレッドを連投。成功/失敗いずれも意味あるメッセージ付きで返す。 */
export async function postXThread(tweets: string[]): Promise<XPostResult> {
  const uid = getXUid();
  try {
    const res = await fetch('/api/x/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, tweets }),
    });
    const data = (await res.json().catch(() => ({}))) as XPostResult;
    if (!res.ok) {
      return {
        error: data.error || 'post-failed',
        message: data.message || 'Xへの投稿に失敗しました。時間をおいて再度お試しください。',
        posted: data.posted,
      };
    }
    return data;
  } catch {
    return { error: 'network', message: 'Xへの接続に失敗しました。電波状況を確認して再度お試しください。' };
  }
}

export async function disconnectX(): Promise<boolean> {
  const uid = getXUid();
  try {
    const res = await fetch('/api/x/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── 自動投稿（予約） ───────────────────────────────
// 2026-07-09: 予約した時刻に api/cron/x-scheduled-posts が自動で投稿する。
// ブラウザを閉じていても実行される「本物の自動投稿」。
export interface ScheduledXPost {
  id: string;
  scheduledAt: string;
  tweets: string[];
  status: 'pending' | 'sent' | 'failed';
  createdAt: number;
  sentAt?: number;
  error?: string;
  urls?: string[];
}

export interface CreateScheduleResult {
  ok?: boolean;
  item?: ScheduledXPost;
  error?: string;
  message?: string;
}

/** 指定日時に自動投稿されるよう予約する。 */
export async function createXSchedule(scheduledAt: string, tweets: string[]): Promise<CreateScheduleResult> {
  const uid = getXUid();
  try {
    const res = await fetch('/api/x/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, scheduledAt, tweets }),
    });
    const data = (await res.json().catch(() => ({}))) as CreateScheduleResult;
    if (!res.ok) {
      return { error: data.error || 'schedule-failed', message: data.message || '予約に失敗しました。' };
    }
    return data;
  } catch {
    return { error: 'network', message: 'Xへの接続に失敗しました。電波状況を確認して再度お試しください。' };
  }
}

/** 自分の予約一覧を取得する。 */
export async function listXSchedule(): Promise<ScheduledXPost[]> {
  const uid = getXUid();
  try {
    const res = await fetch(`/api/x/schedule?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

/** 予約を削除する。 */
export async function deleteXSchedule(id: string): Promise<boolean> {
  const uid = getXUid();
  try {
    const res = await fetch('/api/x/schedule', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** URL の ?x_connected=1 / ?x_error=... を読み取り、読み終えたら除去。 */
export function readXCallbackResult(): { connected?: boolean; error?: string } | null {
  try {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('x_connected');
    const error = url.searchParams.get('x_error');
    if (!connected && !error) return null;
    url.searchParams.delete('x_connected');
    url.searchParams.delete('x_error');
    window.history.replaceState({}, '', url.toString());
    return { connected: connected === '1', error: error || undefined };
  } catch {
    return null;
  }
}

/** x_error コードを日本語に。 */
export function translateXError(code?: string): string {
  switch (code) {
    case 'not-configured':
      return 'Xの自動投稿はまだ準備中です（提供者が設定中）。';
    case 'state-mismatch':
    case 'missing-code-or-state':
    case 'state-lookup-failed':
      return '連携のセッションが切れました。お手数ですが、もう一度連携してください。';
    case 'token-exchange-failed':
    case 'no-access-token':
      return 'Xとの認証に失敗しました。もう一度連携してください。';
    case 'access_denied':
      return 'X側で「許可しない」が選ばれました。連携するには「許可」を押してください。';
    default:
      return `X連携でエラーが発生しました（${code || '不明'}）。もう一度お試しください。`;
  }
}
