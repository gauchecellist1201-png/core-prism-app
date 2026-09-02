// ============================================================
// CORE Studio — 共通の見出し / 帯 / ラインアイコン
// 配色とフォントは theme.ts
// ============================================================
import { useEffect, useRef, type ReactNode } from 'react';
import { C, D } from './theme';

// ---- セクション帯 (白 / #F7F7F5 / 暗部) ----
// 2026-08-31: 既定でスクロール入場 (Reveal) を掛ける。章がひとつずつ立ち上がるので、
// 20画面ある1枚ものが「終わらない本文」ではなく「章のある読み物」になる。
// 演出を入れたくない帯 (中身が自前で動く等) だけ flat を渡す。
export const Band = ({ alt, dark, children, pad = '52px 0', id, flat, wide }: {
  alt?: boolean; dark?: boolean; children: ReactNode; pad?: string; id?: string; flat?: boolean;
  /** ホームの章だけ 1160px まで広げる (本文中心のタブは 760px の1段組のまま) */
  wide?: boolean;
}) => (
  // 固定ヘッダーの下に見出しが潜らないよう、アンカー着地位置を下げる
  <section id={id} style={{ background: dark ? D.bg : alt ? C.alt : C.bg, padding: pad, scrollMarginTop: id ? 96 : undefined }}>

    <div className={wide ? 'st-inner st-wide' : 'st-inner'}>{flat ? children : <Reveal>{children}</Reveal>}</div>
  </section>
);

// ---- 共通見出し (英字ラベル + 明朝見出し + 補足) ----
// 2026-08-31: 英字ラベルの頭に金の短い線を足し、見出しの上限を 24px から広げた。
// 章の頭がどれも同じ大きさの黒い1行だと、20画面ある1枚ものが「延々と続く本文」に見える。
// 線は章の始まりの合図で、幅が変わるのは Reveal が入った後 (CSS の st-h2-rule)。
export const H2 = ({ children, en, sub, dark }: {
  children: ReactNode; en?: string; sub?: string; dark?: boolean;
}) => (
  <div style={{ margin: '0 0 26px' }}>
    {en && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
        <span className="st-h2-rule" style={{ background: dark ? D.gold : C.gold }} aria-hidden />
        <span className="st-label" style={{ color: dark ? D.gold : C.goldText }}>{en}</span>
      </div>
    )}
    <h2 className="st-serif" style={{ fontSize: 'clamp(23px, 5.6vw, 34px)', fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.03em', color: dark ? D.ink : C.ink, margin: 0 }}>{children}</h2>
    {sub && <p style={{ fontSize: 14, color: dark ? D.body : C.body, margin: '12px 0 0', lineHeight: 2, maxWidth: 620 }}>{sub}</p>}
  </div>
);

// ---- スクロールで現れる箱 ----
// StudioSite / FilmTab で同じものを使う。
//
// 守ること (2026-08-31 実測で作り直した):
//  1. 最初から画面内にあるものは、演出しない。
//     opacity:0 から始めると、その瞬間に読めるはずの文字が読めなくなる。
//     実測: お問い合わせタブは本文がまるごと1つの Reveal なので、
//     画面内でも pending のままだと、ページ全体が2秒以上ぼやけたまま出ない。
//     最大要素の描画 (LCP) も同じだけ遅れる。動かすのは「これから入ってくる」ものだけ。
//  2. それでも pending にした分には、時間切れで必ず出す逃げ道を残すこと。
//     IntersectionObserver は「ページが隠れている間」は発火しない
//     (内蔵ブラウザは document.hidden が常に true。実測で確認済み)。
//     演出のために本文を失ってはいけない。
export const Reveal = ({ children, delay = 0, className }: {
  children: ReactNode; delay?: number; className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') return;

    // すでに画面に入っているものは、そのまま出す (上記 1.)
    const vh = window.innerHeight || 0;
    if (el.getBoundingClientRect().top < vh * 0.92) return;

    el.dataset.rv = 'pending';
    const show = () => { el.dataset.rv = 'in'; };
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { show(); io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);

    const safety = window.setTimeout(() => { show(); io.disconnect(); }, 1500);
    return () => { window.clearTimeout(safety); io.disconnect(); };
  }, []);

  return (
    <div ref={ref} className={className ? `st-rv ${className}` : 'st-rv'} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

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
