// ============================================================
// ThreadsPostPanel — Threads 自動投稿（CORE 経由の OAuth 連携）の共通パネル。
// Prism / Iris どちらの投稿系画面でも使えるよう自己完結化したコンポーネント。
//
// できること（上から順に、迷わない構成）:
//   ① Threadsで共有（設定ゼロ・すぐ投稿）
//   ② 連携して自動投稿 — AI画像を1枚目に添付 / いますぐ投稿 / 日時を決めて予約
// 画像は Pollinations（公開URLが安定）で生成し、Threads の image_url にそのまま渡す。
// 予約は api/threads/schedule に保存され、cron が時刻到来分を自動投稿する。
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { notifyInApp } from '../lib/inAppNotify';
import {
  fetchThreadsStatus, startThreadsConnect, postThreadsChain, disconnectThreads,
  readThreadsCallbackResult, translateThreadsError, type ThreadsStatus,
  fetchThreadsSchedules, createThreadsSchedule, deleteThreadsSchedule, type ThreadsSchedule,
} from '../lib/threadsConnect';
import { generateImage } from '../lib/imageGen';

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

/** datetime-local の初期値（1時間後・分は00）をローカル時刻で作る。 */
function defaultScheduleLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtJp(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return iso; }
}

export default function ThreadsPostPanel({ posts, brand = 'prism', compact = false }: Props) {
  const accent = BRAND_ACCENT[brand];

  const [threadsStatus, setThreadsStatus] = useState<ThreadsStatus>({ configured: false, connected: false });
  const [threadsPosting, setThreadsPosting] = useState(false);

  // AI画像（1枚目の投稿に添付）
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageHint, setImageHint] = useState('');
  const [imageBusy, setImageBusy] = useState(false);

  // 予約
  const [schedules, setSchedules] = useState<ThreadsSchedule[]>([]);
  const [scheduleAt, setScheduleAt] = useState<string>(defaultScheduleLocal());
  const [scheduling, setScheduling] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const refreshThreadsStatus = useCallback(async () => {
    const st = await fetchThreadsStatus();
    setThreadsStatus(st);
    if (st.connected) setSchedules(await fetchThreadsSchedules());
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

  const imagesArg = useCallback((): (string | null)[] | undefined => {
    if (!imageUrl) return undefined;
    return posts.map((_, i) => (i === 0 ? imageUrl : null));
  }, [imageUrl, posts]);

  const handleThreadsPost = useCallback(async () => {
    if (posts.length === 0) return;
    setThreadsPosting(true);
    try {
      const r = await postThreadsChain(posts, imagesArg());
      if (r.ok && r.urls && r.urls.length > 0) {
        notifyInApp({
          kind: 'success',
          title: `Threadsに${r.urls.length}本の連続スレッドを投稿しました${imageUrl ? '（画像つき）' : ''}`,
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
  }, [posts, imagesArg, imageUrl]);

  const handleThreadsDisconnect = useCallback(async () => {
    const ok = await disconnectThreads();
    if (ok) {
      setThreadsStatus((s) => ({ ...s, connected: false, username: undefined }));
      notifyInApp({ kind: 'info', title: 'Threadsの連携を解除しました', body: 'いつでも再連携できます。' });
    }
  }, []);

  /** AI画像を生成（公開URLが安定な Pollinations 固定 = 予約投稿でも切れない）。 */
  const handleGenerateImage = useCallback(async () => {
    const seedText = imageHint.trim() || posts[0]?.slice(0, 120) || '';
    if (!seedText) {
      notifyInApp({ kind: 'warn', title: '画像のもとになる文がありません', body: '本文を作るか、画像のイメージを一言入れてください。' });
      return;
    }
    setImageBusy(true);
    try {
      const r = await generateImage({
        prompt: seedText,
        aspect: 'x-post',            // 16:9（Threadsでもきれいに収まる）
        style: 'editorial',
        provider: 'pollinations',    // 公開URLが安定（予約投稿でも期限切れしない）
      });
      setImageUrl(r.url);
      notifyInApp({ kind: 'success', title: 'アイキャッチ画像ができました', body: '1枚目の投稿に添付されます。気に入らなければ「作り直す」。' });
    } catch {
      notifyInApp({ kind: 'warn', title: '画像を作れませんでした', body: '少し時間をおいて、もう一度お試しください。' });
    } finally {
      setImageBusy(false);
    }
  }, [imageHint, posts]);

  /** 予約を作成。 */
  const handleSchedule = useCallback(async () => {
    if (posts.length === 0 || !scheduleAt) return;
    const iso = new Date(scheduleAt).toISOString();
    setScheduling(true);
    try {
      const r = await createThreadsSchedule(iso, posts, imagesArg());
      if (r.ok && r.item) {
        setSchedules((prev) => [...prev, r.item!].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)));
        notifyInApp({ kind: 'success', title: `${fmtJp(iso)} に予約しました`, body: 'ブラウザを閉じても自動で投稿されます。' });
      } else {
        notifyInApp({ kind: 'warn', title: '予約できませんでした', body: r.message || '時間をおいて再度お試しください。' });
      }
    } finally {
      setScheduling(false);
    }
  }, [posts, scheduleAt, imagesArg]);

  const handleDeleteSchedule = useCallback(async (id: string) => {
    const ok = await deleteThreadsSchedule(id);
    if (ok) setSchedules((prev) => prev.filter((s) => s.id !== id));
    else notifyInApp({ kind: 'warn', title: '削除できませんでした', body: 'もう一度お試しください。' });
  }, []);

  // 設定ゼロの“かんたん投稿”：スマホの共有機能でThreadsアプリを開く。
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
  const pending = schedules.filter((s) => s.status === 'pending');
  const recentDone = schedules.filter((s) => s.status !== 'pending').slice(-3);

  const ghostBtn: React.CSSProperties = {
    padding: '0.55rem 0.9rem', minHeight: 44, background: 'transparent', color: 'var(--fg)',
    border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
  };

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

      {/* ② 自動投稿（任意・上級）：一度だけ連携すると、画像つき・予約つきで全自動 */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginBottom: 6 }}>もっと楽に：連携すると「画像つき」「予約」まで全自動</div>
      {!threadsStatus.configured ? (
        <p style={{ fontSize: '0.76rem', color: 'var(--fg-muted)', margin: 0, lineHeight: 1.6 }}>
          自動投稿（連携）は準備中です。上の「Threadsで共有」は今すぐお使いいただけます。
        </p>
      ) : threadsStatus.connected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
              {threadsStatus.username ? `@${threadsStatus.username} に投稿` : 'Threadsに投稿'}
            </span>
            <button
              onClick={handleThreadsDisconnect}
              style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', minHeight: 32, background: 'transparent', color: 'var(--fg-muted)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, cursor: 'pointer' }}
            >連携を解除</button>
          </div>

          {/* AI画像（1枚目に添付） */}
          <div style={{ padding: '0.7rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)', borderRadius: 10 }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, marginBottom: 6 }}>アイキャッチ画像（AIがつくって1枚目に添付）</div>
            {imageUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <img
                  src={imageUrl}
                  alt="生成したアイキャッチ画像のプレビュー"
                  style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleGenerateImage} disabled={imageBusy} style={{ ...ghostBtn, flex: 1, opacity: imageBusy ? 0.6 : 1 }}>
                    {imageBusy ? 'つくり直しています…' : '作り直す'}
                  </button>
                  <button onClick={() => setImageUrl(null)} style={{ ...ghostBtn, flex: 1 }}>画像を外す</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  value={imageHint}
                  onChange={(e) => setImageHint(e.target.value)}
                  placeholder="画像のイメージ（空なら本文から自動で）"
                  style={{ width: '100%', minHeight: 44, padding: '0.55rem 0.75rem', fontSize: 16, background: 'rgba(255,255,255,0.05)', color: 'var(--fg)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, outline: 'none' }}
                />
                <button
                  onClick={handleGenerateImage}
                  disabled={imageBusy || noPosts}
                  style={{ width: '100%', padding: '0.65rem', minHeight: 44, background: 'transparent', color: accent, border: `1px solid ${accent}66`, borderRadius: 10, fontSize: '0.85rem', fontWeight: 800, cursor: imageBusy || noPosts ? 'default' : 'pointer', opacity: imageBusy || noPosts ? 0.6 : 1 }}
                >
                  {imageBusy ? '画像を生成しています…（10秒ほど）' : 'AIで画像をつくる'}
                </button>
              </div>
            )}
          </div>

          {/* いますぐ投稿 */}
          <button
            onClick={handleThreadsPost}
            disabled={disabled}
            style={{ width: '100%', padding: '0.75rem', minHeight: 44, background: disabled ? 'rgba(255,255,255,0.08)' : accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 800, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.7 : 1 }}
          >
            {threadsPosting ? '投稿中…' : `いますぐ投稿（${posts.length}本${imageUrl ? '・画像つき' : ''}）`}
          </button>

          {/* 予約（自動投稿） */}
          <div>
            <button
              onClick={() => setShowSchedule((v) => !v)}
              style={{ ...ghostBtn, width: '100%' }}
            >
              {showSchedule ? '予約を閉じる' : `日時を決めて自動投稿（予約）${pending.length > 0 ? ` — ${pending.length}件予約中` : ''}`}
            </button>
            {showSchedule && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    style={{ flex: '1 1 200px', minHeight: 44, padding: '0.4rem 0.6rem', fontSize: 16, background: 'rgba(255,255,255,0.05)', color: 'var(--fg)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, outline: 'none' }}
                  />
                  <button
                    onClick={handleSchedule}
                    disabled={scheduling || noPosts}
                    style={{ flex: '1 1 140px', minHeight: 44, padding: '0.55rem 0.9rem', background: scheduling || noPosts ? 'rgba(255,255,255,0.08)' : accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 800, cursor: scheduling || noPosts ? 'default' : 'pointer' }}
                  >
                    {scheduling ? '予約しています…' : `この日時で予約${imageUrl ? '（画像つき）' : ''}`}
                  </button>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', margin: 0, lineHeight: 1.6 }}>
                  ブラウザを閉じても自動で投稿されます（毎朝の自動実行でまとめて送信。指定時刻から遅れることがあります）。
                </p>
                {(pending.length > 0 || recentDone.length > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pending.map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.65rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 800, color: accent, flexShrink: 0 }}>{fmtJp(s.scheduledAt)}</span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.images?.[0] ? '画像つき・' : ''}{s.posts[0]}
                        </span>
                        <button onClick={() => handleDeleteSchedule(s.id)} aria-label="この予約を削除" style={{ flexShrink: 0, minHeight: 32, padding: '0.2rem 0.55rem', background: 'transparent', color: 'var(--fg-muted)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, fontSize: '0.7rem', cursor: 'pointer' }}>削除</button>
                      </div>
                    ))}
                    {recentDone.map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.45rem 0.65rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, opacity: 0.75 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: s.status === 'sent' ? '#34d399' : '#f87171', flexShrink: 0 }}>
                          {s.status === 'sent' ? '投稿済み' : '失敗'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fmtJp(s.scheduledAt)} — {s.status === 'sent' ? s.posts[0] : (s.error || '投稿に失敗しました')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
