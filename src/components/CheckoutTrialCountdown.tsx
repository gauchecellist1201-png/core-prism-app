// ============================================================
// CheckoutTrialCountdown — Stripe Checkout 直前の 7 日間 無料 演出
//
// オーナー指示 (2026-06-03 第 8 波 MM):
//   「あと 6 日 23:57:00 で残り無料体験開始」のカウントダウン +
//   「いま登録すれば今日含めて 7 日間ぜんぶ無料」コピーを表示。
//   framer-motion で数字が動く。
//
// 設計:
//   ローカルタイマー — Math.random は禁止 (キャッシュ破壊回避)。
//   ユーザーが画面を開いた瞬間を 0 とし、そこから「7 日間 − 経過秒」を
//   秒単位で表示。Stripe Checkout 後、サブスクの trial_end と一致する
//   タイミング感をユーザーに事前体感してもらう。
// ============================================================

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Sparkles } from 'lucide-react';

type Props = {
  /** 無料体験日数。CheckoutModal の hasReferralBonus に合わせて 7 / 10 / 14 等 */
  days?: number;
  /** Iris は pink、Prism は purple */
  accent?: string;
};

const SECOND_MS = 1000;

function fmt(n: number, w = 2): string {
  return String(Math.max(0, Math.floor(n))).padStart(w, '0');
}

export default function CheckoutTrialCountdown({ days = 7, accent = '#10B981' }: Props) {
  const totalSec = days * 24 * 60 * 60;
  const [start] = useState(() => Date.now());
  const [remaining, setRemaining] = useState(totalSec);

  useEffect(() => {
    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setRemaining(Math.max(0, totalSec - elapsed));
    };
    tick();
    const id = window.setInterval(tick, SECOND_MS);
    return () => window.clearInterval(id);
  }, [start, totalSec]);

  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  // 共通スタイル: モノスペース 数字 + アクセント色のリング
  const numStyle: React.CSSProperties = {
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 900,
    fontSize: 'clamp(1.5rem, 4vw, 1.95rem)',
    color: accent,
    lineHeight: 1,
    minWidth: '1.6em',
    display: 'inline-block',
    textAlign: 'center',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'rgba(0,0,0,0.55)',
    marginTop: 2,
    textTransform: 'uppercase',
  };
  const sepStyle: React.CSSProperties = {
    color: 'rgba(0,0,0,0.18)',
    fontWeight: 900,
    fontSize: 'clamp(1.5rem, 4vw, 1.95rem)',
    lineHeight: 1,
    transform: 'translateY(-2px)',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      style={{
        padding: '0.95rem 1rem',
        borderRadius: 16,
        background: `linear-gradient(135deg, ${accent}10, ${accent}05)`,
        border: `1px solid ${accent}44`,
        marginBottom: '1rem',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.7rem', fontWeight: 800,
        color: accent, letterSpacing: '0.06em',
        marginBottom: 8,
      }}>
        <Sparkles size={14} />
        いま登録すれば — 今日含めて {days} 日間 ぜんぶ無料
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, padding: '0.25rem 0.25rem 0' }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: '4ch' }}>
          <motion.span
            key={d}
            initial={{ y: -4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.22 }}
            style={numStyle}
          >{fmt(d)}</motion.span>
          <span style={labelStyle}>DAYS</span>
        </div>
        <span style={sepStyle}>:</span>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: '4ch' }}>
          <motion.span
            key={h}
            initial={{ y: -4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.22 }}
            style={numStyle}
          >{fmt(h)}</motion.span>
          <span style={labelStyle}>HRS</span>
        </div>
        <span style={sepStyle}>:</span>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: '4ch' }}>
          <motion.span
            key={m}
            initial={{ y: -4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.22 }}
            style={numStyle}
          >{fmt(m)}</motion.span>
          <span style={labelStyle}>MIN</span>
        </div>
        <span style={sepStyle}>:</span>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: '4ch' }}>
          <motion.span
            key={s}
            initial={{ y: -2, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.18 }}
            style={numStyle}
          >{fmt(s)}</motion.span>
          <span style={labelStyle}>SEC</span>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginTop: 10,
        padding: '0.4rem 0.6rem',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.55)',
        fontSize: '0.72rem', color: 'rgba(0,0,0,0.65)',
        lineHeight: 1.5,
      }}>
        <Clock size={12} color={accent} />
        <span>
          このタイマーは「今日登録する」を選んだ場合の無料体験 残り時間 (目安) です。
        </span>
      </div>
    </motion.div>
  );
}
