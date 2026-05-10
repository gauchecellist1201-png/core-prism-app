// ============================================================
// CORE Iris — デザインシステム拡張
// Pinterest / Instagram / Vogue レベルのビジュアル品質
// ============================================================

// ── 8pt スペーススケール ──────────────────────────────────
export const SPACE = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
  32: '128px',
} as const;

// ── 角丸トークン ──────────────────────────────────────────
export const RADIUS = {
  sm:   '8px',
  md:   '12px',
  lg:   '18px',
  xl:   '24px',
  '2xl':'36px',
  full: '9999px',
} as const;

// ── 影 (4 レベル) ─────────────────────────────────────────
export const SHADOW = {
  xs:  '0 1px 3px rgba(26,10,38,0.06), 0 1px 2px rgba(26,10,38,0.04)',
  sm:  '0 4px 12px rgba(26,10,38,0.08), 0 2px 6px rgba(26,10,38,0.05)',
  md:  '0 8px 24px rgba(26,10,38,0.10), 0 4px 12px rgba(26,10,38,0.06)',
  lg:  '0 20px 48px rgba(26,10,38,0.14), 0 8px 24px rgba(26,10,38,0.08)',
  glow: (color: string) => `0 8px 32px ${color}55, 0 2px 8px ${color}33`,
  card: '0 2px 16px rgba(26,10,38,0.07), 0 1px 4px rgba(26,10,38,0.04)',
} as const;

// ── 枠線 (三重ボーダーセット) ─────────────────────────────
export const BORDER = {
  hairline: (color: string) => `1px solid ${color}18`,
  soft:     (color: string) => `1px solid ${color}30`,
  accent:   (color: string) => `1.5px solid ${color}60`,
  bold:     (color: string) => `2px solid ${color}`,
} as const;

// ── タイポグラフィスケール (9 段階) ──────────────────────
export const TYPE = {
  display: {
    fontSize: 'clamp(3rem, 7vw, 5.5rem)',
    fontWeight: 800,
    lineHeight: 1.02,
    letterSpacing: '-0.03em',
  },
  headline: {
    fontSize: 'clamp(2rem, 4.5vw, 3.2rem)',
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  title1: {
    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.015em',
  },
  title2: {
    fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
  },
  body1: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.75,
    letterSpacing: '0.005em',
  },
  body2: {
    fontSize: '0.9rem',
    fontWeight: 400,
    lineHeight: 1.7,
    letterSpacing: '0.005em',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0.05em',
  },
  caption: {
    fontSize: '0.72rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.06em',
  },
  overline: {
    fontSize: '0.65rem',
    fontWeight: 700,
    lineHeight: 1.4,
    letterSpacing: '0.25em',
    textTransform: 'uppercase' as const,
  },
} as const;

// ── アニメーションプリセット ─────────────────────────────
export const ANIM = {
  gentle: {
    duration: 0.55,
    ease: [0.25, 0.1, 0.25, 1] as [number,number,number,number],
  },
  luxe: {
    duration: 0.85,
    ease: [0.16, 1, 0.3, 1] as [number,number,number,number],
  },
  bouncy: {
    type: 'spring' as const,
    stiffness: 380,
    damping: 28,
  },
  cinematic: {
    duration: 1.2,
    ease: [0.76, 0, 0.24, 1] as [number,number,number,number],
  },
} as const;

// ── Framer Motion variants (fade-up + stagger) ───────────
export const FADE_UP = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...ANIM.luxe, delay: i * 0.08 },
  }),
};

export const FADE_IN = {
  hidden:  { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { ...ANIM.gentle, delay: i * 0.06 },
  }),
};

// ── グラデーション CTA (ホットピンク→パープル→ゴールド) ──
export const GRAD_CTA = 'linear-gradient(135deg, #E1306C 0%, #833AB4 50%, #FCB045 100%)';
export const GRAD_CTA_HOVER = 'linear-gradient(135deg, #FF4B81 0%, #9B4FD0 50%, #FFCA5A 100%)';
export const GRAD_EDITORIAL = 'linear-gradient(120deg, #FCB045 0%, #E1306C 45%, #833AB4 100%)';

// ── CTA ボタンの共通スタイルファクトリ ───────────────────
export function ctaStyle(opts?: { size?: 'sm' | 'md' | 'lg'; ghost?: boolean }): Record<string, string | number | undefined> {
  const size = opts?.size ?? 'md';
  const pad = { sm: '0.55rem 1.2rem', md: '0.9rem 2rem', lg: '1.1rem 2.5rem' }[size];
  const fs  = { sm: '0.85rem', md: '0.95rem', lg: '1.05rem' }[size];
  if (opts?.ghost) {
    return {
      background: 'rgba(255,255,255,0.06)',
      color: '#FFFAF5',
      border: '1.5px solid rgba(255,250,245,0.25)',
      padding: pad, fontSize: fs, fontWeight: 700,
      borderRadius: RADIUS.full, cursor: 'pointer',
      transition: 'all 0.2s',
    };
  }
  return {
    background: GRAD_CTA,
    backgroundSize: '200% 100%',
    color: '#fff',
    border: 'none',
    padding: pad, fontSize: fs, fontWeight: 800,
    borderRadius: RADIUS.full, cursor: 'pointer',
    boxShadow: '0 8px 28px rgba(225,48,108,0.45)',
    transition: 'all 0.2s',
    letterSpacing: '0.03em',
  };
}

export { IRIS_COLORS, IRIS_FONTS } from './irisStyle';
