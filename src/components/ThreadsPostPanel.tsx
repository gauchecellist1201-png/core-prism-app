// ============================================================
// ThreadsPostPanel — Threads 自動投稿（CORE 経由の OAuth 連携）の共通パネル。
// Prism / Iris どちらの投稿系画面でも使えるよう自己完結化したコンポーネント。
// バックエンド(api/threads/*) と threadsConnect.ts は変更せずそのまま利用する。
// 見た目・挙動は ContentEngineStudio のインライン実装を完全踏襲。
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { notifyInApp } from '../lib/inAppNotify';
import {
  fetchThreadsStatus, startThreadsConnect, postThreadsChain, disconnectThreads,
  readThreadsCallbackResult, translateThreadsError, type ThreadsStatus,
} from '../lib/threadsConnect';

interface Props {
  /** 投稿する本文（複数なら連続スレッドとして連投）。空なら投稿ボタンは無効。 */
  posts: string[];
  /** アクセント色の切替（prism=紫 / iris=ピンク）。 */
  brand?: 'prism' | 'iris';
  /** コンパクト表示（余白を詰める）。 */
  compact?: boolean;
}

const BRAND_ACCENT: Record<'prism' | 'iris', string> = {
  prism: '#8b5cf6', // 紫
  iris: '#ec4899',  // ピンク
};

export default function ThreadsPostPanel({ posts, brand = 'prism', compact = false }: Props) {
  const accent = BRAND_ACCENT[brand];

  const [threadsStatus, setThreadsStatus] = useState<ThreadsStatus>({ configured: false, connected: false });
  const [threadsPosting, setThreadsPosting] = useState(false);

  const refreshThreadsStatus = useCallback(async () => {
    setThreadsStatus(await fetchThreadsStatus());
  }, []);

  // 起動時に連携状態を取得 + コールバック結果(?threads_connected / ?threads_error)を拾う
  useEffect(() => {
    const tcb = readThreadsCallbackResult();
    if (tcb) {
      if (tcb.connected) {
        notifyInApp({ kind: 'success', title: 'Threadsと連携しました', body: 'これで「Threadsに投稿する」からワンタップ投稿できます。' });
      } else if (tcb.error) {
        notifyInApp({ kind: 'warn', title: 'Threads連携でエラー', body: translateThreadsError(tcb.error) });
      }
    }
    refreshThreadsStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleThreadsPost = useCallback(async () => {
    if (posts.length === 0) return;
    setThreadsPosting(true);
    try {
      const r = await postThreadsChain(posts);
      if (r.ok && r.urls && r.urls.length > 0) {
        notifyInApp({
          kind: 'success',
          title: `Threadsに${r.urls.length}本の連続スレッドを投稿しました`,
          body: r.urls[0],
        });
      } else if (r.error === 'reauth') {
        notifyInApp({ kind: 'warn', title: '再連携が必要です', body: r.message || 'もう一度「Threadsと連携」してください。' });
        setThreadsStatus((s) => ({ ...s, connected: false }));
      } else if (r.error === 'rate') {
        notifyInApp({ kind: 'warn', title: '投稿上限に達しました', body: r.message || 'Threadsの投稿上限に達しました。時間をおいて再度お試しください。' });
      } else {
        notifyInApp({ kind: 'warn', title: 'Threads投稿に失敗', body: r.message || 'Threadsへの投稿に失敗しました。' });
      }
    } finally {
      setThreadsPosting(false);
    }
  }, [posts]);

  const handleThreadsDisconnect = useCallback(async () => {
    const ok = await disconnectThreads();
    if (ok) {
      setThreadsStatus((s) => ({ ...s, connected: false, username: undefined }));
      notifyInApp({ kind: 'info', title: 'Threadsの連携を解除しました', body: 'いつでも再連携できます。' });
    }
  }, []);

  // 設定ゼロの“かんたん投稿”：スマホの共有機能でThreadsアプリを開く。
  // 共有非対応の環境は、本文をコピーしてThreadsを開く（貼り付けるだけ）。
  // 連携(OAuth)も審査も不要で、誰でも今すぐ使える入口。
  const shareToThreads = useCallback(async () => {
    if (posts.length === 0) return;
    const text = posts.join('\n\n');
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try { await nav.share({ text }); return; } catch { /* キャンセル/失敗→フォールバックへ */ }
    }
    try { await nav?.clipboard?.writeText(text); } catch { /* */ }
    if (typeof window !== 'undefined') window.open('https://www.threads.net/', '_blank', 'noopener');
    notifyInApp({ kind: 'info', title: '本文をコピーしました', body: 'Threadsが開きます。投稿欄に貼り付けて投稿してください。' });
  }, [posts]);

  const disabled = threadsPosting || posts.length === 0;
  const noPosts = posts.length === 0;

  return (
    <div style={{ marginTop: compact ? 0 : 8, padding: compact ? '0.7rem 0.85rem' : '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: '0.95rem' }}>@</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>Threads に投稿</span>
      </div>

      {/* ① かんたん投稿（設定ゼロ・誰でも今すぐ）：共有でThreadsを開く */}
      <button
        onClick={shareToThreads}
        disabled={noPosts}
        style={{ width: '100%', padding: '0.75rem', minHeight: 44, background: noPosts ? 'rgba(255,255,255,0.08)' : accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 800, cursor: noPosts ? 'default' : 'pointer', opacity: noPosts ? 0.7 : 1 }}
      >
        Threadsで共有（すぐ投稿）
      </button>
      <p style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', margin: '6px 0 0', lineHeight: 1.6 }}>
        スマホの共有からThreadsが開きます。連携も設定も不要で、すぐに投稿できます。
      </p>

      {/* ② 自動投稿（任意・上級）：一度だけ連携すると以降ワンタップで連続スレッド */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginBottom: 6 }}>もっと楽に：連携すると自動で連続スレッド投稿</div>
      {!threadsStatus.configured ? (
        <p style={{ fontSize: '0.76rem', color: 'var(--fg-muted)', margin: 0, lineHeight: 1.6 }}>
          自動投稿（連携）は準備中です。上の「Threadsで共有」は今すぐお使いいただけます。
        </p>
      ) : threadsStatus.connected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
              {threadsStatus.username ? `@${threadsStatus.username} に投稿` : 'Threadsに投稿'}
            </span>
            <button
              onClick={handleThreadsDisconnect}
              style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, cursor: 'pointer' }}
            >連携を解除</button>
          </div>
          <button
            onClick={handleThreadsPost}
            disabled={disabled}
            style={{ width: '100%', padding: '0.75rem', minHeight: 44, background: disabled ? 'rgba(255,255,255,0.08)' : accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 800, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.7 : 1 }}
          >
            {threadsPosting ? '投稿中…' : `Threadsに投稿する（${posts.length}本を連続スレッド）`}
          </button>
        </div>
      ) : (
        <button
          onClick={startThreadsConnect}
          style={{ width: '100%', padding: '0.75rem', minHeight: 44, background: accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer' }}
        >
          Threadsと連携（初回だけ）
        </button>
      )}
      </div>
    </div>
  );
}
