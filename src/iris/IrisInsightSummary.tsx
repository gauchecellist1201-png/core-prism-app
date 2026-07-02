// ============================================================
// IrisInsightSummary — 「今週のあなた」エグゼクティブ・カード
//
//   煩雑なアナリティクスを捨て、大きな数字 3 つだけの 1 枚:
//     生み出した投稿 / 予約済み / 連続稼働日数
//   すべて実データのみ (honest-numbers):
//     - 生み出した投稿 = irisActivity.getActivitySummary(7).total
//     - 予約済み       = usePostQueue の posts (scheduled/ready) 実数
//     - 連続稼働       = useDailyStreak の実測 (親から受け取る)
//   0 件なら数字を誇示せず、励ましの空状態を出す。推定値の捏造は絶対禁止。
//   右上の共有ボタンでテキストサマリをコピー (SNS にそのまま貼れる)。
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, Check, CalendarClock, Clock } from 'lucide-react';
import { getActivitySummary } from './irisActivity';
import { notifyInApp } from '../lib/inAppNotify';
import { IRIS_FONTS } from './irisStyle';
import { EASE_OUT_FM } from './motion';

interface Props {
  /** usePostQueue().posts (実データ) */
  posts?: any[];
  /** useDailyStreak().streak (実測。親で計測済みのものを受け取り二重計測を防ぐ) */
  streak?: number;
}

// 微細グレイン (SVG ノイズ) — 上品な紙質感
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")`;

const CARD_BG = [
  'radial-gradient(circle at 85% 115%, rgba(225,48,108,0.5) 0%, transparent 55%)',
  'radial-gradient(circle at 8% -10%, rgba(131,58,180,0.35) 0%, transparent 45%)',
  'linear-gradient(150deg, #1A0A26 0%, #2E0F38 55%, #7A1B4E 100%)',
].join(', ');

export default function IrisInsightSummary({ posts, streak = 0 }: Props) {
  const [summary, setSummary] = useState(() => getActivitySummary(7));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const refresh = () => setSummary(getActivitySummary(7));
    window.addEventListener('iris-activity', refresh);
    window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('iris-activity', refresh);
      window.removeEventListener('storage', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const created = summary.total;
  const scheduled = useMemo(
    () => (posts || []).filter(p => p?.status === 'scheduled' || p?.status === 'ready').length,
    [posts],
  );

  // 「よく予約する時間帯」— 実データが 3 件以上ある時だけ (honest)
  const timeInsight = useMemo(() => {
    const list = (posts || []).filter(p => p?.scheduledAt);
    if (list.length < 3) return null;
    const byHour: Record<number, number> = {};
    for (const p of list) {
      const h = new Date(p.scheduledAt).getHours();
      if (Number.isNaN(h)) continue;
      byHour[h] = (byHour[h] || 0) + 1;
    }
    const top = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    return top ? { hour: Number(top[0]) } : null;
  }, [posts]);

  // 次の予約 (未来の scheduled のうち最も近いもの)
  const nextPost = useMemo(() => {
    const future = (posts || [])
      .filter(p => p?.status === 'scheduled' && p?.scheduledAt && new Date(p.scheduledAt).getTime() > Date.now())
      .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
    return future[0] || null;
  }, [posts]);

  const share = async () => {
    const lines = [
      '今週のわたし ─ IRISと一緒に',
      `・生み出した投稿 ${created}本`,
      `・予約済み ${scheduled}本`,
      `・連続稼働 ${streak}日`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      notifyInApp({ kind: 'success', title: 'サマリーをコピーしました', body: 'そのままSNSに貼れます。' });
    } catch {
      notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: 'もう一度お試しください。' });
    }
  };

  const hasAnyData = created > 0 || scheduled > 0;

  return (
    <motion.section
      aria-label="今週のあなた"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT_FM }}
      style={{
        position: 'relative',
        borderRadius: 24,
        padding: hasAnyData ? '1.35rem 1.25rem 1.2rem' : '1.15rem 1.25rem',
        background: CARD_BG,
        border: '1px solid rgba(225,48,108,0.28)',
        overflow: 'hidden',
        boxShadow: '0 10px 32px rgba(26,10,38,0.35)',
      }}
    >
      {/* 微細グレイン */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        backgroundImage: GRAIN,
        opacity: 0.07, mixBlendMode: 'overlay', pointerEvents: 'none',
      }} />

      {/* ヘッダ */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: '0 0 0.2rem', fontSize: '0.6rem', letterSpacing: '0.28em',
            color: '#FCB045', fontWeight: 800, textTransform: 'uppercase',
            fontFamily: IRIS_FONTS.body,
          }}>
            This Week
          </p>
          <h3 style={{
            margin: 0, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
            fontSize: '1.35rem', fontWeight: 600, color: '#FFF8F0', lineHeight: 1.3,
          }}>
            今週のあなた
          </h3>
        </div>
        {hasAnyData && (
          <button
            type="button"
            onClick={share}
            aria-label="サマリーをコピーして共有"
            title="サマリーをコピー"
            style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.85)',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {copied ? <Check size={16} strokeWidth={2.4} /> : <Share2 size={16} strokeWidth={2.2} />}
          </button>
        )}
      </div>

      {hasAnyData ? (
        <>
          {/* 大きな数字 3 つ (実データのみ) */}
          <div style={{
            position: 'relative',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem',
            marginTop: '1.1rem',
          }}>
            <BigNumber n={created} unit="本" label="生み出した投稿" />
            <BigNumber n={scheduled} unit="本" label="予約済み" />
            <BigNumber n={streak} unit="日" label="連続稼働" />
          </div>

          {/* 実データがある時だけの下段インサイト */}
          {(timeInsight || nextPost) && (
            <div style={{
              position: 'relative',
              display: 'flex', gap: '0.45rem', flexWrap: 'wrap',
              marginTop: '1rem', paddingTop: '0.85rem',
              borderTop: '1px solid rgba(255,255,255,0.12)',
            }}>
              {timeInsight && (
                <span style={chipStyle}>
                  <Clock size={12} strokeWidth={2.2} color="#FCB045" />
                  よく予約する時間帯: {timeInsight.hour}時台
                </span>
              )}
              {nextPost && (
                <span style={chipStyle}>
                  <CalendarClock size={12} strokeWidth={2.2} color="#FCB045" />
                  次の予約: {fmtShort(new Date(nextPost.scheduledAt))}
                </span>
              )}
            </div>
          )}

          <p style={{
            position: 'relative',
            margin: '0.8rem 0 0', fontSize: '0.62rem',
            color: 'rgba(255,255,255,0.45)', lineHeight: 1.5,
          }}>
            実際に作成・予約された数だけを数えています
          </p>
        </>
      ) : (
        /* 励ましの空状態 (偽数字は出さない) */
        <p style={{
          position: 'relative',
          margin: '0.7rem 0 0.2rem',
          color: 'rgba(255,255,255,0.78)', fontSize: '0.85rem', lineHeight: 1.75,
        }}>
          最初の思考をひとつ投げると、ここにあなたの1週間が刻まれていきます。
          小さなひらめきで大丈夫です。
        </p>
      )}
    </motion.section>
  );
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 999, padding: '0.35rem 0.7rem',
  fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)',
};

function fmtShort(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

function BigNumber({ n, unit, label }: { n: number; unit: string; label: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{
          fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontWeight: 800,
          fontSize: 'clamp(1.8rem, 8vw, 2.5rem)', lineHeight: 1,
          color: '#FFF8F0', letterSpacing: '-0.02em',
        }}>
          {n.toLocaleString()}
        </span>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>
          {unit}
        </span>
      </div>
      <p style={{
        margin: '0.35rem 0 0', fontSize: '0.65rem', fontWeight: 700,
        letterSpacing: '0.05em', color: 'rgba(255,255,255,0.62)', lineHeight: 1.35,
      }}>
        {label}
      </p>
    </div>
  );
}
