// ============================================================
// src/lib/threadsConnect.ts — サーバー側 Threads (Meta) 連携のクライアントヘルパ。
// 匿名ID は X 連携と同じ core_x_uid を共用し、/api/threads/* を叩く。
// app_secret は一切扱わない（サーバー専用）。xConnect.ts と同形。
// ============================================================

const UID_KEY = 'core_x_uid';

/** 匿名ID（無ければ生成して保存）。X と共用。サーバーのトークン保存キーに使う。 */
export function getThreadsUid(): string {
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

export interface ThreadsStatus {
  configured: boolean;
  connected: boolean;
  username?: string;
}

export async function fetchThreadsStatus(): Promise<ThreadsStatus> {
  const uid = getThreadsUid();
  try {
    const res = await fetch(`/api/threads/status?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) return { configured: false, connected: false };
    return (await res.json()) as ThreadsStatus;
  } catch {
    return { configured: false, connected: false };
  }
}

/** 連携開始：サーバーの /api/threads/start へ遷移（state はサーバーが発行）。 */
export function startThreadsConnect(): void {
  const uid = getThreadsUid();
  window.location.href = `/api/threads/start?uid=${encodeURIComponent(uid)}`;
}

export interface ThreadsPostResult {
  ok?: boolean;
  ids?: string[];
  urls?: string[];
  username?: string;
  error?: string;
  message?: string;
  posted?: string[];
}

/** 返信チェーンを連投。成功/失敗いずれも意味あるメッセージ付きで返す。 */
export async function postThreadsChain(posts: string[]): Promise<ThreadsPostResult> {
  const uid = getThreadsUid();
  try {
    const res = await fetch('/api/threads/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, posts }),
    });
    const data = (await res.json().catch(() => ({}))) as ThreadsPostResult;
    if (!res.ok) {
      return {
        error: data.error || 'post-failed',
        message: data.message || 'Threadsへの投稿に失敗しました。時間をおいて再度お試しください。',
        posted: data.posted,
      };
    }
    return data;
  } catch {
    return { error: 'network', message: 'Threadsへの接続に失敗しました。電波状況を確認して再度お試しください。' };
  }
}

export async function disconnectThreads(): Promise<boolean> {
  const uid = getThreadsUid();
  try {
    const res = await fetch('/api/threads/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** URL の ?threads_connected=1 / ?threads_error=... を読み取り、読み終えたら除去。 */
export function readThreadsCallbackResult(): { connected?: boolean; error?: string } | null {
  try {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('threads_connected');
    const error = url.searchParams.get('threads_error');
    if (!connected && !error) return null;
    url.searchParams.delete('threads_connected');
    url.searchParams.delete('threads_error');
    window.history.replaceState({}, '', url.toString());
    return { connected: connected === '1', error: error || undefined };
  } catch {
    return null;
  }
}

/** threads_error コードを日本語に。 */
export function translateThreadsError(code?: string): string {
  switch (code) {
    case 'not-configured':
      return 'Threadsの自動投稿はまだ準備中です（提供者が設定中）。';
    case 'state-mismatch':
    case 'missing-code-or-state':
    case 'state-lookup-failed':
      return '連携のセッションが切れました。お手数ですが、もう一度連携してください。';
    case 'token-exchange-failed':
    case 'no-access-token':
      return 'Threadsとの認証に失敗しました。もう一度連携してください。';
    case 'access_denied':
      return 'Threads側で「許可しない」が選ばれました。連携するには「許可」を押してください。';
    default:
      return `Threads連携でエラーが発生しました（${code || '不明'}）。もう一度お試しください。`;
  }
}
