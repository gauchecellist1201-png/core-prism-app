// ============================================================
// CORE Studio — 映像制作タブ (/studio#film)
// 白基調のスタジオサイトの中で、映像の章だけを暗部に落とす編集構成。
// ヒーロー / ショーケース / 思想 / 最終CTA = 暗、料金・工程・制作物 = 白。
// 文言・価格は film.ts に集約。ここにはレイアウトと導線だけを書く。
// ============================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { C, D, SERIF, SANS } from './theme';
import { Band, H2, Note, IconCheck, IconChat, IconCopy } from './ui';
import { STUDIO, CONTACT } from './plans';
import {
  FILM, FILM_PLANS, MONTHLY_LEAD, MONTHLY_PLANS, MONTHLY_TERMS, PRICE_NOTE, PRICE_WHY,
  FILM_WORKS, REVISION, TERMS, AI_TERMS,
  FILM_FAQ, FILM_CTA, INQUIRY_FIELDS,
} from './film';
import { logEvent } from '../lib/onboardingAnalytics';

// ---- 計測 (既存の core_events_v1 に載せる。外部サービスは追加しない) ----
const track = (event: string, props?: Record<string, unknown>) => logEvent(event, props);

// 遠い行き先へ smooth を指定するとブラウザが移動そのものを諦め、押しても何も起きない
// (実測: ヒーローから 10,700px 下の相談欄へ smooth 指定 → scrollY が 0 のまま)。
// index.css に html { scroll-behavior: smooth } があるため 'auto' も smooth に化ける。
// 距離が離れている時は 'instant' を明示して即時ジャンプさせる。
const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 80;
  const far = Math.abs(top - window.scrollY) > 2000;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top, behavior: far || reduced ? 'instant' : 'smooth' });
};

// ============================================================
export default function FilmTab() {
  useScrollDepth();

  return (
    <div>
      <style>{`
        .fm-rv { transition: opacity 620ms ease, transform 620ms ease; }
        .fm-rv[data-rv="pending"] { opacity: 0; transform: translateY(14px); }
        .fm-rv[data-rv="in"] { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          .fm-rv, .fm-rv[data-rv="pending"] { opacity: 1 !important; transform: none !important; transition: none; }
        }
        .fm-scroller { display: flex; justify-content: safe center; gap: 14px; overflow-x: auto; -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory; padding: 4px 20px 18px; scrollbar-width: none; }
        .fm-scroller::-webkit-scrollbar { display: none; }
        .fm-shot { flex: 0 0 auto; width: min(74vw, 268px); scroll-snap-align: center; }
        @media (min-width: 900px) { .fm-shot { width: 232px; } }
        .fm-frame { position: relative; width: 100%; border-radius: 12px; overflow: hidden;
          border: 1px solid ${D.line};
          background:
            radial-gradient(120% 62% at 28% 16%, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0) 62%),
            linear-gradient(160deg, #1e1e23 0%, #101013 58%, #0c0c0f 100%); }
        /* 粒子。装飾なので必ずタップを透過させる */
        .fm-frame::after { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.16'/%3E%3C/svg%3E"); }
        .fm-frame img, .fm-frame video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .fm-grid3 { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 700px) { .fm-grid3 { grid-template-columns: repeat(3, 1fr); } }
        .fm-tag { display: inline-flex; align-items: center; min-height: 34px; padding: 6px 13px; border-radius: 999px;
          border: 1px solid ${D.goldLine}; color: ${D.gold}; font-size: 12.5px; letter-spacing: 0.06em; }
        .fm-btn-light { background: #06C755; color: ${C.ink}; border: 1px solid #06C755; }
        .fm-btn-light:hover { opacity: 0.86; }
        .fm-btn-outline { background: transparent; color: #FFFFFF; border: 1px solid rgba(255,255,255,0.5); font-weight: 600; }
        .fm-btn-outline:hover { border-color: ${D.gold}; }
        .fm-rule { border: none; border-top: 1px solid ${C.line}; margin: 0; }
        .fm-reassure { display: flex; gap: 10px; flex-wrap: wrap; }
        .fm-reassure-item { font-size: 12px; color: ${D.mute}; display: inline-flex; align-items: center; gap: 6px; }
        .fm-why-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 700px) { .fm-why-grid { grid-template-columns: repeat(3, 1fr); } }
        .fm-audience-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 700px) { .fm-audience-grid { grid-template-columns: repeat(3, 1fr); } }
        .fm-decision-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 640px) { .fm-decision-grid { grid-template-columns: repeat(2, 1fr); } }
        .fm-works-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 700px) { .fm-works-grid { grid-template-columns: repeat(3, 1fr); } }
        .fm-faq-item { border-top: 1px solid ${C.line}; }
        .fm-faq-btn { width: 100%; min-height: 52px; background: none; border: none; cursor: pointer; text-align: left;
          padding: 14px 2px; font-size: 14px; font-weight: 600; color: ${C.ink}; font-family: ${SANS};
          display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        /* 章の目次。長い1枚ものを上から順に読ませない (法人は必要な章だけ見る) */
        .fm-nav { display: flex; gap: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch;
          scrollbar-width: none; padding: 2px 20px 0; }
        .fm-nav::-webkit-scrollbar { display: none; }
        .fm-nav-item { flex: 0 0 auto; min-height: 40px; display: inline-flex; align-items: center; padding: 9px 14px;
          border-radius: 999px; border: 1px solid ${D.line}; background: transparent; cursor: pointer;
          color: ${D.body}; font-size: 12.5px; font-family: ${SANS}; letter-spacing: 0.04em; white-space: nowrap;
          transition: border-color 140ms ease, color 140ms ease; }
        .fm-nav-item:hover { border-color: ${D.goldLine}; color: ${D.ink}; }
        /* 想定顧客・選び方の圧縮グリッド (1行1件の縦積みをやめる) */
        .fm-chip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        @media (min-width: 640px) { .fm-chip-grid { grid-template-columns: repeat(3, 1fr); } }
        .fm-terms-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 700px) { .fm-terms-grid { grid-template-columns: 1fr 1fr; } }
        /* ヒーロー直下の数字バー。375pxで2列、広い画面で4列。
           1列に落とすと4行=約210pxを食い、CTAが1画面目から押し出される */
        .fm-proof { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: ${D.line};
          border: 1px solid ${D.line}; border-radius: 12px; overflow: hidden; }
        @media (min-width: 700px) { .fm-proof { grid-template-columns: repeat(4, 1fr); } }
        .fm-proof-item { background: ${D.bg}; padding: 14px 14px 13px; }
        .fm-proof-value { font-size: 19px; font-weight: 700; color: ${D.gold}; line-height: 1.35; letter-spacing: 0.01em; }
        .fm-proof-label { font-size: 11px; color: ${D.mute}; line-height: 1.6; margin-top: 5px; letter-spacing: 0.02em; }
        /* 相場との対比表。狭い画面では表を横に潰さず、1件=1ブロックの縦積みに切り替える
           (3列を375pxに押し込むと各セルが5〜6行に折れて読めなくなる) */
        .fm-cmp { display: grid; gap: 10px; }
        .fm-cmp-row { border: 1px solid ${C.line}; border-radius: 10px; background: #FFFFFF; overflow: hidden; }
        .fm-cmp-row[data-hl="1"] { border-color: ${C.goldLine}; }
        .fm-cmp-item { font-size: 12.5px; font-weight: 700; color: ${C.ink}; line-height: 1.6;
          padding: 11px 14px; background: ${C.alt}; border-bottom: 1px solid ${C.line}; }
        .fm-cmp-vals { display: grid; grid-template-columns: 1fr 1fr; }
        .fm-cmp-val { padding: 11px 14px; font-size: 12.5px; line-height: 1.7; }
        .fm-cmp-val + .fm-cmp-val { border-left: 1px solid ${C.line}; }
        .fm-cmp-cap { display: block; font-size: 10px; letter-spacing: 0.1em; color: ${C.mute};
          margin-bottom: 4px; font-weight: 600; }
        /* 月額に切り替えた場合の差額。3列 (単発合計 / 月額 / 差額) */
        .fm-save { display: grid; gap: 10px; }
        @media (min-width: 700px) { .fm-save { grid-template-columns: repeat(3, 1fr); } }
        /* ヒーロー = 縦型の映像そのもの。文字は一切かぶせず、映像の下に置く
           (2026-08-22 オーナー指示「映像をドーンと出し、文字はその下」)。
           素材は 1080x1920 の縦型。切り抜くと画の大半が捨てられるので、
           スマホでは画面幅いっぱい × 9:16 をそのまま出す (crop 0)。
           1画面目からはみ出すぶんは、常時出ている固定下部CTAで受ける。 */
        .fm-hero { position: relative; width: 100%; background: #000;
          display: flex; justify-content: center; }
        .fm-hero-frame { position: relative; width: 100%; aspect-ratio: 9 / 16;
          overflow: hidden; background: #000; }
        /* 広い画面では縦型のまま中央に立てる (横に引き伸ばさない) */
        @media (min-width: 700px) {
          .fm-hero-frame { width: auto; height: min(calc(100dvh - 150px), 760px); }
        }
        .fm-hero video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        /* 自動再生が拒否された端末 (低電力モード等) では静止画のまま何も起きないので、
           停止中だけ再生ボタンを出す */
        .fm-hero-play { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          width: 76px; height: 76px; border-radius: 999px; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.5); background: rgba(11,11,12,0.55);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          color: #FFFFFF; display: flex; align-items: center; justify-content: center; }
        .fm-hero-label { margin: 0 0 12px; }
        .fm-hero-h1 { font-size: clamp(27px, 7.4vw, 44px); font-weight: 700; line-height: 1.45;
          letter-spacing: 0.02em; margin: 0; color: #FFFFFF; }
        .fm-hero-sub { font-size: 13.5px; line-height: 1.95; color: ${D.body}; margin: 12px 0 0; max-width: 560px; }
        /* 音の切り替え。映像の上、右上の角 (顔にかぶらない位置) */
        .fm-hero-sound { position: absolute; top: 14px; right: 16px; min-height: 44px; padding: 10px 16px;
          border-radius: 999px; cursor: pointer; border: 1px solid rgba(255,255,255,0.34);
          background: rgba(11,11,12,0.52); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          color: #FFFFFF; font-family: ${SANS}; font-size: 12px; letter-spacing: 0.04em; }
        .fm-hero-sound:hover { border-color: ${D.gold}; color: ${D.gold}; }
        .fm-hero-note { font-size: 12px; color: ${D.mute}; letter-spacing: 0.02em; margin: 16px 0 0; line-height: 1.8; }
        .fm-sticky-cta { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: none;
          padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: rgba(11,11,12,0.92);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-top: 1px solid ${D.line}; }
        @media (max-width: 767px) { .fm-sticky-cta { display: block; } .fm-sticky-pad { height: 68px; } }
      `}</style>

      {/* 章の並び (2026-08-21 再改編)。
          「情報が多すぎて縦に長く、煩雑」というオーナー指摘を受け、動画1本で伝わる訴求を
          文章で重複説明していた章 (Showcase/Bridge/WhyCore/Comparison/Process/Featured/
          ChooseGuide/Philosophy) を撤去。ヒーロー動画 → 実績 → 料金 → 条件・FAQ (折りたたみ)
          → 相談、の最短構成にした。ShowcaseがWorksと同じ素材を「参考例」として重複表示していた
          点はオーナー指摘 (「2つが被っていて気持ち悪い」) so 削除して解消している。 */}
      <FilmHero />
      <SectionNav />
      <Pricing />
      <FilmWorks />
      <Terms />
      <Faq />
      <div className="fm-sticky-pad" />
      <FinalCta />
      <MobileStickyCta />
    </div>
  );
}

// ---- スクロール深度 (25/50/75/100%) ----
function useScrollDepth() {
  useEffect(() => {
    const hit = new Set<number>();
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.round((window.scrollY / max) * 100);
      for (const mark of [25, 50, 75, 100]) {
        if (pct >= mark && !hit.has(mark)) {
          hit.add(mark);
          track('studio_film_scroll_depth', { depth: mark });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
}

// ---- スクロール出現 ----
// 背面タブでは IntersectionObserver が発火せず opacity:0 のまま固まるため、
// 安全網として一定時間後に必ず全部出す。JS が無い/動かない場合は最初から見えている。
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') return;

    el.dataset.rv = 'pending';
    const show = () => { el.dataset.rv = 'in'; };
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { show(); io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);

    const safety = window.setTimeout(() => { show(); io.disconnect(); }, 2600);
    return () => { window.clearTimeout(safety); io.disconnect(); };
  }, []);

  return <div ref={ref} className="fm-rv" style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

// ---- スマホ専用の固定下部CTA。最終CTAセクション (id=film-inquiry) に入ったら隠す
// (常時表示だと、そこにある本来のLINEボタン・相談フォームの入力欄に重なるため) ----
function MobileStickyCta() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById('film-inquiry');
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) setHidden(e.isIntersecting);
    }, { rootMargin: '0px' });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  if (hidden) return null;

  return (
    <div className="fm-sticky-cta">
      <a className="st-btn fm-btn-light" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
        style={{ width: '100%', boxSizing: 'border-box', minHeight: 46, padding: '11px 20px' }}
        onClick={() => track('studio_film_sticky_cta', { to: 'line' })}>
        <IconChat /> {CONTACT.lineLabel}
      </a>
    </div>
  );
}

// ============================================================
// ヒーローの映像。ページの最初に置く「これを作ります」の実物。
// 音は既定で切る (自動再生の条件であり、無音でないと再生自体が拒否される)。
// 自動再生は端末側の事情 (低電力モード/データセーバー/背面タブ) で普通に拒否される。
// その時に何も起きない静止画で終わらせないため、停止中は必ず再生ボタンを出す。
// ============================================================
function FilmHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    setMuted(next);
    if (!next) void v.play().catch(() => {});
    track('studio_film_hero_reel_sound', { muted: next });
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    const wasPaused = v.paused;
    if (wasPaused) void v.play().catch(() => {});
    else v.pause();
    track('studio_film_hero_reel_play', { play: wasPaused });
  };

  return (
    <section style={{ background: D.bg, paddingBottom: 44 }}>
      {/* 映像そのものがヒーロー。文字は重ねず、下の帯に置く。
          素材は縦型なので、切り抜かずに画面幅いっぱいの 9:16 で出す。 */}
      <div className="fm-hero">
        <div className="fm-hero-frame">
          <video
            ref={videoRef}
            src="/studio/film/hero-reel.mp4"
            poster="/studio/film/hero-reel-poster.jpg"
            autoPlay muted loop playsInline preload="metadata"
            aria-label="CORE Studio が制作した映像"
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            onLoadedData={e => setPaused(e.currentTarget.paused)}
          />
          {paused && (
            <button type="button" className="fm-hero-play" onClick={togglePlay} aria-label="映像を再生する">
              <svg width="26" height="30" viewBox="0 0 26 30" aria-hidden="true">
                <path d="M2 2 L24 15 L2 28 Z" fill="currentColor" />
              </svg>
            </button>
          )}
          <button type="button" className="fm-hero-sound" onClick={toggleSound} aria-pressed={!muted}>
            {muted ? '音を出す' : '音を消す'}
          </button>
        </div>
      </div>

      <div className="st-inner" style={{ paddingTop: 30 }}>
        <div className="st-label fm-hero-label" style={{ color: D.gold }}>{FILM.label}</div>
        <h1 className="st-serif fm-hero-h1" style={{ whiteSpace: 'pre-line' }}>{FILM.hero}</h1>
        <p className="fm-hero-sub">{FILM.heroSub}</p>
        <p className="fm-hero-note">この映像はすべてAIで制作しました。撮影はしていません。</p>

        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          <a className="st-btn fm-btn-light" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => track('studio_film_hero_cta', { to: 'line' })}>
            <IconChat /> {FILM.heroCta}
          </a>
          <button className="st-btn fm-btn-outline" onClick={() => { track('studio_film_hero_cta', { to: 'pricing' }); scrollToId('film-pricing'); }}>
            {FILM.heroCtaSub}
          </button>
        </div>

        <Reveal>
          {/* 確かめられる数字だけ。ページ内で裏が取れないものは置かない */}
          <div className="fm-proof" style={{ marginTop: 26 }}>
            {FILM.proof.map(p => (
              <div key={p.label} className="fm-proof-item">
                <div className="st-serif fm-proof-value">{p.value}</div>
                <div className="fm-proof-label">{p.label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${D.line}` }}>
            <div style={{ display: 'flex', gap: '8px 18px', flexWrap: 'wrap' }}>
              {FILM.heroTrust.map(t => (
                <span key={t} style={{ fontSize: 11.5, color: D.mute, display: 'inline-flex', alignItems: 'center', gap: 6, letterSpacing: '0.02em' }}>
                  <IconCheck color={D.goldLine} />{t}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ============================================================
// 章の目次 — 20画面近い1枚ものを、必要な章から読めるようにする
// ============================================================
const NAV_ITEMS: Array<{ id: string; label: string }> = [
  { id: 'film-pricing', label: '料金' },
  { id: 'film-works', label: '制作実績' },
  { id: 'film-terms', label: 'お取引の条件' },
  { id: 'film-faq', label: 'よくある質問' },
];

function SectionNav() {
  return (
    <nav aria-label="このページの目次" style={{ background: D.bg, paddingBottom: 30 }}>
      <div className="fm-nav">
        {NAV_ITEMS.map(n => (
          <button key={n.id} type="button" className="fm-nav-item"
            onClick={() => { track('studio_film_nav', { to: n.id }); scrollToId(n.id); }}>
            {n.label}
          </button>
        ))}
      </div>
    </nav>
  );
}


// ============================================================
// 情緒のビート — 映像を見た直後、料金の話に入る前に一度だけ置く
// ============================================================
// ============================================================
// なぜ CORE Studio か — AI × STORY × CREATIVE
// ============================================================
// ============================================================
// 費用の構造 — 「お得かどうか」を読む人に計算させない章。
//
// 料金表の直前に置く。価格を裸で見せる前に、
//   (1) 相場との差 → (2) その差が生まれる理由 → (3) 月額に切り替えた実額
// の順で通す。理由 (2) を挟まずに安さだけを見せると、品質への不信に変わる。
// ============================================================
// ============================================================
// お取引の条件 — 修正規定・権利・NDA・支払・納期。
// 発注前に法人が確認する事項が1章も無かったため新設した。
// カード22枚あり、既定で開いていると買う判断の直前に壁になるため折りたたむ。
// ============================================================
function TermRows({ rows }: { rows: readonly { label: string; body: string }[] }) {
  return (
    <div className="fm-terms-grid">
      {rows.map(r => (
        <div key={r.label} style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: '#FFFFFF', padding: '16px 17px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, lineHeight: 1.6, marginBottom: 6 }}>{r.label}</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.9, color: C.body, margin: 0 }}>{r.body}</p>
        </div>
      ))}
    </div>
  );
}

// 折りたたみ。details/summary を使うとブラウザ既定の三角と行の高さが混ざるので、
// 44px を確保したボタンと状態表示を自前で持つ。
function Disclosure({ title, note, children, defaultOpen = false }: {
  title: string; note?: string; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: '#FFFFFF', overflow: 'hidden' }}>
      <button type="button" aria-expanded={open}
        onClick={() => { setOpen(v => !v); if (!open) track('studio_film_terms_open', { section: title }); }}
        style={{
          width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '15px 17px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontFamily: SANS,
        }}>
        <span>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: C.ink, lineHeight: 1.6 }}>{title}</span>
          {note && <span style={{ display: 'block', fontSize: 12, color: C.mute, lineHeight: 1.7, marginTop: 3 }}>{note}</span>}
        </span>
        <span aria-hidden style={{ color: C.goldText, fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{ padding: '0 17px 20px', borderTop: `1px solid ${C.line}`, paddingTop: 18 }}>{children}</div>}
    </div>
  );
}

function Terms() {
  return (
    <Band alt pad="56px 0" id="film-terms">
      <Reveal>
        <H2 en="Terms & Conditions" sub="修正の範囲、権利の帰属、支払条件、AI制作特有の論点まで、発注前にご確認いただく事項をすべて公開しています。稟議に必要な項目は、この3つに揃えています。">
          お取引の条件
        </H2>
      </Reveal>

      <div style={{ display: 'grid', gap: 12 }}>
        <Disclosure title={REVISION.title} note={REVISION.lead}>
          <TermsRevision />
        </Disclosure>
        <Disclosure title={TERMS.title} note={TERMS.lead}>
          <TermRows rows={TERMS.rows} />
        </Disclosure>
        <Disclosure title={AI_TERMS.title} note={AI_TERMS.lead}>
          <TermRows rows={AI_TERMS.rows} />
        </Disclosure>
      </div>
    </Band>
  );
}

function TermsRevision() {
  return (
    <>
      <Reveal>
        <div className="st-card st-card-featured" style={{ background: '#FFFFFF' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 7 }}>{REVISION.unit.title}</div>
          <p style={{ fontSize: 13, lineHeight: 1.95, color: C.body, margin: 0 }}>{REVISION.unit.body}</p>
        </div>
      </Reveal>

      {/* プラン別の回数 */}
      <Reveal>
        <div style={{ marginTop: 16, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', background: '#FFFFFF' }}>
          {REVISION.rules.map((r, i) => (
            <div key={r.plan} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', padding: '13px 16px', borderTop: i === 0 ? 'none' : `1px solid ${C.line}` }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, letterSpacing: '0.06em', minWidth: 96 }}>{r.plan}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.goldText, minWidth: 54 }}>{r.count}</div>
              <p style={{ fontSize: 12.5, lineHeight: 1.8, color: C.body, margin: 0, flex: '1 1 200px' }}>{r.note}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* 範囲 / 対象外 */}
      <div className="fm-terms-grid" style={{ marginTop: 16 }}>
        <Reveal>
          <div style={{ height: '100%', boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 12, background: '#FFFFFF', padding: '18px 17px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 11 }}>{REVISION.included.title}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {REVISION.included.items.map(x => (
                <li key={x} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.75, color: C.body }}><IconCheck />{x}</li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={60}>
          <div style={{ height: '100%', boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 12, background: '#FFFFFF', padding: '18px 17px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 11 }}>{REVISION.excluded.title}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {REVISION.excluded.items.map(x => (
                <li key={x} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.75, color: C.body }}>
                  <span aria-hidden style={{ color: C.mute, flexShrink: 0, marginTop: 2 }}>—</span>{x}
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 12, lineHeight: 1.85, color: C.mute, margin: '11px 0 0' }}>{REVISION.excluded.note}</p>
          </div>
        </Reveal>
      </div>

      {/* 速さ・期限・お願い */}
      <div className="fm-terms-grid" style={{ marginTop: 12 }}>
        {[REVISION.speed, REVISION.window, REVISION.ask].map((b, i) => (
          <Reveal key={b.title} delay={i * 50}>
            <div style={{ height: '100%', boxSizing: 'border-box', background: C.bg, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '14px 15px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 5 }}>{b.title}</div>
              <p style={{ fontSize: 12.5, lineHeight: 1.9, color: C.body, margin: 0 }}>{b.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

    </>
  );
}

// ============================================================
// 選び方 — 旧「あなたにはこれ」+「迷った人向け分岐」+「こんな方の映像を」の統合。
// 3章とも問いは1つ (自分に合うか / どれを選ぶか) だったので、1章にまとめて縦の長さを詰める。
// ============================================================
// ============================================================
// 主力商品 — AI SHORT DRAMA
// ============================================================
// ============================================================
// 制作工程
// ============================================================
// ============================================================
// Stripe決済ボタン (未設定/失敗時はLINE相談へ自動フォールバック)
// ============================================================
function FilmCheckoutButton({ plan, mode, label }: { plan: string; mode: 'payment' | 'subscription'; label: string }) {
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    track('studio_film_checkout_start', { plan, mode });
    try {
      const resp = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, brand: 'film', mode }),
      });
      if (resp.status === 503) {
        track('studio_film_checkout_fallback', { plan });
        window.open(CONTACT.lineUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      const data: { url?: string } = await resp.json().catch(() => ({}));
      if (data.url) window.location.href = data.url;
      else window.open(CONTACT.lineUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.open(CONTACT.lineUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="st-btn st-btn-primary" style={{ width: '100%', boxSizing: 'border-box' }} onClick={go} disabled={busy}>
      {busy ? '決済ページを開いています…' : label}
    </button>
  );
}

// ============================================================
// 料金
// ============================================================
function Pricing() {
  return (
    <div>
      <Band pad="56px 0" id="film-pricing">
        <Reveal><H2 en="Pricing" sub="1本ごとの制作と、毎月継続する制作の2通りからお選びいただけます。">料金</H2></Reveal>
        <div style={{ display: 'grid', gap: 14 }}>
          {FILM_PLANS.map((p, i) => (
            <Reveal key={p.id} delay={i * 50}>
              <div className={`st-card${p.featured ? ' st-card-featured' : ''}`}>
                {p.featured && <div className="st-label" style={{ fontSize: 10.5, marginBottom: 10 }}>Recommended — 標準プラン</div>}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div className="st-serif" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.1em', color: C.ink }}>{p.name}</div>
                  <div className="st-serif" style={{ fontSize: 19, fontWeight: 700, color: C.ink }}>
                    {p.price}<span style={{ fontSize: 12.5, color: C.mute, fontWeight: 400, marginLeft: 6 }}>/ {p.unit}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.mute, marginTop: 6, letterSpacing: '0.02em' }}>{p.terms}</div>
                <div style={{ fontSize: 12, color: C.goldText, marginTop: 4, fontWeight: 600, letterSpacing: '0.02em' }}>{p.delivery}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: '10px 0 6px', lineHeight: 1.8 }}>{p.lead}</div>
                {/* どの会社向けかを1行で。プラン選択を読む人に丸投げしない */}
                <div style={{ fontSize: 12.5, color: C.goldText, lineHeight: 1.8, marginBottom: 12 }}>{p.fit}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
                  {p.includes.map(x => (
                    <li key={x} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{x}</li>
                  ))}
                </ul>
                {/* 含まれないもの。書かない見積りは必ず後で揉める。書くこと自体が信頼になる */}
                <div style={{ marginTop: 14, paddingTop: 13, borderTop: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.1em', color: C.mute, marginBottom: 8 }}>含まれないもの</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 5 }}>
                    {p.excludes.map(x => (
                      <li key={x} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.7, color: C.mute }}>
                        <span aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>—</span>{x}
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ marginTop: 16 }}>
                  {p.checkout ? (
                    <>
                      <FilmCheckoutButton plan={p.id} mode="payment" label={p.cta} />
                      {/* 決済ボタンの控え。実測19pxだったので、44pxの当たりを確保する */}
                      <a href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, textAlign: 'center', fontSize: 12.5, color: C.mute, marginTop: 4 }}
                        onClick={() => track('studio_film_pricing_cta', { plan: p.id, to: 'line' })}>
                        発注前に要件を相談する
                      </a>
                    </>
                  ) : (
                    <a className="st-btn st-btn-primary" style={{ width: '100%', boxSizing: 'border-box' }}
                      href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
                      onClick={() => track('studio_film_pricing_cta', { plan: p.id, to: 'line' })}>
                      <IconChat /> {p.cta}
                    </a>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.9, color: C.mute, margin: '16px 2px 0' }}>
          <span style={{ color: C.ink, fontWeight: 600 }}>制作費は何で変わりますか？ — </span>{PRICE_WHY}
        </p>

        {/* 月額 */}
        <Reveal>
          <div style={{ marginTop: 40 }}>
            <div className="st-label" style={{ marginBottom: 10 }}>{MONTHLY_LEAD.en}</div>
            <h3 className="st-serif" style={{ fontSize: 21, fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.6 }}>{MONTHLY_LEAD.title}</h3>
            <p style={{ fontSize: 14, lineHeight: 2, color: C.body, margin: '10px 0 20px' }}>{MONTHLY_LEAD.body}</p>
          </div>
        </Reveal>
        <div className="fm-grid3">
          {MONTHLY_PLANS.map((m, i) => (
            <Reveal key={m.id} delay={i * 50}>
              <div className={`st-card${m.featured ? ' st-card-featured' : ''}`} style={{ height: '100%', boxSizing: 'border-box' }}>
                <div className="st-label" style={{ fontSize: 10.5, marginBottom: 10 }}>{m.volume}</div>
                <div className="st-serif" style={{ fontSize: 21, fontWeight: 700, color: C.ink }}>
                  {m.price}<span style={{ fontSize: 12.5, color: C.mute, fontWeight: 400, marginLeft: 6 }}>/ 月</span>
                </div>
                <div style={{ fontSize: 12, color: C.mute, marginTop: 4 }}>{m.unitPrice}</div>
                <p style={{ fontSize: 13, lineHeight: 1.9, color: C.body, margin: '10px 0 0 0' }}>{m.body}</p>
                <div style={{ marginTop: 14 }}>
                  <FilmCheckoutButton plan={m.id} mode="subscription" label="この本数で契約する" />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="st-card" style={{ marginTop: 18, background: '#FFFFFF' }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute, marginBottom: 10 }}>継続プランの条件</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {MONTHLY_TERMS.map(t => (
                <li key={t} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{t}</li>
              ))}
            </ul>
            <p style={{ fontSize: 12.5, lineHeight: 1.9, color: C.mute, margin: '12px 0 0' }}>
              合わないと感じた月に止められます。続ける理由が毎月あることを、私たちの側の条件にしています。
            </p>
          </div>
        </Reveal>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <a className="st-btn st-btn-ghost" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => track('studio_film_pricing_cta', { plan: 'monthly', to: 'line' })}>
            <IconChat /> 本数を相談してから決める
          </a>
          <Note>{PRICE_NOTE}</Note>
        </div>
      </Band>
    </div>
  );
}

// ============================================================
// 制作実績
// ============================================================
function WorkCard({ w }: { w: (typeof FILM_WORKS)[number] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const play = () => { videoRef.current?.play().then(() => setPlaying(true)).catch(() => {}); };
  const pause = () => { videoRef.current?.pause(); setPlaying(false); };
  const toggle = () => { if (playing) pause(); else play(); };

  return (
    <article className="fm-shot">
      {w.videoUrl ? (
        <button type="button" onClick={toggle} onMouseEnter={play} onMouseLeave={pause}
          aria-label={`${w.client} の制作事例を${playing ? '止める' : '再生する'}`}
          style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
          <div className="fm-frame" style={{ aspectRatio: '9 / 16' }}>
            <video ref={videoRef} src={w.videoUrl} poster={w.poster} muted loop playsInline preload="none" aria-hidden />
          </div>
        </button>
      ) : w.poster ? (
        <div className="fm-frame" style={{ aspectRatio: '9 / 16' }}><img src={w.poster} alt={`${w.client} の制作事例`} loading="lazy" /></div>
      ) : null}
      <div style={{ marginTop: 12 }}>
        <div className="st-label" style={{ fontSize: 10, marginBottom: 4 }}>{w.category}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{w.client}</div>
        <p style={{ fontSize: 12.5, lineHeight: 1.8, color: C.body, margin: '6px 0 0' }}>{w.purpose}</p>
        {w.result && <p style={{ fontSize: 12.5, lineHeight: 1.8, color: C.goldText, margin: '4px 0 0', fontWeight: 600 }}>{w.result}</p>}
        {w.url && (
          <a href={w.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 11.5, color: C.body, textDecoration: 'underline', textUnderlineOffset: 2 }}>
            {w.client} 公式サイト ↗
          </a>
        )}
      </div>
    </article>
  );
}

// 9:16 の縦型を1列で積むとスマホで3本 = 約2,300px を占めるため、ショーケースと同じ横スクロールに揃える。
function FilmWorks() {
  return (
    <section id="film-works" style={{ background: C.alt, padding: '56px 0', scrollMarginTop: 96 }}>
      <div className="st-inner">
        <Reveal><H2 en="Works" sub="実際に納品した映像です。掲載は貴社の許可をいただいたもののみで、非公開のご希望があれば一切掲載しません。">制作実績</H2></Reveal>
      </div>
      <Reveal delay={60}>
        <div className="fm-scroller">
          {FILM_WORKS.map(w => <WorkCard key={w.id} w={w} />)}
        </div>
      </Reveal>
    </section>
  );
}

// ============================================================
// 象徴商品
// ============================================================
// ============================================================

// ============================================================
// FAQ
// ============================================================
function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Band alt pad="56px 0" id="film-faq">
      <Reveal><H2 en="FAQ" sub="ご相談前によくいただくご質問です。">よくある質問</H2></Reveal>
      <div>
        {FILM_FAQ.map((f, i) => (
          <div key={f.q} className="fm-faq-item">
            <button className="fm-faq-btn" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span>Q. {f.q}</span>
              <span style={{ color: C.goldText, fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <p style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: '0 0 16px' }}>{f.a}</p>}
          </div>
        ))}
      </div>
    </Band>
  );
}

// ============================================================
// 思想
// ============================================================
// ============================================================
// 最終CTA + 相談メモ (4問 → LINEに貼れる形でコピー)
// ============================================================
function FinalCta() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  const answeredCount = Object.keys(answers).length;

  const pick = (field: string, value: string) => {
    if (!startedRef.current) { startedRef.current = true; track('studio_film_inquiry_start'); }
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  // 選んだものだけを載せる。未選択を「未選択」と並べるとLINEに貼った時に見苦しい。
  const summaryText = useMemo(() => {
    const lines = ['映像制作の相談です。'];
    for (const f of INQUIRY_FIELDS) {
      if (answers[f.id]) lines.push(`・${f.question}: ${answers[f.id]}`);
    }
    return lines.join('\n');
  }, [answers]);

  // クリップボードは埋め込み・権限拒否の環境で普通に失敗する。
  // 黙って何も起きないと「押したのに動かない」になるので、必ず手で拾える形に落とす。
  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      window.prompt('以下をコピーして、LINEのトークに貼り付けてください', summaryText.replace(/\n/g, ' / '));
    }
  };

  // LINEを開く前に、選んだ内容をクリップボードへ。貼るだけで話が始まる状態にする。
  const openLine = () => {
    track('studio_film_inquiry_submit', { answered: answeredCount, to: 'line' });
    if (answeredCount > 0) void copySummary();
  };

  return (
    <section id="film-inquiry" style={{ background: D.bg, padding: '56px 0 64px', scrollMarginTop: 96 }}>
      <div className="st-inner">
        <Reveal>
          <h2 className="st-serif" style={{ fontSize: 'clamp(24px, 6.6vw, 34px)', fontWeight: 700, lineHeight: 1.55, color: D.ink, margin: 0, whiteSpace: 'pre-line' }}>
            {FILM_CTA.title}
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 2.05, color: D.body, margin: '18px 0 0', maxWidth: 560 }}>{FILM_CTA.body}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            {FILM_CTA.tags.map(t => <span key={t} className="fm-tag">{t}</span>)}
          </div>
          <div className="fm-reassure" style={{ marginTop: 18 }}>
            {FILM_CTA.reassure.map(t => (
              <span key={t} className="fm-reassure-item"><IconCheck color={D.gold} />{t}</span>
            ))}
          </div>
        </Reveal>

        {/* 4問。すべて任意で、1つも選ばずにLINEへ進める */}
        <div style={{ marginTop: 34, background: D.raise, border: `1px solid ${D.line}`, borderRadius: 14, padding: '24px 20px' }}>
          <div style={{ fontSize: 12.5, color: D.mute, marginBottom: 20, lineHeight: 1.8 }}>
            選んでおくと、LINEを開いたときに貼るだけで話が始まります。すべて任意で、飛ばしてそのままLINEに進んでも構いません。
          </div>
          {INQUIRY_FIELDS.map(f => (
            <fieldset key={f.id} style={{ border: 'none', padding: 0, margin: '0 0 22px' }}>
              <legend style={{ fontSize: 13.5, fontWeight: 700, color: D.ink, padding: 0, marginBottom: 10 }}>{f.question}</legend>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {f.options.map(o => {
                  const on = answers[f.id] === o;
                  return (
                    <button key={o} type="button" onClick={() => pick(f.id, o)} aria-pressed={on}
                      style={{
                        minHeight: 46, padding: '11px 15px', borderRadius: 8, cursor: 'pointer', fontFamily: SANS,
                        fontSize: 13.5, textAlign: 'left', transition: 'border-color 140ms ease',
                        border: on ? `1.5px solid ${D.gold}` : `1px solid ${D.line}`,
                        background: on ? 'rgba(212,169,79,0.12)' : 'transparent',
                        color: on ? D.ink : D.body, fontWeight: on ? 600 : 400,
                      }}>
                      {o}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
            <a className="st-btn fm-btn-light" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
              style={{ width: '100%', boxSizing: 'border-box' }} onClick={openLine}>
              <IconChat /> {CONTACT.lineLabel}
            </a>
            {answeredCount > 0 && (
              <button className="st-btn fm-btn-outline" onClick={() => { void copySummary(); }} style={{ width: '100%', boxSizing: 'border-box' }}>
                <IconCopy /> {copied ? 'コピーしました' : '選んだ内容をコピーする'}
              </button>
            )}
          </div>
          <p style={{ fontSize: 12, color: D.mute, lineHeight: 1.9, marginTop: 14, textAlign: 'center' }}>
            {answeredCount > 0
              ? 'LINEを開くと同時に、選んだ内容をコピーします。トークに貼り付けて送信してください。'
              : CONTACT.lineNote}
            <br />
            LINEをお使いでない場合は、メールでも承ります。<br />
            <a href={`mailto:${STUDIO.email}?subject=${encodeURIComponent('【CORE Studio】映像制作のご相談')}`}
              style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: D.body, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              {STUDIO.email}
            </a>
          </p>
        </div>

        <div className="st-serif" style={{ fontSize: 13, color: D.mute, textAlign: 'center', marginTop: 24, letterSpacing: '0.12em', fontFamily: SERIF }}>
          CORE STUDIO — FILM &amp; MOTION
        </div>
      </div>
    </section>
  );
}
