// ============================================================
// useCelebrate — 「達成感」を要所で散らすための共通フック
//
// 設計指針 (2026-05-25 オーナー指示):
//  - TaskHub の RewardBurst と同じ「気持ちよさ」をキー成功イベントへ展開
//  - 紙吹雪 (絵文字) + トースト 2 秒、ReactDOM.createPortal で body に独立描画
//  - level: 'small' | 'big' (big は紙吹雪倍量 + 短い和音 SE)
//  - localStorage `core_celebrate_disabled = '1'` で無効化 (a11y / reduced motion 連動)
//  - prefers-reduced-motion: reduce が真なら抑制
//
// 使い方:
//   const { celebrate, CelebratePortal } = useCelebrate();
//   ...
//   <>{CelebratePortal}{ ...本体... }</>
//   ...
//   celebrate({ message: '受注おめでとうございます！', level: 'big' });
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJIS = ['🎉', '✨', '💫', '⭐', '🌟'];
const DISABLED_KEY = 'core_celebrate_disabled';

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
};

const isDisabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    if (localStorage.getItem(DISABLED_KEY) === '1') return true;
  } catch { /* ignore */ }
  return prefersReducedMotion();
};

/** 軽い「祝う和音」を Web Audio で 0.6 秒ほど鳴らす */
function playCelebrationChord(level: 'small' | 'big') {
  if (typeof window === 'undefined') return;
  try {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    // C メジャー (C5 E5 G5) + big は C6
    const freqs = level === 'big' ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    const now = ctx.currentTime;
    const duration = level === 'big' ? 0.8 : 0.45;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02 + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + duration + 0.05);
    });
    setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, (duration + 0.2) * 1000);
  } catch { /* silent */ }
}

interface CelebrateRequest {
  id: number;
  message: string;
  level: 'small' | 'big';
}

interface CelebrateOpts {
  message: string;
  level?: 'small' | 'big';
}

let nextId = 1;

/**
 * useCelebrate — `celebrate({ message, level })` と `CelebratePortal` を返す。
 * `CelebratePortal` を JSX に置くと、紙吹雪 + トーストが body 直下に描画される。
 */
export function useCelebrate() {
  const [current, setCurrent] = useState<CelebrateRequest | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const celebrate = useCallback((opts: CelebrateOpts) => {
    const message = opts.message;
    const level: 'small' | 'big' = opts.level || 'small';

    if (isDisabled()) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('core:notify', {
            detail: { kind: 'success', title: message, duration: 1800 },
          }));
        }
      } catch { /* ignore */ }
      return;
    }

    const req: CelebrateRequest = { id: nextId++, message, level };
    setCurrent(req);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setCurrent(c => (c?.id === req.id ? null : c));
      timerRef.current = null;
    }, 2000);
    playCelebrationChord(level);
  }, []);

  const CelebratePortal = typeof document !== 'undefined'
    ? createPortal(<CelebrateLayer current={current} />, document.body)
    : null;

  return { celebrate, CelebratePortal };
}

function CelebrateLayer({ current }: { current: CelebrateRequest | null }) {
  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
          aria-live="polite"
          role="status"
        >
          <ConfettiPieces level={current.level} />
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            style={{
              position: 'absolute',
              top: '38%', left: '50%',
              transform: 'translate(-50%, -50%)',
              padding: '14px 22px',
              borderRadius: 999,
              background: 'linear-gradient(135deg, rgba(168,139,250,0.95), rgba(225,48,108,0.95))',
              color: '#fff',
              fontSize: current.level === 'big' ? 18 : 15,
              fontWeight: 800,
              letterSpacing: '0.02em',
              boxShadow: '0 12px 40px rgba(168,139,250,0.45)',
              textShadow: '0 2px 10px rgba(0,0,0,0.35)',
              maxWidth: 'calc(100vw - 32px)',
              textAlign: 'center',
            }}
          >
            <span aria-hidden style={{ marginRight: 6 }}>✨</span>
            {current.message}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ConfettiPieces({ level }: { level: 'small' | 'big' }) {
  const count = level === 'big' ? 110 : 60;
  const pieces = useRef<Array<{ x: number; emoji: string; delay: number; dur: number; rot: number; size: number }> | null>(null);
  if (!pieces.current) {
    pieces.current = Array.from({ length: count }).map(() => ({
      x: Math.random() * 100,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      delay: Math.random() * 0.4,
      dur: 1.6 + Math.random() * 0.8,
      rot: (Math.random() - 0.5) * 720,
      size: 18 + Math.random() * 20,
    }));
  }
  return (
    <>
      {pieces.current.map((p, i) => (
        <motion.span
          key={i}
          initial={{ y: '110vh', x: `${p.x}vw`, rotate: 0, opacity: 0 }}
          animate={{
            y: '-20vh',
            rotate: p.rot,
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            ease: 'easeOut',
            times: [0, 0.1, 0.85, 1],
          }}
          style={{
            position: 'absolute',
            left: 0, top: 0,
            fontSize: p.size,
            userSelect: 'none',
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </>
  );
}

export default useCelebrate;
