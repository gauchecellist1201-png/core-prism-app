// ============================================================
// CORE Iris — 拡張デザインシステム
// Pinterest / Vogue / Notion 参考。「見ていてうっとりする」水準。
// ============================================================

// ── 8pt グリッド スペーススケール ───────────────────────────
export const IRIS_SPACE = {
  '1': '0.5rem',   // 8px
  '2': '1rem',     // 16px
  '3': '1.5rem',   // 24px
  '4': '2rem',     // 32px
  '5': '2.5rem',   // 40px
  '6': '3rem',     // 48px
  '8': '4rem',     // 64px
  '10': '5rem',    // 80px
  '12': '6rem',    // 96px
} as const;

// ── 角丸トークン ─────────────────────────────────────────────
export const IRIS_RADIUS = {
  sm:   '8px',
  md:   '12px',
  lg:   '18px',
  xl:   '24px',
  '2xl':'36px',
  full: '9999px',
} as const;

// ── 影 (4 レベル) ─────────────────────────────────────────────
export const IRIS_SHADOW = {
  sm:     '0 1px 4px rgba(31,26,46,0.06)',
  md:     '0 4px 16px rgba(31,26,46,0.10)',
  lg:     '0 8px 32px rgba(31,26,46,0.14)',
  xl:     '0 20px 60px rgba(31,26,46,0.18)',
  glow:   (color: string) => `0 8px 32px ${color}55, 0 2px 8px ${color}33`,
  card:   '0 2px 12px rgba(31,26,46,0.08), 0 0 0 1px rgba(31,26,46,0.04)',
} as const;

// ── 三重枠線 ─────────────────────────────────────────────────
export const IRIS_BORDER = {
  thin:   (color: string) => `1px solid ${color}`,
  mid:    (color: string) => `1.5px solid ${color}`,
  thick:  (color: string) => `2px solid ${color}`,
} as const;

// ── タイポグラフィ (9 スケール) ───────────────────────────────
export const IRIS_TYPE = {
  display: {
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontFamily: '"Playfair Display", "Bodoni Moda", "Noto Serif JP", serif',
    fontStyle: 'italic' as const,
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  hero: {
    fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
    fontFamily: '"Playfair Display", "Noto Serif JP", serif',
    fontStyle: 'italic' as const,
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: '-0.015em',
  },
  headline: {
    fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
    fontFamily: '"Cormorant Garamond", "Playfair Display", "Noto Serif JP", serif',
    fontStyle: 'italic' as const,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },
  subhead: {
    fontSize: '1.1rem',
    fontFamily: '"Cormorant Garamond", "Noto Serif JP", serif',
    fontStyle: 'italic' as const,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '0.01em',
  },
  lead: {
    fontSize: '1rem',
    fontFamily: '"Inter", "Noto Sans JP", sans-serif',
    fontStyle: 'normal' as const,
    fontWeight: 500,
    lineHeight: 1.6,
    letterSpacing: '0.005em',
  },
  body: {
    fontSize: '0.9rem',
    fontFamily: '"Inter", "Noto Sans JP", sans-serif',
    fontStyle: 'normal' as const,
    fontWeight: 400,
    lineHeight: 1.7,
    letterSpacing: '0.01em',
  },
  small: {
    fontSize: '0.82rem',
    fontFamily: '"Inter", "Noto Sans JP", sans-serif',
    fontStyle: 'normal' as const,
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: '0.01em',
  },
  label: {
    fontSize: '0.7rem',
    fontFamily: '"Inter", "Noto Sans JP", sans-serif',
    fontStyle: 'normal' as const,
    fontWeight: 700,
    lineHeight: 1.4,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontSize: '0.65rem',
    fontFamily: '"Inter", "Noto Sans JP", sans-serif',
    fontStyle: 'normal' as const,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0.04em',
  },
} as const;

// ── アニメーションプリセット ──────────────────────────────────
export const IRIS_MOTION = {
  gentle: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: -6 },
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
  luxe: {
    initial: { opacity: 0, y: 24, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit:    { opacity: 0, scale: 0.98 },
    transition: { duration: 0.55, ease: 'easeOut' as const },
  },
  bouncy: {
    initial: { opacity: 0, scale: 0.88 },
    animate: { opacity: 1, scale: 1 },
    exit:    { opacity: 0, scale: 0.94 },
    transition: { type: 'spring' as const, stiffness: 400, damping: 28 },
  },
  cinematic: {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0 },
    transition: { duration: 0.7, ease: 'easeOut' as const },
  },
  stagger: (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.06, duration: 0.45, ease: 'easeOut' as const },
  }),
} as const;

// ── ボタン & CTA グラデーション ────────────────────────────────
export const IRIS_GRADIENT = {
  /** ホットピンク → パープル → ゴールド (メイン CTA) */
  cta:      'linear-gradient(135deg, #E1306C 0%, #833AB4 50%, #FCB045 100%)',
  ctaHover: 'linear-gradient(135deg, #D11F5F 0%, #722D9E 50%, #E8A035 100%)',

  /** Instagram 公式 */
  instagram: 'linear-gradient(135deg, #833AB4, #FD1D1D 50%, #FCB045)',

  /** ソフト ピンク (カード・背景用) */
  pink:  'linear-gradient(135deg, #FFE5EE, #FFD4E5)',
  peach: 'linear-gradient(135deg, #FFE5DC, #FFECD6)',
  lilac: 'linear-gradient(135deg, #F3E8FF, #EEE1FF)',

  /** エディトリアル ダーク */
  dark:  'linear-gradient(135deg, #1A0A26, #2D1A42)',
} as const;

// ── サイドバー幅 ───────────────────────────────────────────────
export const IRIS_SIDEBAR_W = 220;
export const IRIS_DOCK_H    = 64;
