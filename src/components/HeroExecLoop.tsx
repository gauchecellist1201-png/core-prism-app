// ============================================================
// HeroExecLoop — Hero 背景に CXO 14 名がうっすら浮遊する 8 秒ループ
//
// オーナー指示 (2026-06-03 第 12 波 YY):
//   静止画より動画 (動き) の方が CVR が上がる。Hero に CXO 役員が動く
//   8 秒ループを背景にうっすら入れる。CSS のみで完結 (動画ファイル不要)。
//
// 設計:
//   - aria-hidden / pointer-events:none で完全装飾
//   - prefers-reduced-motion 尊重 (動きを止めて opacity 0.05 で固定)
//   - 14 個の emoji を 7 列 2 行に配置し、それぞれ独自速度で上下フロート
// ============================================================

import { CXO_META, type CxoRole } from '../hooks/useAgentTaskQueue';
import { MetaIcon } from './ExecIcon';

const EXEC_ORDER: CxoRole[] = [
  'CEO', 'CTO', 'CPO', 'CDO', 'CMO', 'CSO', 'CFO',
  'COO', 'CDS', 'CLO', 'UIE', 'UXE', 'QAE', 'CHR',
];
const EXECS = EXEC_ORDER.map((role) => ({ role, meta: CXO_META[role], label: role }));

// 14 個 × 個別位相 + 速度
const KEYFRAMES_NAME = 'core-hero-exec-float';

export default function HeroExecLoop({
  density = 'normal',
}: {
  density?: 'subtle' | 'normal' | 'dense';
}) {
  const opacityBase = density === 'subtle' ? 0.08 : density === 'dense' ? 0.18 : 0.13;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      <style>{`
@keyframes ${KEYFRAMES_NAME} {
  0%   { transform: translate3d(0, 0, 0) scale(1); opacity: var(--peak-opacity, 0.18); }
  25%  { transform: translate3d(2px, -6px, 0) scale(1.02); opacity: var(--low-opacity, 0.06); }
  50%  { transform: translate3d(0, -12px, 0) scale(1.04); opacity: var(--peak-opacity, 0.18); }
  75%  { transform: translate3d(-2px, -6px, 0) scale(1.02); opacity: var(--low-opacity, 0.06); }
  100% { transform: translate3d(0, 0, 0) scale(1); opacity: var(--peak-opacity, 0.18); }
}
@keyframes core-hero-exec-orbit {
  0%   { transform: translate3d(0, 0, 0); }
  50%  { transform: translate3d(0, -10px, 0); }
  100% { transform: translate3d(0, 0, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .core-hero-exec-cell { animation: none !important; opacity: 0.05 !important; }
}
.core-hero-exec-cell {
  animation: ${KEYFRAMES_NAME} 8s ease-in-out infinite;
  will-change: transform, opacity;
}
      `}</style>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: 0,
          padding: '4% 6%',
        }}
      >
        {EXECS.map((e, i) => {
          // 各セルの遅延と継続時間にバリエーション
          const delay = (i * 0.45) % 3.6;
          const duration = 6 + (i % 5);
          const peak = opacityBase + ((i % 3) * 0.04);
          const low = Math.max(0.03, peak * 0.35);
          return (
            <div
              key={e.role + i}
              className="core-hero-exec-cell"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'clamp(2.6rem, 6vw, 4.4rem)',
                animationDelay: `${delay.toFixed(2)}s`,
                animationDuration: `${duration}s`,
                ['--peak-opacity' as never]: peak,
                ['--low-opacity' as never]: low,
                color: 'rgba(255,255,255,0.85)',
                filter: 'drop-shadow(0 0 14px rgba(167,139,250,0.18))',
              }}
            >
              <span aria-hidden style={{ lineHeight: 1, display: 'inline-flex' }}>
                <MetaIcon meta={e.meta} size={40} color="rgba(255,255,255,0.85)" strokeWidth={1.6} />
              </span>
              <span
                aria-hidden
                style={{
                  fontSize: '0.6rem',
                  letterSpacing: '0.18em',
                  fontWeight: 700,
                  marginTop: 4,
                  color: 'rgba(255,255,255,0.4)',
                  fontFamily: '"Inter","Hiragino Kaku Gothic ProN",sans-serif',
                }}
              >
                {e.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 中央フェード — テキストの可読性を確保 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(7,7,18,0.78) 0%, rgba(7,7,18,0.55) 35%, rgba(7,7,18,0.1) 70%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
