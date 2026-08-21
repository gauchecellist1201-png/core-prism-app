// ============================================================
// CORE Studio — 共通の見出し / 帯 / ラインアイコン
// 配色とフォントは theme.ts
// ============================================================
import type { ReactNode } from 'react';
import { C, D } from './theme';

// ---- セクション帯 (白 / #F7F7F5 / 暗部) ----
export const Band = ({ alt, dark, children, pad = '52px 0', id }: {
  alt?: boolean; dark?: boolean; children: ReactNode; pad?: string; id?: string;
}) => (
  <section id={id} style={{ background: dark ? D.bg : alt ? C.alt : C.bg, padding: pad, scrollMarginTop: id ? 96 : undefined }}>
    <div className="st-inner">{children}</div>
  </section>
);

// ---- 共通見出し (英字ラベル + 明朝見出し + 補足) ----
export const H2 = ({ children, en, sub, dark }: {
  children: ReactNode; en?: string; sub?: string; dark?: boolean;
}) => (
  <div style={{ margin: '0 0 26px' }}>
    {en && <div className="st-label" style={{ marginBottom: 10, color: dark ? D.gold : C.goldText }}>{en}</div>}
    <h2 className="st-serif" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.03em', color: dark ? D.ink : C.ink, margin: 0 }}>{children}</h2>
    {sub && <p style={{ fontSize: 14, color: dark ? D.body : C.body, margin: '10px 0 0', lineHeight: 2 }}>{sub}</p>}
  </div>
);

// ---- CTA下の実務的な添え書き ----
export const Note = ({ children, dark }: { children: ReactNode; dark?: boolean }) => (
  <p style={{ fontSize: 12.5, color: dark ? D.mute : C.mute, margin: '12px 0 0', textAlign: 'center', letterSpacing: '0.03em' }}>{children}</p>
);

// ---- 小さなラインアイコン (絵文字禁止・SVGのみ) ----
export const IconCheck = ({ color = C.gold }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 4 }}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const IconArrow = ({ color = 'currentColor' }: { color?: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

export const IconMail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" />
  </svg>
);

// 吹き出しの線画。LINE のロゴは使用規約があるため模倣せず、意味だけを線で表す。
export const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
