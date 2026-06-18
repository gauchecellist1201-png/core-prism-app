// ============================================================
// Celebrate — 成功の瞬間に弾ける「祝祭」バースト（紙吹雪＋称賛のひと言）
//
// 達成の瞬間に小さな感動を返す。リール完成・投稿予約・連携完了など、
// ユーザーが「やった」と感じる節目で 1 回だけ弾けて消える。Prism / Iris 共用。
// trigger を ++ するたびに発火。prefers-reduced-motion 時は粒子なしで
// メッセージだけ短く出す（揺らさない）。pointerEvents:none で操作を妨げない。
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const COLORS = ['#E1306C', '#F77737', '#FBBF24', '#833AB4', '#2DD4A7', '#FD7C9B', '#60A5FA'];

interface Particle { i: number; x: number; y: number; rot: number; color: string; size: number; delay: number; round: boolean }

function makeParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => {
    const a = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 190;
    return {
      i,
      x: Math.cos(a) * dist,
      y: Math.sin(a) * dist - 50,         // 少し上向きに開く
      rot: (Math.random() - 0.5) * 540,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 9,
      delay: Math.random() * 0.08,
      round: Math.random() > 0.5,
    };
  });
}

interface Props {
  /** ++ されるたびに発火 */
  trigger: number;
  /** 中央に出す称賛のひと言（任意） */
  message?: string;
}

export default function Celebrate({ trigger, message }: Props) {
  const reduce = useReducedMotion();
  const [shot, setShot] = useState<{ id: number; parts: Particle[]; message?: string } | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (!trigger) return;
    const id = ++idRef.current;
    setShot({ id, parts: reduce ? [] : makeParticles(26), message });
    const ms = reduce ? 1500 : 1900;
    const t = setTimeout(() => setShot((s) => (s && s.id === id ? null : s)), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <AnimatePresence>
      {shot && (
        <motion.div
          key={shot.id}
          initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {/* 中央のやわらかい閃光 */}
          {!reduce && (
            <motion.div aria-hidden
              initial={{ scale: 0.2, opacity: 0.6 }} animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(225,48,108,0.5), transparent 70%)' }}
            />
          )}
          {/* 紙吹雪 */}
          {shot.parts.map((p) => (
            <motion.div key={p.i} aria-hidden
              initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
              animate={{ x: p.x, y: [p.y, p.y + 140], opacity: [1, 1, 0], scale: 1, rotate: p.rot }}
              transition={{ duration: 1.5, delay: p.delay, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: p.size, height: p.round ? p.size : p.size * 0.5,
                borderRadius: p.round ? '50%' : 2,
                background: p.color, boxShadow: `0 0 8px ${p.color}aa`,
              }}
            />
          ))}
          {/* 称賛のひと言 */}
          {shot.message && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 13, stiffness: 220 }}
              style={{
                position: 'relative',
                background: 'linear-gradient(135deg, #E1306C, #F77737)',
                color: '#fff', fontWeight: 800, fontSize: 15,
                padding: '12px 22px', borderRadius: 999,
                boxShadow: '0 14px 38px rgba(225,48,108,0.45)',
                letterSpacing: '0.02em', whiteSpace: 'nowrap',
              }}
            >
              {shot.message}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
