// ============================================================
// CORE Iris ▸ 投稿予約 一覧
// リール書き出し済 / 案件下書きから生成された予約を1画面で管理
// 「Instagram で開く」 → キャプションを自動コピー → IG アプリへ
// ============================================================
import { useMemo } from 'react';
import { Calendar, ExternalLink, Trash2, Copy, Check, Clock, AlertCircle, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { usePostQueue, buildCaptionText, type ScheduledPost } from './usePostQueue';
import { confirmAction } from '../lib/confirmDialog';
import EmptyInvite from './EmptyInvite';

interface Props {
  bg: IrisBackgroundDef;
  queue: ReturnType<typeof usePostQueue>;
}

const STATUS_META: Record<ScheduledPost['status'], { label: string; color: string; bg: string }> = {
  draft:     { label: '下書き',   color: '#5A5366', bg: '#F4F0FA' },
  scheduled: { label: '予約中',   color: '#0E7490', bg: '#CFFAFE' },
  ready:     { label: '投稿時刻', color: '#9A3412', bg: '#FFEDD5' },
  posted:    { label: '投稿済',   color: '#065F46', bg: '#ECFDF5' },
  skipped:   { label: 'スキップ', color: '#737373', bg: '#F5F5F5' },
};

export default function IrisPostQueueView({ bg, queue }: Props) {
  const sorted = useMemo(() => queue.upcoming(), [queue]);

  const open = (p: ScheduledPost) => {
    // キャプションをクリップボードにコピー
    const text = buildCaptionText(p);
    navigator.clipboard?.writeText(text).catch(() => {/* */});

    // Instagram を開く (モバイル: アプリ deeplink / デスクトップ: web)
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (p.mediaDataUrl && isMobile) {
      // メディアを download → ユーザーが IG アプリで貼り付け
      const a = document.createElement('a');
      a.href = p.mediaDataUrl;
      a.download = `iris-reel-${p.id}.${p.mediaKind === 'video' ? 'mp4' : 'jpg'}`;
      a.click();
    }
    // IG を開く
    if (isMobile) {
      // 試しに instagram://camera を叩く
      const ts = Date.now();
      window.location.href = 'instagram://library';
      // 1.5s 後にもアプリが起動してなければ web に
      setTimeout(() => {
        if (Date.now() - ts < 1800) window.open('https://www.instagram.com/', '_blank');
      }, 1500);
    } else {
      window.open('https://www.instagram.com/', '_blank');
    }

    // ステータスを「ready」に
    if (p.status !== 'posted') {
      queue.update(p.id, { status: 'ready' });
    }
  };

  const markPosted = (p: ScheduledPost) => queue.markPosted(p.id);

  return (
    <div style={{ display: 'grid', gap: '1rem', fontFamily: IRIS_FONTS.body }}>
      {/* ヘッダ */}
      <div>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>POST QUEUE</p>
        <h1 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', color: bg.ink, margin: '0.25rem 0 0.5rem', fontWeight: 500 }}>
          投稿予約。
        </h1>
        <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.7, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
          リール / 静止画 / 案件下書きから自動生成された予約を、Instagram を開くだけで投稿。
        </p>
      </div>

      {/* 保存失敗バナー */}
      {queue.saveError && (
        <div
          role="alert"
          style={{
            border: '1px solid rgba(220,80,80,0.4)',
            background: 'rgba(255,200,200,0.15)',
            color: '#8B0000',
            borderRadius: 12,
            padding: '0.6rem 0.8rem',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            fontSize: '0.78rem',
            lineHeight: 1.6,
          }}
        >
          <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{queue.saveError}</span>
          <button
            onClick={queue.dismissSaveError}
            style={{ background: 'transparent', border: 'none', color: '#8B0000', cursor: 'pointer', fontSize: '0.8rem' }}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
      )}

      {/* 統計 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        {([
          { key: 'ready',     icon: AlertCircle, n: sorted.filter(p => p.status === 'ready').length,     label: '投稿時刻' },
          { key: 'scheduled', icon: Clock,       n: sorted.filter(p => p.status === 'scheduled').length, label: '予約中' },
          { key: 'draft',     icon: ImageIcon,   n: sorted.filter(p => p.status === 'draft').length,     label: '下書き' },
          { key: 'posted',    icon: Check,       n: queue.posts.filter(p => p.status === 'posted').length, label: '投稿済' },
        ] as const).map(s => (
          <div key={s.key} style={{
            padding: '0.85rem 1rem',
            background: bg.card,
            border: `1px solid ${bg.cardBorder}`,
            borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <s.icon size={20} color={bg.accent} />
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: bg.ink, lineHeight: 1, fontFamily: IRIS_FONTS.display }}>{s.n}</div>
              <div style={{ fontSize: '0.7rem', color: bg.inkSoft, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* リスト */}
      {sorted.length === 0 ? (
        <EmptyInvite
          bg={bg}
          icon={Calendar}
          title="予約はまだ並んでいません"
          description={
            <>
              「リール作成」で動画を仕上げて、<strong>AI で投稿予約を作る</strong> を押すと、<br />
              ここに「いつ・どこに出すか」が時系列で並びます。
            </>
          }
          hint="一度入れた予約は時刻が近づくと自動で Instagram へ送り出します"
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {sorted.map(p => {
            const st = STATUS_META[p.status];
            const when = new Date(p.scheduledAt);
            const diff = when.getTime() - Date.now();
            const overdue = diff < 0 && p.status !== 'posted';
            const inHours = diff / 3_600_000;
            const whenText = overdue
              ? `予定時刻を ${Math.abs(inHours) < 24 ? Math.round(Math.abs(inHours) * 60) + '分' : Math.round(Math.abs(inHours) / 24) + '日'} 過ぎ`
              : inHours < 1
              ? `あと ${Math.max(1, Math.round(inHours * 60))} 分`
              : inHours < 24
              ? `あと ${Math.round(inHours)} 時間`
              : `${when.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })} ${when.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;

            return (
              <div key={p.id} style={{
                padding: '1rem 1.1rem',
                background: bg.card,
                border: `1px solid ${overdue ? bg.accent + '80' : bg.cardBorder}`,
                borderRadius: 14,
                display: 'grid', gridTemplateColumns: '88px 1fr auto', gap: 12,
                alignItems: 'start',
              }}>
                {/* サムネ */}
                <div style={{
                  width: 88, height: 156,
                  background: '#000', borderRadius: 10, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {p.thumbDataUrl ? (
                    <img src={p.thumbDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <VideoIcon size={28} color="rgba(255,255,255,0.4)" />
                  )}
                  {p.mediaKind && (
                    <span style={{
                      position: 'absolute', bottom: 4, right: 4,
                      background: 'rgba(0,0,0,0.7)', color: '#fff',
                      padding: '2px 5px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                    }}>{p.mediaKind === 'video' ? 'MP4' : 'JPG'}</span>
                  )}
                </div>

                {/* 本文 */}
                <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px',
                      borderRadius: 999, background: st.bg, color: st.color, letterSpacing: '0.05em',
                    }}>{st.label}</span>
                    {p.brandName && <span style={{ fontSize: '0.74rem', color: bg.accent, fontWeight: 700 }}>PR · {p.brandName}</span>}
                    <span style={{ fontSize: '0.72rem', color: overdue ? '#DC2626' : bg.inkSoft, fontWeight: overdue ? 700 : 500 }}>
                      {whenText}
                    </span>
                  </div>
                  <p style={{
                    margin: 0, fontSize: '0.85rem', color: bg.ink, lineHeight: 1.55,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {p.caption}
                  </p>
                  {p.hashtags?.length > 0 && (
                    <p style={{ margin: 0, fontSize: '0.72rem', color: bg.accent, lineHeight: 1.4 }}>
                      {p.hashtags.slice(0, 6).join(' ')}{p.hashtags.length > 6 ? ' …' : ''}
                    </p>
                  )}
                  {p.reelPattern && (
                    <p style={{ margin: 0, fontSize: '0.66rem', color: bg.inkSoft, fontStyle: 'italic' }}>
                      ベース: {p.reelPattern}
                    </p>
                  )}
                </div>

                {/* アクション */}
                <div style={{ display: 'grid', gap: 4 }}>
                  <button onClick={() => open(p)} title="Instagram で開く (キャプ自動コピー)" style={{
                    padding: '0.5rem 0.7rem',
                    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
                    color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer',
                    display: 'inline-flex', gap: 4, alignItems: 'center',
                  }}>
                    <ExternalLink size={11} /> 投稿
                  </button>
                  <button onClick={() => navigator.clipboard?.writeText(buildCaptionText(p))} title="キャプションをコピー" style={{
                    padding: '0.4rem 0.7rem',
                    background: 'transparent', color: bg.ink,
                    border: `1px solid ${bg.cardBorder}`, borderRadius: 8,
                    fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', gap: 4, alignItems: 'center',
                  }}>
                    <Copy size={11} /> コピー
                  </button>
                  {p.status === 'ready' && (
                    <button onClick={() => markPosted(p)} title="投稿済にする" style={{
                      padding: '0.4rem 0.7rem',
                      background: 'transparent', color: '#065F46',
                      border: `1px solid #10B98180`, borderRadius: 8,
                      fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                      display: 'inline-flex', gap: 4, alignItems: 'center',
                    }}>
                      <Check size={11} /> 完了
                    </button>
                  )}
                  <button onClick={async () => { if (await confirmAction({ title: 'この予約を削除しますか?', tone: 'danger' })) queue.remove(p.id); }} title="削除" style={{
                    padding: '0.4rem 0.7rem',
                    background: 'transparent', color: '#991B1B',
                    border: `1px solid #FCA5A5`, borderRadius: 8,
                    fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', gap: 4, alignItems: 'center',
                  }}>
                    <Trash2 size={11} /> 削除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: '0.72rem', color: bg.inkSoft, textAlign: 'center', fontStyle: 'italic' }}>
        ※ Instagram の API 制約上、本人が IG アプリで最終 1 タップ「投稿」する仕組みです。キャプションはクリップボードに自動コピー、動画は端末に保存されます。
      </p>
    </div>
  );
}
