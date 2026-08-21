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
  FILM, WHY_CORE, BRIDGE, AUDIENCE_MATCH, studioProjects, FEATURED, FILM_PROCESS, PROCESS_STATEMENT,
  FILM_PLANS, MONTHLY_LEAD, MONTHLY_PLANS, MONTHLY_TERMS, PRICE_NOTE, PRICE_WHY, DECISION_GUIDE,
  SIGNATURE, FILM_WORKS, TARGETS, REVISION, TERMS, AI_TERMS,
  COMPARISON, FILM_FAQ, PHILOSOPHY, FILM_CTA, INQUIRY_FIELDS,
  type StudioProject,
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
        .fm-sticky-cta { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: none;
          padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: rgba(11,11,12,0.92);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-top: 1px solid ${D.line}; }
        @media (max-width: 767px) { .fm-sticky-cta { display: block; } .fm-sticky-pad { height: 68px; } }
      `}</style>

      <FilmHero />
      <SectionNav />
      <Showcase />
      <Bridge />
      <Featured />
      <WhyCore />
      <Comparison />
      <Process />
      <Pricing />
      <Terms />
      <ChooseGuide />
      <FilmWorks />
      <Signature />
      <Faq />
      <Philosophy />
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
        <IconChat /> 制作について相談する
      </a>
    </div>
  );
}

// ============================================================
// ヒーロー
// ============================================================
function FilmHero() {
  return (
    <section style={{ background: D.bg, padding: '64px 0 56px' }}>
      <div className="st-inner">
        <Reveal>
          <div className="st-label" style={{ color: D.gold, marginBottom: 20 }}>{FILM.label}</div>
          <h1 className="st-serif" style={{ fontSize: 'clamp(28px, 7.6vw, 44px)', fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.02em', margin: 0, color: D.ink, whiteSpace: 'pre-line' }}>
            {FILM.hero}
          </h1>
          <p style={{ fontSize: 15, lineHeight: 2.1, color: D.body, margin: '24px 0 0', maxWidth: 620 }}>
            {FILM.heroSub}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
            <a className="st-btn fm-btn-light" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => track('studio_film_hero_cta', { to: 'line' })}>
              <IconChat /> {CONTACT.lineLabel}
            </a>
            <button className="st-btn fm-btn-outline" onClick={() => { track('studio_film_hero_cta', { to: 'pricing' }); scrollToId('film-pricing'); }}>
              {FILM.heroCtaSub}
            </button>
          </div>
          <div className="fm-reassure" style={{ marginTop: 16 }}>
            {FILM.heroReassure.map(t => (
              <span key={t} className="fm-reassure-item"><IconCheck color={D.gold} />{t}</span>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: D.mute, margin: '14px 0 0', lineHeight: 1.9 }}>{CONTACT.lineNote}</p>

          {/* 法人向けの取引条件を1行で。詳細は「お取引の条件」の章へ送る */}
          <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${D.line}` }}>
            <div style={{ display: 'flex', gap: '8px 18px', flexWrap: 'wrap' }}>
              {FILM.heroTrust.map(t => (
                <span key={t} style={{ fontSize: 11.5, color: D.mute, display: 'inline-flex', alignItems: 'center', gap: 6, letterSpacing: '0.02em' }}>
                  <IconCheck color={D.goldLine} />{t}
                </span>
              ))}
            </div>
            <button type="button"
              onClick={() => { track('studio_film_hero_cta', { to: 'terms' }); scrollToId('film-terms'); }}
              style={{ marginTop: 12, minHeight: 44, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, color: D.gold, letterSpacing: '0.03em', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              お取引の条件をすべて見る
            </button>
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
  { id: 'film-showcase', label: '制作事例' },
  { id: 'film-process', label: '制作の流れ' },
  { id: 'film-pricing', label: '料金' },
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
// ショーケース (9:16)
// ============================================================
function ProjectCard({ p }: { p: StudioProject }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  // hover だけで再生させると、指で触る人とキーボードの人が一生再生できない。
  // 枠そのものをボタンにして、押す/Enter/hover のどれでも同じ動作にする。
  const play = () => {
    track('studio_film_project_play', { id: p.id });
    videoRef.current?.play().then(() => setPlaying(true)).catch(() => { /* 自動再生が拒否される環境では静止画のまま */ });
  };
  const pause = () => { videoRef.current?.pause(); setPlaying(false); };
  const toggle = () => { if (playing) pause(); else play(); };

  const frame = (
    <div className="fm-frame" style={{ aspectRatio: p.aspectRatio }}>
      {p.videoUrl ? (
        <video ref={videoRef} src={p.videoUrl} poster={p.poster} muted loop playsInline preload="none" aria-hidden />
      ) : p.poster ? (
        <img src={p.poster} alt={`${p.title} の一場面`} loading="lazy" />
      ) : null}

      {/* 実映像が入るまではタイトルフレーム。動画がある時は上に重ねて見出しを残す */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '18px 16px', pointerEvents: 'none', opacity: playing ? 0 : 1, transition: 'opacity 300ms ease', background: p.videoUrl || p.poster ? 'linear-gradient(to top, rgba(11,11,12,0.85) 0%, rgba(11,11,12,0.1) 55%)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="st-label" style={{ color: D.gold, fontSize: 10 }}>{p.no}</div>
            <div style={{ width: 22, height: 1, background: D.goldLine, marginTop: 8 }} />
          </div>
          {/* AI生成物と誤認されないための区分バッジ (被写体の掲載許諾は取得済み) */}
          {p.isReal && (
            <span style={{ fontSize: 9.5, letterSpacing: '0.1em', color: D.ink, background: 'rgba(255,255,255,0.16)', border: `1px solid ${D.line}`, borderRadius: 999, padding: '4px 9px' }}>
              実写
            </span>
          )}
        </div>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: '0.24em', color: D.mute, marginBottom: 8 }}>{p.category}</div>
          <div className="st-serif" style={{ fontSize: 19, fontWeight: 700, color: D.ink, lineHeight: 1.5 }}>{p.title}</div>
        </div>
      </div>
    </div>
  );

  return (
    <article className="fm-shot">
      {p.videoUrl ? (
        <button type="button" onClick={toggle} onMouseEnter={play} onMouseLeave={pause}
          aria-label={`${p.title} のサンプル映像を${playing ? '止める' : '再生する'}`}
          style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
          {frame}
        </button>
      ) : frame}
      <p style={{ fontSize: 12.5, lineHeight: 1.85, color: D.mute, margin: '12px 2px 0' }}>{p.description}</p>
    </article>
  );
}

function Showcase() {
  return (
    <section id="film-showcase" style={{ background: D.bg, padding: '8px 0 56px', scrollMarginTop: 96 }}>
      <div className="st-inner">
        <Reveal>
          <div className="st-label" style={{ color: D.gold, marginBottom: 10 }}>Showcase</div>
          <h2 className="st-serif" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.5, color: D.ink, margin: 0 }}>
            つくるのは、この5つ。
          </h2>
        </Reveal>
      </div>
      <Reveal delay={80}>
        <div className="fm-scroller" style={{ marginTop: 22 }}>
          {studioProjects.map(p => <ProjectCard key={p.id} p={p} />)}
        </div>
      </Reveal>
      <div className="st-inner">
        {/* 旧「制作するもの」セクションはこの5枚と内容が重複していたため統合。
            映像が無いコマーシャルだけを1行で補う (同じ話を2章に分けない) */}
        <p style={{ fontSize: 13, lineHeight: 1.95, color: D.body, margin: '0 0 12px' }}>
          このほか、広告配信を前提とした<strong style={{ color: D.ink, fontWeight: 700 }}>コマーシャル（15〜30秒）</strong>も制作します。配信面ごとの尺・比率で書き出してお渡しします。
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.9, color: D.mute, margin: 0 }}>{FILM.showcaseNote}</p>
      </div>
    </section>
  );
}

// ============================================================
// 情緒のビート — 映像を見た直後、料金の話に入る前に一度だけ置く
// ============================================================
function Bridge() {
  return (
    <section style={{ background: D.bg, padding: '0 0 68px' }}>
      <div className="st-inner">
        <Reveal>
          <div style={{ width: 34, height: 1, background: D.goldLine, marginBottom: 26 }} />
          <div className="st-label" style={{ color: D.gold, marginBottom: 16 }}>{BRIDGE.en}</div>
          <p className="st-serif" style={{ fontSize: 'clamp(20px, 5.4vw, 28px)', fontWeight: 700, lineHeight: 1.75, color: D.ink, margin: 0, whiteSpace: 'pre-line', letterSpacing: '0.01em' }}>
            {BRIDGE.title}
          </p>
          {BRIDGE.body.map(t => (
            <p key={t.slice(0, 12)} style={{ fontSize: 14.5, lineHeight: 2.15, color: D.body, margin: '22px 0 0', maxWidth: 580 }}>{t}</p>
          ))}
          <p className="st-serif" style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.95, color: D.gold, margin: '26px 0 0', maxWidth: 580 }}>
            {BRIDGE.closing}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ============================================================
// なぜ CORE Studio か — AI × STORY × CREATIVE
// ============================================================
function WhyCore() {
  return (
    <Band alt pad="56px 0">
      <Reveal>
        <div className="st-label" style={{ marginBottom: 12 }}>{WHY_CORE.en}</div>
        <h2 className="st-serif" style={{ fontSize: 'clamp(22px, 6vw, 30px)', fontWeight: 700, lineHeight: 1.55, color: C.ink, margin: 0, whiteSpace: 'pre-line' }}>
          {WHY_CORE.title}
        </h2>
        <p style={{ fontSize: 14, lineHeight: 2.05, color: C.body, margin: '16px 0 0', maxWidth: 580 }}>{WHY_CORE.lead}</p>
      </Reveal>
      <div className="fm-why-grid" style={{ marginTop: 26 }}>
        {WHY_CORE.pillars.map((p, i) => (
          <Reveal key={p.key} delay={i * 60}>
            <div className="st-card" style={{ height: '100%', boxSizing: 'border-box' }}>
              <div className="st-serif" style={{ fontSize: 20, fontWeight: 700, color: C.goldText, letterSpacing: '0.1em', marginBottom: 10 }}>{p.title}</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: 0 }}>{p.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Band>
  );
}

// ============================================================
// お取引の条件 — 修正規定・権利・NDA・支払・納期。
// 発注前に法人が確認する事項が1章も無かったため新設した。
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

function Terms() {
  return (
    <Band alt pad="56px 0" id="film-terms">
      {/* 1. 修正のお約束 — 一番聞かれるので先頭に置く */}
      <Reveal>
        <H2 en={REVISION.en} sub={REVISION.lead}>{REVISION.title}</H2>
      </Reveal>

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

      {/* 2. お取引の条件 */}
      <Reveal>
        <div style={{ marginTop: 44 }}>
          <H2 en={TERMS.en} sub={TERMS.lead}>{TERMS.title}</H2>
        </div>
      </Reveal>
      <TermRows rows={TERMS.rows} />

      {/* 3. AIについて */}
      <Reveal>
        <div style={{ marginTop: 44 }}>
          <H2 en={AI_TERMS.en} sub={AI_TERMS.lead}>{AI_TERMS.title}</H2>
        </div>
      </Reveal>
      <TermRows rows={AI_TERMS.rows} />
    </Band>
  );
}

// ============================================================
// 選び方 — 旧「あなたにはこれ」+「迷った人向け分岐」+「こんな方の映像を」の統合。
// 3章とも問いは1つ (自分に合うか / どれを選ぶか) だったので、1章にまとめて縦の長さを詰める。
// ============================================================
function ChooseGuide() {
  return (
    <Band pad="56px 0" id="film-choose">
      <Reveal><H2 en="Find Your Fit" sub="用途から選べます。決めきれないまま、ご相談いただいても構いません。">どれを選べばいいか</H2></Reveal>

      {/* 用途 → 映像の種類 */}
      <div className="fm-audience-grid">
        {AUDIENCE_MATCH.map((m, i) => (
          <Reveal key={m.id} delay={i * 60}>
            <button
              className="st-card"
              style={{ height: '100%', boxSizing: 'border-box', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: SANS, border: `1px solid ${C.line}`, padding: '18px 18px' }}
              onClick={() => { track('studio_film_audience_match', { id: m.id }); scrollToId('film-pricing'); }}
            >
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink, lineHeight: 1.6 }}>{m.question}</div>
              <div className="st-label" style={{ fontSize: 11, marginTop: 8, marginBottom: 8 }}>→ {m.answer}</div>
              <p style={{ fontSize: 12.5, lineHeight: 1.75, color: C.body, margin: 0, borderTop: `1px solid ${C.line}`, paddingTop: 9 }}>
                {m.sub.join('・')}
              </p>
            </button>
          </Reveal>
        ))}
      </div>

      {/* 状況 → プラン */}
      <Reveal>
        <div className="fm-decision-grid" style={{ marginTop: 26 }}>
          {DECISION_GUIDE.map(d => (
            <div key={d.q} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 15px', border: `1px solid ${C.line}`, borderRadius: 10, background: '#FFFFFF' }}>
              <span style={{ fontSize: 13.5, color: C.body }}>{d.q}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.goldText, whiteSpace: 'nowrap' }}>→ {d.a}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* こんな方に (旧 Targets。10行の縦積みをやめて2〜3列に圧縮) */}
      <Reveal>
        <div style={{ marginTop: 30 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute, marginBottom: 12 }}>
            こんな方の映像をつくっています
          </div>
          <div className="fm-chip-grid">
            {TARGETS.map(t => (
              <div key={t.en} style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: '#FFFFFF', padding: '11px 12px' }}>
                <div style={{ fontSize: 13, color: C.ink, fontWeight: 700, lineHeight: 1.5 }}>{t.ja}</div>
                <p style={{ fontSize: 11.5, lineHeight: 1.7, color: C.mute, margin: '4px 0 0' }}>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <a className="st-btn st-btn-ghost" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
          onClick={() => track('studio_film_pricing_cta', { plan: 'undecided', to: 'line' })}>
          <IconChat /> 決めずにまず相談する
        </a>
      </div>
    </Band>
  );
}

// ============================================================
// 主力商品 — AI SHORT DRAMA
// ============================================================
function Featured() {
  return (
    <Band pad="56px 0">
      <Reveal>
        <div className="st-label" style={{ marginBottom: 12 }}>{FEATURED.en}</div>
        <h2 className="st-serif" style={{ fontSize: 'clamp(23px, 6.2vw, 32px)', fontWeight: 700, lineHeight: 1.55, color: C.ink, margin: 0, whiteSpace: 'pre-line' }}>
          {FEATURED.title}
        </h2>
        {FEATURED.body.map(t => (
          <p key={t.slice(0, 12)} style={{ fontSize: 14.5, lineHeight: 2.1, color: C.body, margin: '18px 0 0' }}>{t}</p>
        ))}
      </Reveal>

      <div style={{ marginTop: 32 }}>
        {FEATURED.episodes.map((ep, i) => (
          <Reveal key={ep.no} delay={i * 60}>
            <div style={{ display: 'flex', gap: 16, padding: '18px 0', borderTop: `1px solid ${C.line}` }}>
              <div className="st-label" style={{ flexShrink: 0, minWidth: 84, paddingTop: 3, fontSize: 10 }}>{ep.no}</div>
              <div>
                <div className="st-serif" style={{ fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.6 }}>{ep.title}</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: '6px 0 0' }}>{ep.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 26 }}>
          {FEATURED.ladder.map((s, i) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.body }}>
              {i > 0 && <span aria-hidden style={{ color: C.goldText }}>→</span>}
              <span style={{ fontWeight: i === FEATURED.ladder.length - 1 ? 700 : 400, color: i === FEATURED.ladder.length - 1 ? C.ink : C.body }}>{s}</span>
            </span>
          ))}
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 2, color: C.body, margin: '18px 0 0', background: C.alt, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '13px 15px' }}>
          {FEATURED.closing}
        </p>
      </Reveal>
    </Band>
  );
}

// ============================================================
// 制作工程
// ============================================================
function Process() {
  return (
    <Band alt pad="56px 0" id="film-process">
      <Reveal><H2 en="Process" sub="ご相談から納品まで、6つの工程で進めます。各工程の進捗は随時ご報告します。">制作の流れ</H2></Reveal>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {FILM_PROCESS.map((s, i) => (
          <Reveal key={s.no} delay={i * 40}>
            <li style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: i < FILM_PROCESS.length - 1 ? `1px solid ${C.line}` : 'none' }}>
              <span className="st-serif" style={{ fontSize: 14, fontWeight: 700, color: C.goldText, flexShrink: 0, minWidth: 26, paddingTop: 2 }}>{s.no}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>
                  {s.title}<span style={{ fontSize: 11, letterSpacing: '0.16em', color: C.mute, marginLeft: 10, fontWeight: 500 }}>{s.en.toUpperCase()}</span>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.9, color: C.body, margin: '4px 0 0' }}>{s.body}</p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
      <Reveal>
        <div style={{ marginTop: 26, border: `1px solid ${C.goldLine}`, borderRadius: 14, padding: '24px 20px', background: '#FFFFFF' }}>
          <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.65 }}>{PROCESS_STATEMENT.title}</div>
          <p style={{ fontSize: 13.5, lineHeight: 2, color: C.body, margin: '10px 0 0' }}>{PROCESS_STATEMENT.body}</p>
        </div>
      </Reveal>
    </Band>
  );
}

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
                <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: '10px 0 12px', lineHeight: 1.8 }}>{p.lead}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
                  {p.includes.map(x => (
                    <li key={x} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{x}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 16 }}>
                  {p.checkout ? (
                    <>
                      <FilmCheckoutButton plan={p.id} mode="payment" label={p.cta} />
                      <a href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'block', textAlign: 'center', fontSize: 12.5, color: C.mute, marginTop: 10 }}
                        onClick={() => track('studio_film_pricing_cta', { plan: p.id, to: 'line' })}>
                        先にLINEで相談する
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
                  <FilmCheckoutButton plan={m.id} mode="subscription" label="このプランで申し込む" />
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
            <IconChat /> 決める前にLINEで相談する
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
      </div>
    </article>
  );
}

// 9:16 の縦型を1列で積むとスマホで3本 = 約2,300px を占めるため、ショーケースと同じ横スクロールに揃える。
function FilmWorks() {
  return (
    <section style={{ background: C.alt, padding: '56px 0', scrollMarginTop: 88 }}>
      <div className="st-inner">
        <Reveal><H2 en="Works" sub="実際に制作した映像です。掲載許諾が取れたクライアント事例から、随時追加していきます。">制作実績</H2></Reveal>
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
function Signature() {
  return (
    <Band pad="56px 0">
      <Reveal>
        <div className="st-label" style={{ marginBottom: 12 }}>{SIGNATURE.en}</div>
        <h2 className="st-serif" style={{ fontSize: 'clamp(21px, 5.6vw, 27px)', fontWeight: 700, lineHeight: 1.55, color: C.ink, margin: 0, letterSpacing: '0.06em' }}>
          {SIGNATURE.name}
        </h2>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: C.ink, margin: '14px 0 0', lineHeight: 1.9 }}>{SIGNATURE.lead}</div>
        <p style={{ fontSize: 14, lineHeight: 2.05, color: C.body, margin: '10px 0 0' }}>{SIGNATURE.body}</p>
      </Reveal>

      <Reveal delay={60}>
        <div className="st-card st-card-featured" style={{ marginTop: 24 }}>
          <div className="st-label" style={{ fontSize: 10.5, marginBottom: 10 }}>{SIGNATURE.initial.label}</div>
          <div className="st-serif" style={{ fontSize: 23, fontWeight: 700, color: C.ink, marginBottom: 14 }}>{SIGNATURE.initial.price}</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
            {SIGNATURE.initial.includes.map(x => (
              <li key={x} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{x}</li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="st-card" style={{ marginTop: 14 }}>
          <div className="st-label" style={{ fontSize: 10.5, marginBottom: 10 }}>{SIGNATURE.monthly.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div className="st-serif" style={{ fontSize: 23, fontWeight: 700, color: C.ink }}>{SIGNATURE.monthly.price}</div>
            <div style={{ fontSize: 13, color: C.mute }}>{SIGNATURE.monthly.volume}</div>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: '10px 0 0' }}>{SIGNATURE.monthly.body}</p>
        </div>
      </Reveal>

      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <a className="st-btn st-btn-primary" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
          onClick={() => track('studio_film_pricing_cta', { plan: 'signature', to: 'line' })}>
          <IconChat /> この座組みをLINEで相談する
        </a>
      </div>
    </Band>
  );
}

// ============================================================
// 従来の制作との違い
// ============================================================
function StepFlow({ steps, dim }: { steps: readonly string[]; dim?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {steps.map((s, i) => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {i > 0 && <span aria-hidden style={{ color: dim ? C.mute : C.goldText, fontSize: 12 }}>→</span>}
          <span style={{ fontSize: 13.5, color: dim ? C.body : C.ink, fontWeight: dim ? 400 : 700, letterSpacing: dim ? 0 : '0.06em' }}>{s}</span>
        </span>
      ))}
    </div>
  );
}

function Comparison() {
  return (
    <Band pad="56px 0">
      <Reveal>
        <div className="st-label" style={{ marginBottom: 12 }}>{COMPARISON.en}</div>
        <h2 className="st-serif" style={{ fontSize: 'clamp(22px, 6vw, 30px)', fontWeight: 700, lineHeight: 1.55, color: C.ink, margin: 0, whiteSpace: 'pre-line' }}>
          {COMPARISON.title}
        </h2>
      </Reveal>
      <div style={{ display: 'grid', gap: 14, marginTop: 26 }}>
        <Reveal>
          <div className="st-card">
            <div className="st-label" style={{ fontSize: 10.5, marginBottom: 12, color: C.mute }}>{COMPARISON.traditional.label}</div>
            <StepFlow steps={COMPARISON.traditional.steps} dim />
            <p style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: '14px 0 0' }}>{COMPARISON.traditional.body}</p>
          </div>
        </Reveal>
        <Reveal delay={60}>
          <div className="st-card st-card-featured">
            <div className="st-label" style={{ fontSize: 10.5, marginBottom: 12 }}>{COMPARISON.core.label}</div>
            <StepFlow steps={COMPARISON.core.steps} />
            <p style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: '14px 0 0' }}>{COMPARISON.core.body}</p>
          </div>
        </Reveal>
      </div>
      <Reveal>
        <div style={{ marginTop: 20, background: C.alt, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '15px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, lineHeight: 1.7 }}>{COMPARISON.caution.title}</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.95, color: C.body, margin: '7px 0 0' }}>{COMPARISON.caution.body}</p>
        </div>
      </Reveal>
    </Band>
  );
}

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
function Philosophy() {
  return (
    <section style={{ background: D.bg, padding: '64px 0' }}>
      <div className="st-inner">
        <Reveal>
          <div className="st-label" style={{ color: D.gold, marginBottom: 18 }}>{PHILOSOPHY.en}</div>
          <p className="st-serif" style={{ fontSize: 'clamp(21px, 5.6vw, 30px)', fontWeight: 700, lineHeight: 1.6, color: D.ink, margin: 0, whiteSpace: 'pre-line', letterSpacing: '0.01em' }}>
            {PHILOSOPHY.headline}
          </p>
          {PHILOSOPHY.body.map(t => (
            <p key={t.slice(0, 12)} style={{ fontSize: 14.5, lineHeight: 2.15, color: D.body, margin: '22px 0 0', maxWidth: 580 }}>{t}</p>
          ))}
          <div className="st-serif" style={{ fontSize: 17, fontWeight: 700, color: D.gold, marginTop: 30, letterSpacing: '0.08em' }}>
            {PHILOSOPHY.closing}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

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
            LINEをお使いでない場合は <a href={`mailto:${STUDIO.email}?subject=${encodeURIComponent('【CORE Studio】映像制作のご相談')}`} style={{ color: D.body }}>{STUDIO.email}</a> でも承ります。
          </p>
        </div>

        <div className="st-serif" style={{ fontSize: 13, color: D.mute, textAlign: 'center', marginTop: 24, letterSpacing: '0.12em', fontFamily: SERIF }}>
          CORE STUDIO — FILM &amp; MOTION
        </div>
      </div>
    </section>
  );
}
