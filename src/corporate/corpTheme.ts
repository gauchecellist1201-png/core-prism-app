// ============================================================
// corpTheme — /corp（CORE 法人サイト）の共通デザイントークン
//
// 2026-08-21: CoreSite.tsx の中だけに閉じていたフォント・章ラベル・CTA のスタイルを
// ここへ移した。新しい章が同じ見た目で並ぶための唯一の出どころ。
//
// 2026-09-02 全面改訂（オーナー指示「AIが作ったっぽい／決定打に欠ける」）:
//   旧: 金 × 黒 × 明朝（Cinzel / Noto Serif JP）＝ 高級テンプレに見え、
//       青/クロームの公式ロゴとも色が合っていなかった。
//   新: 深い紺黒 × 白 × アイスブルー（ロゴと同系）、書体は Noto Sans JP の太字と Inter。
//       「荘厳」ではなく「実在する、売れている技術会社」の顔にする。
//
//   定数名（FONT_SERIF_JA / GOLD など）は 300 か所以上から参照されているため
//   互換のために残し、中身だけを差し替えた。新規コードは下の新名（FONT_JA / ACCENT）を使う。
// ============================================================
import type { CSSProperties } from 'react';

// ── 書体 ──
/** 日本語の本文・見出し。太字（700〜900）を見出しに、400〜500 を本文に。 */
export const FONT_JA = '"Noto Sans JP", "Inter", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
/** 英字のキッカー・数字。 */
export const FONT_EN = '"Inter", "Noto Sans JP", "Helvetica Neue", Arial, sans-serif';

/** @deprecated 互換用。中身は FONT_EN */
export const FONT_DISPLAY = FONT_EN;
/** @deprecated 互換用。中身は FONT_JA（明朝ではなくなった） */
export const FONT_SERIF_JA = FONT_JA;
/** @deprecated 互換用。中身は FONT_EN */
export const FONT_SERIF_EN = FONT_EN;
export const FONT_SANS = FONT_JA;

// ── 色 ──
/** ロゴの青/クロームに合わせたアクセント。 */
export const ACCENT = '#38BDF8';
export const ACCENT_LIGHT = '#7DD3FC';
export const ACCENT_PALE = '#BAE6FD';
/** @deprecated 互換用（旧・金）。中身はアクセント青 */
export const GOLD = ACCENT_LIGHT;
export const GOLD_LIGHT = ACCENT_PALE;
export const GOLD_PALE = '#E0F2FE';

/** 地の色。純黒ではなく、ごくわずかに青みのある紺黒。 */
export const INK = '#070A10';
export const INK_2 = '#0B0F17';
export const INK_3 = '#101826';
export const PAPER = '#F3F6FB';

/** 本文の読める濃さ。0.4 台は AA 落第だったので 0.62 以上を既定にする。 */
export const TEXT_BODY = 'rgba(226,232,240,0.78)';
export const TEXT_MUTED = 'rgba(226,232,240,0.62)';
export const LINE = 'rgba(148,163,184,0.18)';
export const LINE_STRONG = 'rgba(148,163,184,0.32)';

export const navLink: CSSProperties = {
  fontFamily: FONT_JA,
  fontSize: '0.86rem',
  color: 'rgba(226,232,240,0.8)',
  textDecoration: 'none',
  fontWeight: 500,
  letterSpacing: '0.04em',
};

export const ctaSmall: CSSProperties = {
  fontFamily: FONT_JA,
  fontSize: '0.84rem',
  fontWeight: 700,
  color: '#0B1220',
  textDecoration: 'none',
  padding: '0.7rem 1.2rem',
  border: '1px solid rgba(255,255,255,0.9)',
  background: '#FFFFFF',
  borderRadius: 999,
  letterSpacing: '0.04em',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
};

/** 主 CTA。白〜アイスブルーの面。金の面は廃止。 */
export const ctaHero: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg,#FFFFFF 0%,#E8F4FF 55%,#BAE6FD 100%)',
  color: '#0B1220',
  padding: '1rem 2.2rem',
  minHeight: 54,
  borderRadius: 999,
  fontFamily: FONT_JA,
  fontSize: '1rem',
  fontWeight: 800,
  textDecoration: 'none',
  boxShadow: '0 16px 40px -12px rgba(56,189,248,0.45)',
  letterSpacing: '0.04em',
};

/** 主 CTA の隣に置く控えめな第二 CTA。輪郭だけ。 */
export const ctaGhost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 54,
  padding: '0 2rem',
  borderRadius: 999,
  fontFamily: FONT_JA,
  fontSize: '0.95rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: '#F3F6FB',
  textDecoration: 'none',
  border: '1px solid rgba(226,232,240,0.35)',
  background: 'rgba(255,255,255,0.04)',
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
  fontFamily: FONT_JA,
  fontSize: '0.9rem',
  letterSpacing: '0.3em',
  color: 'rgba(226,232,240,0.92)',
  fontWeight: 700,
};

export const sectionLabelSub: CSSProperties = {
  fontFamily: FONT_EN,
  fontSize: '0.68rem',
  letterSpacing: '0.3em',
  color: ACCENT_LIGHT,
  fontWeight: 600,
  textTransform: 'uppercase',
};

/** 章の大見出し。全章で同じ大きさ・行間にするために共有する。 */
export const sectionH2: CSSProperties = {
  fontFamily: FONT_JA,
  fontSize: 'clamp(1.9rem, 3.8vw, 2.9rem)',
  fontWeight: 800,
  lineHeight: 1.4,
  letterSpacing: '-0.005em',
  marginBottom: '1.25rem',
  color: PAPER,
};

/** 章のリード文。 */
export const sectionLead: CSSProperties = {
  fontFamily: FONT_JA,
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

/** 静かなカード。細い線と、ほとんど無色の面。 */
export const quietCard: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
  border: `1px solid ${LINE}`,
  borderRadius: 18,
  padding: 'clamp(1.5rem, 2.6vw, 2.1rem)',
};

/** 番号（01 / 02 …）。Inter のアクセント色。 */
export const stepNumber: CSSProperties = {
  fontFamily: FONT_EN,
  fontSize: '0.82rem',
  letterSpacing: '0.2em',
  color: ACCENT,
  fontWeight: 700,
};

/** 章に共通の現れ方。1秒未満の派手な演出は使わない（静かに、ゆっくり）。 */
export const reveal = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
};
