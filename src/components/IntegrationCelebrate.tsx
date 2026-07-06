// ============================================================
// IntegrationCelebrate — 連携完了の瞬間に「紙吹雪」+「これでできること 3 つ」
// + 「どの画面で見えるか」を見せて感動を生むお祝いモーダル
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, X, Check } from 'lucide-react';
import { getIntegrationBenefits, type IntegrationBenefit } from '../lib/integrationBenefits';

interface Props {
  /** 連携先の id (Tool.id と同じ) */
  integrationId: string;
  /** モーダルを閉じる */
  onClose: () => void;
  /** 「使ってみる」ボタンを押した時に該当画面へ飛ばす */
  onJump?: (screenHint: string) => void;
}

/** 簡易紙吹雪パーティクル */
function Confetti({ accent }: { accent: string }) {
  const pieces = useMemo(() => Array.from({ length: 60 }).map((_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 1.6 + Math.random() * 1.6,
    size: 4 + Math.random() * 6,
    color: [accent, '#FBBF24', '#10B981', '#60A5FA', '#F472B6', '#FFFFFF'][i % 6],
    rot: Math.random() * 360,
  })), [accent]);

  return (
    <div aria-hidden style={{
      position: 'fixed', inset: 0, pointerEvents: 'none',
      overflow: 'hidden', zIndex: 200,
    }}>
      {pieces.map((p, i) => (
        <motion.div
          key={i}
          initial={{ y: -40, x: `${p.x}vw`, rotate: 0, opacity: 1 }}
          animate={{
            y: '110vh',
            rotate: p.rot + 360 * 2,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeIn',
          }}
          style={{
            position: 'absolute',
            width: p.size, height: p.size * 0.5,
            background: p.color,
            borderRadius: p.size > 7 ? '50%' : 2,
            boxShadow: `0 0 6px ${p.color}88`,
          }}
        />
      ))}
    </div>
  );
}

export default function IntegrationCelebrate({ integrationId, onClose, onJump }: Props) {
  const benefit: IntegrationBenefit | null = getIntegrationBenefits(integrationId);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setShowConfetti(false), 3500);
    return () => window.clearTimeout(t);
  }, []);

  if (!benefit) {
    // 解説が登録されていない連携先は控えめなお祝いだけ
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 150,
          background: 'rgba(8,8,18,0.85)', backdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}
      >
        <Confetti accent="#A78BFA" />
        <motion.div
          initial={{ scale: 0.8, y: 24 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#12121E', borderRadius: 18,
            padding: '2rem 1.5rem', textAlign: 'center',
            maxWidth: 360, color: '#fff', border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          }}
        >
          {/* OS絵文字は使わない(恒久ルール) — ブランドグラデのスパークル */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden>
              <defs>
                <linearGradient id="celebGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
              <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" stroke="url(#celebGrad)" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" fill="url(#celebGrad)" opacity="0.85" />
              <path d="M5 15.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6.6-1.5z" fill="url(#celebGrad)" opacity="0.6" />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 8px' }}>連携できました</h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '0 0 16px' }}>
            CORE があなたの仕事をもっと支えられるようになりました。
          </p>
          <button onClick={onClose} style={ctaStyle('#A78BFA')}>OK</button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: 'rgba(8,8,18,0.86)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      {showConfetti && <Confetti accent={benefit.color} />}

      {/* 背景の光のグラデーション (動く) */}
      <motion.div
        aria-hidden
        animate={{
          background: [
            `radial-gradient(circle at 30% 30%, ${benefit.color}33 0%, transparent 50%)`,
            `radial-gradient(circle at 70% 50%, ${benefit.color}44 0%, transparent 55%)`,
            `radial-gradient(circle at 40% 70%, ${benefit.color}33 0%, transparent 50%)`,
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />

      <motion.div
        initial={{ scale: 0.86, y: 28, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 18, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', zIndex: 1,
          background: 'linear-gradient(180deg, #14141F 0%, #0E0E18 100%)',
          borderRadius: 22,
          padding: '1.6rem 1.4rem 1.4rem',
          maxWidth: 480, width: '100%',
          maxHeight: 'calc(100dvh - 2rem)', overflowY: 'auto',
          color: '#fff',
          border: `1px solid ${benefit.color}55`,
          boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${benefit.color}22, 0 0 60px ${benefit.color}33`,
        }}
      >
        {/* 閉じる */}
        <button
          type="button" onClick={onClose} aria-label="閉じる"
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, cursor: 'pointer', color: 'rgba(255,255,255,0.65)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 44, minWidth: 44,
          }}
        ><X size={16} /></button>

        {/* ヘッダ */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.7, delay: 0.1, type: 'spring' }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 72, height: 72, borderRadius: 22,
              background: `linear-gradient(135deg, ${benefit.color}, ${benefit.color}cc)`,
              boxShadow: `0 14px 36px ${benefit.color}88, inset 0 1px 0 rgba(255,255,255,0.3)`,
              marginBottom: 14,
              fontSize: 32, color: '#fff', fontWeight: 900,
            }}
          >
            <Check size={36} strokeWidth={3} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 10, letterSpacing: '0.28em', fontWeight: 800,
              color: benefit.color, marginBottom: 6, textTransform: 'uppercase',
            }}
          >
            <Sparkles size={11} /> Connected
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            style={{
              fontSize: '1.35rem', fontWeight: 900, margin: '0 0 4px', lineHeight: 1.35,
              background: `linear-gradient(135deg, #fff, ${benefit.color})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {benefit.name} とつながりました
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.6 }}
          >
            ここから、CORE があなたを 3 つの形で支えます
          </motion.p>
        </div>

        {/* 3 つの benefit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {benefit.benefits.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 + i * 0.12, duration: 0.4 }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 11,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 14,
                padding: '12px 13px',
              }}
            >
              <div style={{
                fontSize: 24, lineHeight: 1, flexShrink: 0,
                width: 40, height: 40, borderRadius: 11,
                background: `linear-gradient(135deg, ${benefit.color}22, ${benefit.color}08)`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{b.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 2, lineHeight: 1.4 }}>{b.title}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>{b.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 「ここで見える」 */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          style={{
            padding: '10px 12px', marginBottom: 14,
            background: `${benefit.color}10`,
            border: `1px solid ${benefit.color}30`,
            borderRadius: 12,
            fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <ArrowRight size={12} color={benefit.color} />
          <span><strong style={{ color: benefit.color }}>{benefit.whereVisible}</strong>からすぐ見られます</span>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          style={{ display: 'flex', gap: 8 }}
        >
          {onJump && (
            <button
              type="button"
              onClick={() => onJump(benefit.whereVisible)}
              style={{
                flex: 1,
                background: `linear-gradient(135deg, ${benefit.color}, ${benefit.color}cc)`,
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '12px 16px', fontSize: 13, fontWeight: 800,
                cursor: 'pointer', minHeight: 48,
                boxShadow: `0 10px 26px ${benefit.color}66`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <Sparkles size={14} /> いま見てみる
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: onJump ? '0 0 auto' : 1,
              background: 'rgba(255,255,255,0.06)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12,
              padding: '12px 16px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', minHeight: 48,
            }}
          >あとで</button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function ctaStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-block',
    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
    color: '#fff', border: 'none', borderRadius: 999,
    padding: '10px 28px', fontSize: 13, fontWeight: 800,
    cursor: 'pointer', minHeight: 44,
    boxShadow: `0 8px 22px ${color}55`,
  };
}
