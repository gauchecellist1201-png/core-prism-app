// ============================================================
// visualFx — 「見て気持ちいい」共通ビジュアル部品
// カウントアップ / スパークライン / リング / ごほうび演出
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ─── 数値カウントアップ ──────────────────────────────────────
export function useCountUp(target: number, durationMs = 900): number {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setVal(target); fromRef.current = target; return; }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const next = from + (target - from) * eased;
      setVal(next);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}

/** カウントアップしながら表示する数値。format で ¥ や % を付ける */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  durationMs = 900,
  style,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const animated = useCountUp(value, durationMs);
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {format(animated)}
    </span>
  );
}

// ─── スパークライン (小さな折れ線) ───────────────────────────
export function Sparkline({
  data,
  color,
  width = 96,
  height = 28,
  strokeWidth = 1.8,
  fill = true,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pad = strokeWidth;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${height} L ${pts[0][0].toFixed(1)} ${height} Z`;
  const gid = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />
      <motion.circle
        cx={last[0]} cy={last[1]} r={2.6} fill={color}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 1.05, type: 'spring', stiffness: 400, damping: 14 }}
      />
    </svg>
  );
}

// ─── リング進捗 (円形ゲージ) ─────────────────────────────────
export function RingProgress({
  percent,
  size = 64,
  stroke = 6,
  color,
  trackColor = 'rgba(128,128,140,0.18)',
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 5px ${color}88)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── ごほうび演出 (紙吹雪バースト) ───────────────────────────
const BURST_COLORS = ['#2E6FFF', '#E84B97', '#8E5CFF', '#FF7A1A', '#D9A41A'];

export function RewardBurst({
  show,
  accent,
  onDone,
  message,
}: {
  show: boolean;
  accent?: string;
  onDone?: () => void;
  message?: string;
}) {
  useEffect(() => {
    if (show && onDone) {
      const t = setTimeout(onDone, 1700);
      return () => clearTimeout(t);
    }
  }, [show, onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {/* 中央のチェック弾み */}
          <motion.div
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: [0, 1.25, 1], rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 16 }}
            style={{
              width: 88, height: 88, borderRadius: '50%',
              background: `linear-gradient(135deg, ${accent ?? '#8E5CFF'}, ${accent ?? '#2E6FFF'})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 16px 44px ${accent ?? '#8E5CFF'}77`,
              fontSize: 44, color: '#fff', fontWeight: 900,
            }}
          >
            ✓
          </motion.div>
          {/* グローのリング */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0.6 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              position: 'absolute', width: 88, height: 88, borderRadius: '50%',
              border: `2px solid ${accent ?? '#8E5CFF'}`,
            }}
          />
          {/* 紙吹雪 */}
          {Array.from({ length: 26 }).map((_, i) => {
            const angle = (i / 26) * Math.PI * 2 + Math.random() * 0.4;
            const dist = 120 + Math.random() * 150;
            const col = BURST_COLORS[i % BURST_COLORS.length];
            const square = i % 3 === 0;
            return (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist + 40,
                  opacity: [1, 1, 0],
                  scale: [0, 1, 0.8],
                  rotate: Math.random() * 540,
                }}
                transition={{ duration: 1.3, ease: 'easeOut', delay: 0.05 }}
                style={{
                  position: 'absolute',
                  width: square ? 9 : 7, height: square ? 9 : 7,
                  borderRadius: square ? 2 : '50%',
                  background: col,
                  boxShadow: `0 0 8px ${col}aa`,
                }}
              />
            );
          })}
          {message && (
            <motion.p
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 64, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.15 }}
              style={{
                position: 'absolute', fontWeight: 800, fontSize: '0.95rem',
                color: 'var(--fg-strong, #fff)', textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              }}
            >
              {message}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
