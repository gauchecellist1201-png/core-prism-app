// ============================================================
// /strategy/guides — 各サービスの営業資料（使い方・できること）
//
// ロゴ（ファーストビューの絵）を押すと、そのサービスの営業資料が開く。
// 技術仕様は書かない。読む相手はお客様と、お客様に説明する自分。
//
// ★カードにも本文にも「出現アニメ」を掛けないこと。
//   裏タブや省電力で opacity:0 のまま固まると、一覧や本文が空白になる。
// ★詳細は同じページの中で切り替える（別ページに飛ばさない）。
//   URL は /strategy/guides/<slug> に書き換えるので、1サービスだけを直接送れる。
// ============================================================
import { useEffect, useState } from 'react';
import { GUIDES, type Guide } from './ServiceGuideData';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';

function slugFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/\/guides?\/([a-z0-9-]+)/i);
  if (!m) return null;
  return GUIDES.some((g) => g.slug === m[1]) ? m[1] : null;
}

export default function ServiceGuideTab() {
  const [slug, setSlug] = useState<string | null>(() => slugFromPath());

  // ブラウザの「戻る」で一覧へ戻れるようにする。
  useEffect(() => {
    const onPop = () => setSlug(slugFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = (s: string) => {
    setSlug(s);
    window.history.pushState({}, '', `/strategy/guides/${s}`);
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    setSlug(null);
    window.history.pushState({}, '', '/strategy/guides');
    window.scrollTo({ top: 0 });
  };

  const guide = slug ? GUIDES.find((g) => g.slug === slug) ?? null : null;

  return (
    <>
      <style>{`
        .gd-grid{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
        @media (max-width:640px){
          .gd-grid{grid-template-columns:1fr;gap:1rem}
          .gd-hero{padding:2rem 1.25rem 1.25rem !important}
          .gd-hero h1{font-size:1.5rem !important}
        }
        .gd-card{display:block;width:100%;text-align:left;padding:0;cursor:pointer;color:inherit;
          border-radius:14px;overflow:hidden;
          background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);
          transition:border-color .2s ease, transform .2s ease, background .2s ease}
        .gd-card:hover,.gd-card:focus-visible{border-color:rgba(251,191,36,0.55);
          background:rgba(255,255,255,0.06);transform:translateY(-3px);outline:none}
        .gd-shot{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top center;
          background:#0b1020;border-bottom:1px solid rgba(255,255,255,0.08)}
        /* 44px を下回らせない。::before で広げず、素の高さで確保する */
        .gd-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;
          padding:0 1.15rem;border-radius:999px;font-size:0.88rem;font-weight:700;
          text-decoration:none;border:1px solid rgba(255,255,255,0.28);color:#fff;
          background:rgba(255,255,255,0.06);cursor:pointer}
        .gd-btn:hover{background:rgba(255,255,255,0.12)}
        .gd-btn--gold{background:linear-gradient(90deg,#fbbf24,#f59e0b);color:#1a1200;border-color:transparent}
        .gd-btn--gold:hover{filter:brightness(1.06)}
        .gd-sec{margin-top:2.25rem}
        .gd-sec h2{font-family:${FONT_SERIF_JA};font-size:1.02rem;font-weight:700;letter-spacing:.06em;
          color:#fbbf24;margin:0 0 .9rem;padding-bottom:.5rem;border-bottom:1px solid rgba(251,191,36,0.25)}
        .gd-li{display:flex;gap:.6rem;align-items:flex-start;line-height:1.95;
          font-size:0.92rem;color:rgba(255,255,255,0.86);margin-bottom:.45rem}
        .gd-li span:first-child{flex:0 0 auto;color:#fbbf24;line-height:1.95}
        .gd-plans{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
        @media print{
          .gd-nopr{display:none !important}
          body{background:#fff !important}
        }
      `}</style>

      {!guide && <GuideIndex onOpen={open} />}
      {guide && <GuideDetail g={guide} onBack={back} />}
    </>
  );
}

/* ─────────── 一覧 ─────────── */
function GuideIndex({ onOpen }: { onOpen: (slug: string) => void }) {
  return (
    <>
      <section className="gd-hero" style={{ padding: '4rem 1.5rem 2rem', textAlign: 'center', background: 'linear-gradient(180deg,#000 0%,#070712 100%)' }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.45em', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '1.25rem' }}>SERVICE GUIDES</p>
        <h1 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)', fontWeight: 700, lineHeight: 1.4, letterSpacing: '0.04em', marginBottom: '0.9rem' }}>
          押すと、その場で<span style={{ background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>営業資料</span>になる。
        </h1>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.9, maxWidth: 660, margin: '0 auto' }}>
          {GUIDES.length}サービス。それぞれ「誰の何を引き受けるか・できること・使い方・料金・正直なところ」まで1枚に。
          そのまま読み上げて説明できます。
        </p>
      </section>

      <div style={{ padding: '0 1.5rem 5rem', maxWidth: 1400, margin: '0 auto' }}>
        <div className="gd-grid">
          {GUIDES.map((g) => (
            <button key={g.slug} className="gd-card" onClick={() => onOpen(g.slug)} aria-label={`${g.name} の営業資料をひらく`}>
              <img
                className="gd-shot"
                src={`/lp-shots/${g.slug}.webp`}
                /* 幅640pxで撮ってある。読み込み中に高さが跳ねると、
                   下のカードを押そうとした指が別のサービスを開く。 */
                width={640}
                height={400}
                loading="lazy"
                decoding="async"
                alt={`${g.name} のトップページ`}
              />
              <div style={{ padding: '1rem 1.15rem 1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
                  <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.02em' }}>{g.name}</span>
                  <span style={{
                    fontFamily: FONT_SERIF_JA, fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)',
                    border: '1px solid rgba(255,255,255,0.22)', borderRadius: 999, padding: '2px 9px',
                  }}>{g.category}</span>
                </div>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.68)', lineHeight: 1.75, margin: 0 }}>{g.oneLine}</p>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: '#fbbf24', marginTop: '0.7rem', fontWeight: 700 }}>
                  資料をひらく →
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─────────── 詳細（＝営業資料） ─────────── */
function GuideDetail({ g, onBack }: { g: Guide; onBack: () => void }) {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.25rem 1.25rem 7rem' }}>
      <button className="gd-btn gd-nopr" onClick={onBack} style={{ marginBottom: '1.5rem' }}>← すべてのサービス</button>

      {/* 表紙 */}
      <header style={{ borderBottom: '1px solid rgba(251,191,36,0.3)', paddingBottom: '1.5rem' }}>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.72rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.6)', marginBottom: '0.6rem' }}>{g.category}</p>
        <h1 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.7rem,5vw,2.4rem)', fontWeight: 800, lineHeight: 1.35, margin: '0 0 .2rem' }}>
          {g.name}
          {g.reading && <span style={{ fontSize: '0.5em', fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginLeft: '.6rem' }}>{g.reading}</span>}
        </h1>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1rem', lineHeight: 1.9, color: 'rgba(255,255,255,0.9)', margin: '.9rem 0 0' }}>{g.oneLine}</p>
      </header>

      <img
        src={`/lp-shots/${g.slug}.webp`}
        width={640} height={400} loading="lazy" decoding="async"
        alt={`${g.name} のトップページ`}
        style={{ display: 'block', width: '100%', maxWidth: '100%', height: 'auto', borderRadius: 12, marginTop: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}
      />

      <Section title="こんな会社・こんな方に">
        {g.forWhom.map((t, i) => <Li key={i}>{t}</Li>)}
      </Section>

      <Section title="いま起きていること（そのまま切り出しに使えます）">
        {g.pains.map((t, i) => (
          <p key={i} style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.93rem', lineHeight: 1.95, color: 'rgba(255,255,255,0.82)', margin: '0 0 .75rem', paddingLeft: '.9rem', borderLeft: '2px solid rgba(255,255,255,0.18)' }}>{t}</p>
        ))}
      </Section>

      <Section title="できること">
        {g.can.map((blk) => (
          <div key={blk.group} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', fontWeight: 700, color: '#fff', margin: '0 0 .6rem' }}>{blk.group}</h3>
            {blk.items.map((t, i) => <Li key={i}>{t}</Li>)}
          </div>
        ))}
      </Section>

      <Section title="使い方（はじめかた）">
        {g.steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: '.9rem', marginBottom: '1.1rem', alignItems: 'flex-start' }}>
            <span style={{
              flex: '0 0 auto', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#1a1200', fontWeight: 800, fontSize: '0.9rem',
            }}>{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.97rem', fontWeight: 700, margin: '.3rem 0 .25rem' }}>{s.t}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.88rem', lineHeight: 1.9, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{s.d}</p>
            </div>
          </div>
        ))}
      </Section>

      <Section title="料金">
        <div className="gd-plans">
          {g.plans.map((p) => (
            <div key={p.name} style={{
              border: p.best ? '1px solid rgba(251,191,36,0.6)' : '1px solid rgba(255,255,255,0.14)',
              borderRadius: 12, padding: '1.1rem', background: p.best ? 'rgba(251,191,36,0.07)' : 'rgba(255,255,255,0.03)',
            }}>
              {p.best && <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.68rem', color: '#1a1200', background: '#fbbf24', display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontWeight: 800, margin: '0 0 .6rem' }}>おすすめ</p>}
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', fontWeight: 700, margin: '0 0 .3rem' }}>{p.name}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, margin: '0 0 .5rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{p.price}</span>
                {p.unit && <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginLeft: '.35rem' }}>{p.unit}</span>}
              </p>
              {p.note && <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.75, margin: '0 0 .7rem' }}>{p.note}</p>}
              {p.items.map((t, i) => (
                <p key={i} style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.83rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.82)', margin: '0 0 .3rem', display: 'flex', gap: '.5rem' }}>
                  <span style={{ color: '#fbbf24' }}>✓</span><span>{t}</span>
                </p>
              ))}
            </div>
          ))}
        </div>
        {g.priceNote && <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.83rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.9, marginTop: '1rem' }}>{g.priceNote}</p>}
      </Section>

      <Section title="先に言っておくこと（できていないこと）">
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.9, margin: '0 0 .9rem' }}>
          ここを先に伝えると、あとで揉めません。隠すより信用になります。
        </p>
        {g.honest.map((t, i) => <Li key={i} mark="!">{t}</Li>)}
      </Section>

      <Section title="商談で効く一言">
        {g.pitch.map((t, i) => (
          <p key={i} style={{
            fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', lineHeight: 2, color: '#fff', margin: '0 0 .9rem',
            padding: '.9rem 1.05rem', borderRadius: 10, background: 'rgba(251,191,36,0.09)', border: '1px solid rgba(251,191,36,0.28)',
          }}>{t}</p>
        ))}
      </Section>

      <div className="gd-nopr" style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginTop: '2.5rem' }}>
        {g.tryUrl && <a className="gd-btn gd-btn--gold" href={g.tryUrl} target="_blank" rel="noopener noreferrer">{g.tryLabel ?? '実物を触る'}</a>}
        <a className="gd-btn" href={g.url} target="_blank" rel="noopener noreferrer">{g.urlLabel ?? 'LPを開く'}</a>
        <button className="gd-btn" onClick={() => window.print()}>この資料を印刷 / PDF</button>
      </div>

      <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.42)', marginTop: '1.25rem', wordBreak: 'break-all' }}>
        {g.url.replace(/^https:\/\//, '')}
      </p>

      <button className="gd-btn gd-nopr" onClick={onBack} style={{ marginTop: '2rem' }}>← すべてのサービス</button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="gd-sec">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Li({ children, mark = '●' }: { children: React.ReactNode; mark?: string }) {
  return (
    <div className="gd-li">
      <span aria-hidden="true">{mark}</span>
      <span>{children}</span>
    </div>
  );
}
