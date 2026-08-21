// ============================================================
// corpTheme — /corp（CORE 法人サイト）の共通デザイントークン
//
// 2026-08-21: AI Transformation Company への再定義にあたり、
// CoreSite.tsx の中だけに閉じていたフォント・章ラベル・CTA のスタイルを
// ここへ移した。新しい章（What We Do / AI COMPANY OS / 診断 など）が
// 同じ見た目で並ぶための唯一の出どころ。値は既存サイトのまま変えていない。
// ============================================================
import type { CSSProperties } from 'react';

// ── 荘厳系フォント（既存のまま） ──
export const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
export const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", "Yu Mincho", serif';
export const FONT_SERIF_EN = '"EB Garamond", "Cormorant Garamond", "Noto Serif JP", serif';
export const FONT_SANS = '"Noto Sans JP", "Inter", "游ゴシック", sans-serif';

// ── 金×黒（既存のまま） ──
export const GOLD = '#C9A96E';
export const GOLD_LIGHT = '#E7C987';
export const GOLD_PALE = '#F1DCA7';
export const INK = '#050505';
export const PAPER = '#F1E9D8';

/** 本文の読める濃さ。0.4 台は AA 落第だったので 0.62 以上を既定にする。 */
export const TEXT_BODY = 'rgba(240,233,216,0.72)';
export const TEXT_MUTED = 'rgba(240,233,216,0.62)';

export const navLink: CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  fontSize: '0.88rem',
  color: 'rgba(244,239,228,0.78)',
  textDecoration: 'none',
  fontWeight: 500,
  letterSpacing: '0.1em',
};

export const ctaSmall: CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  fontSize: '0.85rem',
  fontWeight: 600,
  color: GOLD_LIGHT,
  textDecoration: 'none',
  padding: '0.75rem 1.25rem',
  border: '1px solid rgba(201,169,110,0.55)',
  background: 'rgba(201,169,110,0.07)',
  borderRadius: 999,
  letterSpacing: '0.1em',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
};

export const ctaHero: CSSProperties = {
  display: 'inline-block',
  background: 'linear-gradient(135deg,#F1DCA7,#E7C987 45%,#C9A96E)',
  backgroundSize: '200% 100%',
  color: '#14100a',
  padding: '1.1rem 2.4rem',
  borderRadius: 999,
  fontFamily: FONT_SERIF_JA,
  fontSize: '1rem',
  fontWeight: 800,
  textDecoration: 'none',
  boxShadow: '0 14px 42px -8px rgba(201,169,110,0.55)',
  letterSpacing: '0.12em',
};

/** 主 CTA の隣に置く控えめな第二 CTA。輪郭だけで、金の面は持たない。 */
export const ctaGhost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 52,
  padding: '0 2rem',
  borderRadius: 999,
  fontFamily: FONT_SERIF_JA,
  fontSize: '0.95rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  color: '#F1E6CE',
  textDecoration: 'none',
  border: '1px solid rgba(201,169,110,0.5)',
  background: 'rgba(201,169,110,0.06)',
  cursor: 'pointer',
};

export const sectionLabel: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  marginBottom: '1.25rem',
};

export const sectionLabelMain: CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  fontSize: '0.95rem',
  letterSpacing: '0.4em',
  color: 'rgba(240,233,216,0.92)',
  fontWeight: 700,
};

export const sectionLabelSub: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: '0.65rem',
  letterSpacing: '0.45em',
  color: 'rgba(201,169,110,0.85)',
  fontWeight: 600,
};

/** 章の大見出し。全章で同じ大きさ・行間にするために共有する。 */
export const sectionH2: CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  fontSize: 'clamp(1.85rem, 3.8vw, 2.85rem)',
  fontWeight: 700,
  lineHeight: 1.5,
  letterSpacing: '0.04em',
  marginBottom: '1.25rem',
};

/** 章のリード文。 */
export const sectionLead: CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  color: TEXT_BODY,
  fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)',
  maxWidth: 700,
  margin: '0 auto',
  lineHeight: 2,
  fontWeight: 400,
};

/** 章の外枠。padding は .lp-section-pad がモバイルで上書きする。 */
export const sectionPad: CSSProperties = {
  padding: '7rem 1.5rem',
};

/** 静かなカード。金の細い輪郭と、ほとんど無色の面。 */
export const quietCard: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))',
  border: '1px solid rgba(201,169,110,0.2)',
  borderRadius: 20,
  padding: 'clamp(1.5rem, 2.6vw, 2.1rem)',
};

/** 番号（01 / 02 …）。Cinzel の金。 */
export const stepNumber: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: '0.82rem',
  letterSpacing: '0.28em',
  color: GOLD,
  fontWeight: 700,
};

/** 章に共通の現れ方。1秒未満の派手な演出は使わない（静かに、ゆっくり）。 */
export const reveal = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
};
