// ============================================================
// CORE Studio — サイト制作・受託開発スタジオ (/studio)
// GAUCHE / Apple 的ミニマル・プレミアム。1画面完結タブ切替。
// 文言・価格は plans.ts に集約 (ここにはレイアウトだけを書く)
// ============================================================
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  STUDIO, VERTICALS, PRODUCTION_PLANS, DEV_TIERS, CARE_PLANS, WORKS, ABOUT,
  type ProductionPlan, type DevTier,
} from './plans';
import { estimate, type EstimateAnswers, type Purpose, type Scale, type Feature, type Timeline, type Budget } from './estimate';

// ---- palette ----
const C = {
  bg: '#f7f5f0',
  ink: '#23261f',
  forest: '#1e3a2e',
  gold: '#a8823c',
  sage: '#6f8074',
  line: 'rgba(35,38,31,0.14)',
  card: '#fffdf9',
};
const SERIF = '"Noto Serif JP", "游明朝", "Yu Mincho", serif';
const SANS = '"Noto Sans JP", "Inter", sans-serif';

// ---- tabs ----
type TabId = 'home' | 'plans' | 'dev' | 'care' | 'works' | 'about' | 'contact';
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'ホーム' },
  { id: 'plans', label: 'サイト制作' },
  { id: 'dev', label: '受託開発' },
  { id: 'care', label: '運用' },
  { id: 'works', label: '実績' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: '相談する' },
];

const readTabFromHash = (): TabId => {
  const h = (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '');
  return (TABS.some(t => t.id === h) ? h : 'home') as TabId;
};

// ---- 小さなラインアイコン (絵文字禁止・SVGのみ) ----
const IconCheck = ({ color = C.gold }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 4 }}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconArrow = ({ color = 'currentColor' }: { color?: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);
const IconMail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" />
  </svg>
);
const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// ============================================================
export default function StudioSite() {
  const [tab, setTab] = useState<TabId>(readTabFromHash);

  useEffect(() => {
    document.title = 'CORE Studio — サイト制作・受託開発 | 1人でチーム品質、AI-native';
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', C.bg);
    const setMeta = (name: string, content: string) => {
      let m = document.querySelector(`meta[name="${name}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute('name', name); document.head.appendChild(m); }
      m.setAttribute('content', content);
    };
    setMeta('description', 'CORE Studio — 医療歯科・音楽文化・地方創生に強い、AI-native のサイト制作・受託開発スタジオ。LP ¥5万から基幹システムまで、1人でチームの品質を。');
    const onHash = () => setTab(readTabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: TabId) => {
    setTab(t);
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', t === 'home' ? window.location.pathname : `#${t}`);
      window.scrollTo({ top: 0 });
    }
  };

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: '100dvh', fontFamily: SANS, overflowX: 'clip' }}>
      <style>{`
        .st-wrap { max-width: 720px; margin: 0 auto; padding: 0 20px calc(48px + env(safe-area-inset-bottom)); }
        .st-serif { font-family: ${SERIF}; }
        .st-tabbar { display: flex; gap: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0 16px; }
        .st-tabbar::-webkit-scrollbar { display: none; }
        .st-tab { flex-shrink: 0; min-height: 44px; padding: 10px 14px; border: none; background: none; cursor: pointer;
          font-family: ${SANS}; font-size: 13.5px; letter-spacing: 0.06em; color: ${C.sage}; border-bottom: 2px solid transparent; }
        .st-tab[data-on="true"] { color: ${C.forest}; border-bottom-color: ${C.gold}; font-weight: 600; }
        .st-card { background: ${C.card}; border: 1px solid ${C.line}; border-radius: 16px; padding: 22px 20px; }
        .st-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 12px 26px;
          border-radius: 999px; font-size: 14.5px; letter-spacing: 0.05em; cursor: pointer; text-decoration: none;
          border: 1px solid ${C.forest}; font-family: ${SANS}; }
        .st-btn-primary { background: ${C.forest}; color: #f7f5f0; }
        .st-btn-primary:active { opacity: 0.85; }
        .st-btn-ghost { background: transparent; color: ${C.forest}; }
        .st-chip { display: inline-flex; align-items: center; min-height: 44px; padding: 10px 16px; border-radius: 12px;
          border: 1px solid ${C.line}; background: ${C.card}; color: ${C.ink}; font-size: 14px; cursor: pointer; font-family: ${SANS}; text-align: left; }
        .st-chip[data-on="true"] { border-color: ${C.forest}; background: ${C.forest}; color: #f7f5f0; }
        .st-grid2 { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 640px) { .st-grid2 { grid-template-columns: 1fr 1fr; } }
        .st-worklink { color: ${C.forest}; }
        .st-worklink:active { opacity: 0.7; }
        a { -webkit-tap-highlight-color: rgba(168,130,60,0.15); }
      `}</style>

      {/* ヘッダー */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(247,245,240,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.line}`, paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', maxWidth: 720, margin: '0 auto', padding: '14px 20px 8px' }}>
          <button onClick={() => go('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
            <span className="st-serif" style={{ fontSize: 19, fontWeight: 600, letterSpacing: '0.08em', color: C.forest }}>CORE <span style={{ color: C.gold }}>Studio</span></span>
          </button>
          <a href="/corp" style={{ fontSize: 12, color: C.sage, textDecoration: 'none', letterSpacing: '0.06em', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>CORE本体へ</a>
        </div>
        <nav className="st-tabbar" aria-label="スタジオ内メニュー">
          {TABS.map(t => (
            <button key={t.id} className="st-tab" data-on={tab === t.id} onClick={() => go(t.id)}>{t.label}</button>
          ))}
        </nav>
      </header>

      <main className="st-wrap">
        {tab === 'home' && <HomeTab go={go} />}
        {tab === 'plans' && <PlansTab go={go} />}
        {tab === 'dev' && <DevTab go={go} />}
        {tab === 'care' && <CareTab go={go} />}
        {tab === 'works' && <WorksTab />}
        {tab === 'about' && <AboutTab go={go} />}
        {tab === 'contact' && <ContactTab />}
      </main>

      {/* フッター */}
      <footer style={{ borderTop: `1px solid ${C.line}`, padding: '28px 20px calc(28px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
        <div className="st-serif" style={{ fontSize: 14, letterSpacing: '0.12em', color: C.forest, marginBottom: 6 }}>CORE Studio</div>
        <a href={`mailto:${STUDIO.email}`} style={{ fontSize: 12.5, color: C.sage, textDecoration: 'underline' }}>{STUDIO.email}</a>
        <div style={{ fontSize: 11, color: C.sage, marginTop: 10, letterSpacing: '0.04em' }}>CORE（設立準備中）・運営 井出直毅</div>
      </footer>
    </div>
  );
}

// ---- 共通見出し ----
const H2 = ({ children, sub }: { children: ReactNode; sub?: string }) => (
  <div style={{ margin: '36px 0 18px' }}>
    <h2 className="st-serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.5, letterSpacing: '0.04em', color: C.forest, margin: 0 }}>{children}</h2>
    {sub && <p style={{ fontSize: 13.5, color: C.sage, margin: '8px 0 0', lineHeight: 1.8 }}>{sub}</p>}
  </div>
);

// ============================================================
// ホーム
// ============================================================
function HomeTab({ go }: { go: (t: TabId) => void }) {
  return (
    <div>
      {/* ヒーロー */}
      <section style={{ padding: '56px 0 40px', textAlign: 'left' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.28em', color: C.gold, marginBottom: 16 }}>WEB PRODUCTION & DEVELOPMENT</div>
        <h1 className="st-serif" style={{ fontSize: 'clamp(30px, 8.5vw, 44px)', fontWeight: 600, lineHeight: 1.45, letterSpacing: '0.03em', margin: 0, color: C.ink }}>
          1人で、<br />チームの品質を。
        </h1>
        <p style={{ fontSize: 15, lineHeight: 2, color: C.ink, margin: '22px 0 0', maxWidth: 480 }}>
          AI-native の制作スタジオ。打ち合わせから設計・デザイン・実装・運用まで、最初に話した人間が最後まで作ります。だから速く、ぶれず、美しい。
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 30, flexWrap: 'wrap' }}>
          <button className="st-btn st-btn-primary" onClick={() => go('contact')}>見積を試す</button>
          <button className="st-btn st-btn-ghost" onClick={() => go('works')}>実績を見る</button>
        </div>
      </section>

      {/* 3つの縦 */}
      <H2 sub="経歴がそのまま強みになる、3つの領域。">得意な領域</H2>
      <div style={{ display: 'grid', gap: 14 }}>
        {VERTICALS.map(v => (
          <div key={v.id} className="st-card">
            <div className="st-serif" style={{ fontSize: 17, fontWeight: 600, color: C.forest }}>{v.title}</div>
            <div style={{ fontSize: 13.5, color: C.gold, margin: '4px 0 10px', letterSpacing: '0.04em' }}>{v.copy}</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.9, color: C.ink, margin: 0 }}>{v.detail}</p>
          </div>
        ))}
      </div>

      {/* プラン概要 */}
      <H2 sub="サイト制作は4プラン、アプリ開発は4Tier。すべて追加費用なしの一括見積り。">料金の全体像</H2>
      <div className="st-grid2">
        <button onClick={() => go('plans')} className="st-card" style={{ cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: SANS }}>
          <div style={{ fontSize: 12, letterSpacing: '0.2em', color: C.gold }}>WEBSITE</div>
          <div className="st-serif" style={{ fontSize: 18, fontWeight: 600, color: C.forest, margin: '6px 0' }}>サイト制作</div>
          <div style={{ fontSize: 14, color: C.ink }}>¥5万 〜 ¥100万+</div>
          <div style={{ fontSize: 12.5, color: C.sage, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>4プランを見る <IconArrow /></div>
        </button>
        <button onClick={() => go('dev')} className="st-card" style={{ cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: SANS }}>
          <div style={{ fontSize: 12, letterSpacing: '0.2em', color: C.gold }}>DEVELOPMENT</div>
          <div className="st-serif" style={{ fontSize: 18, fontWeight: 600, color: C.forest, margin: '6px 0' }}>受託開発</div>
          <div style={{ fontSize: 14, color: C.ink }}>¥50万 〜 ¥3,000万</div>
          <div style={{ fontSize: 12.5, color: C.sage, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>4Tierを見る <IconArrow /></div>
        </button>
      </div>

      {/* 実績ダイジェスト */}
      <H2 sub="すべて公開中の実サイト。触って確かめられます。">実績</H2>
      <div style={{ display: 'grid', gap: 10 }}>
        {WORKS.slice(0, 3).map(w => (
          <a key={w.id} href={w.url} target="_blank" rel="noopener noreferrer" className="st-card st-worklink" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div className="st-serif" style={{ fontSize: 15.5, fontWeight: 600, color: C.forest }}>{w.name}</div>
              <div style={{ fontSize: 12.5, color: C.sage, marginTop: 3 }}>{w.copy}</div>
            </div>
            <IconArrow color={C.gold} />
          </a>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <button className="st-btn st-btn-ghost" onClick={() => go('works')}>すべての実績を見る</button>
      </div>

      {/* CTA */}
      <section className="st-card" style={{ marginTop: 44, textAlign: 'center', padding: '34px 20px', background: C.forest, border: 'none' }}>
        <div className="st-serif" style={{ fontSize: 20, fontWeight: 600, color: '#f7f5f0', lineHeight: 1.7 }}>60秒で、概算がわかります。</div>
        <p style={{ fontSize: 13.5, color: 'rgba(247,245,240,0.75)', margin: '10px 0 20px', lineHeight: 1.8 }}>6つの質問に答えるだけ。営業連絡は一切ありません。</p>
        <button className="st-btn" style={{ background: C.gold, color: '#fffdf9', borderColor: C.gold }} onClick={() => go('contact')}>見積ウィザードを始める</button>
      </section>
    </div>
  );
}

// ============================================================
// サイト制作 4プラン
// ============================================================
function PlanCard({ p }: { p: ProductionPlan }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  return (
    <div className="st-card" style={p.featured ? { borderColor: C.gold, boxShadow: '0 0 0 1px ' + C.gold } : undefined}>
      {p.featured && <div style={{ fontSize: 11, letterSpacing: '0.2em', color: C.gold, marginBottom: 6 }}>いちばん選ばれています</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div className="st-serif" style={{ fontSize: 21, fontWeight: 600, color: C.forest }}>{p.name}</div>
        <div className="st-serif" style={{ fontSize: 18, color: C.ink }}>{p.price}</div>
      </div>
      <div style={{ fontSize: 14, color: C.gold, margin: '6px 0 12px', letterSpacing: '0.03em' }}>{p.lead}</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: '0 0 6px', color: C.ink }}>{p.scope}</p>
      <div style={{ fontSize: 12.5, color: C.sage, marginBottom: 14 }}>納期の目安 — {p.duration}</div>
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.14em', color: C.sage, marginBottom: 8 }}>含まれるもの</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {p.includes.map(i => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7 }}><IconCheck />{i}</li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 14, background: 'rgba(111,128,116,0.09)', borderRadius: 10, padding: '10px 14px', fontSize: 13, lineHeight: 1.8 }}>
        <span style={{ color: C.sage }}>向いている方 — </span>{p.bestFor}
      </div>
      <div style={{ marginTop: 14 }}>
        {p.faq.map((f, i) => (
          <div key={f.q} style={{ borderTop: `1px solid ${C.line}` }}>
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
              style={{ width: '100%', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '10px 0', fontSize: 13.5, color: C.forest, fontFamily: SANS, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>Q. {f.q}</span><span style={{ color: C.gold, fontSize: 16, lineHeight: 1 }}>{openFaq === i ? '−' : '+'}</span>
            </button>
            {openFaq === i && <p style={{ fontSize: 13, lineHeight: 1.9, color: C.ink, margin: '0 0 12px' }}>{f.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlansTab({ go }: { go: (t: TabId) => void }) {
  const [sel, setSel] = useState(1); // 既定は Core
  const p = PRODUCTION_PLANS[sel];
  return (
    <div>
      <H2 sub="1枚のLPから、ブランド全体まで。どのプランも追加費用なしの一括見積りです。">サイト制作 — 4つのプラン</H2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {PRODUCTION_PLANS.map((pp, i) => (
          <button key={pp.id} className="st-chip" data-on={sel === i} onClick={() => setSel(i)}>
            {pp.name}<span style={{ marginLeft: 6, fontSize: 12, opacity: 0.75 }}>{pp.price}</span>
          </button>
        ))}
      </div>
      <PlanCard p={p} />
      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <button className="st-btn st-btn-primary" onClick={() => go('contact')}>このプランで相談する</button>
      </div>
    </div>
  );
}

// ============================================================
// 受託開発 4Tier
// ============================================================
function TierCard({ t }: { t: DevTier }) {
  return (
    <div className="st-card">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div className="st-serif" style={{ fontSize: 21, fontWeight: 600, color: C.forest }}>{t.name}</div>
        <div className="st-serif" style={{ fontSize: 18, color: C.ink }}>{t.price}</div>
      </div>
      <div style={{ fontSize: 14, color: C.gold, margin: '6px 0 12px', letterSpacing: '0.03em' }}>{t.lead}</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: '0 0 6px', color: C.ink }}>{t.scope}</p>
      <div style={{ fontSize: 12.5, color: C.sage, marginBottom: 14 }}>期間の目安 — {t.duration}</div>
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.14em', color: C.sage, marginBottom: 8 }}>作れるものの例</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {t.examples.map(e => (
            <li key={e} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7 }}><IconCheck color={C.sage} />{e}</li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 14, background: 'rgba(168,130,60,0.08)', borderRadius: 10, padding: '10px 14px', fontSize: 13, lineHeight: 1.8 }}>
        <span style={{ color: C.gold }}>価格の考え方 — </span>{t.pricing}
      </div>
    </div>
  );
}

function DevTab({ go }: { go: (t: TabId) => void }) {
  const [sel, setSel] = useState(0);
  return (
    <div>
      <H2 sub="AI-native 開発だから、従来の開発会社より速く・安く・柔らかく。要件が固まっていなくても相談できます。">受託開発 — 4つのTier</H2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {DEV_TIERS.map((t, i) => (
          <button key={t.id} className="st-chip" data-on={sel === i} onClick={() => setSel(i)}>{t.name}</button>
        ))}
      </div>
      <TierCard t={DEV_TIERS[sel]} />
      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <button className="st-btn st-btn-primary" onClick={() => go('contact')}>開発について相談する</button>
      </div>
    </div>
  );
}

// ============================================================
// 運用サブスク
// ============================================================
function CareTab({ go }: { go: (t: TabId) => void }) {
  return (
    <div>
      <H2 sub="作って終わりにしない。公開後も数値を見て磨き続けます。">運用 — 月額プラン</H2>
      <div style={{ display: 'grid', gap: 14 }}>
        {CARE_PLANS.map(cp => (
          <div key={cp.id} className="st-card">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div className="st-serif" style={{ fontSize: 19, fontWeight: 600, color: C.forest }}>{cp.name}</div>
              <div className="st-serif" style={{ fontSize: 16, color: C.ink }}>{cp.price}</div>
            </div>
            <div style={{ fontSize: 13.5, color: C.gold, margin: '6px 0 12px' }}>{cp.lead}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {cp.includes.map(i => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7 }}><IconCheck />{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <button className="st-btn st-btn-primary" onClick={() => go('contact')}>運用について相談する</button>
      </div>
    </div>
  );
}

// ============================================================
// Works
// ============================================================
function WorksTab() {
  const cats = ['企業サイト', 'アプリ', '個人'] as const;
  return (
    <div>
      <H2 sub="すべて実際に公開・稼働しているサイトとアプリです。">実績</H2>
      {cats.map(cat => {
        const list = WORKS.filter(w => w.category === cat);
        if (!list.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 12, letterSpacing: '0.2em', color: C.gold, marginBottom: 10 }}>{cat}</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {list.map(w => (
                <div key={w.id} className="st-card">
                  <div className="st-serif" style={{ fontSize: 17, fontWeight: 600, color: C.forest }}>{w.name}</div>
                  <p style={{ fontSize: 13.5, lineHeight: 1.9, color: C.ink, margin: '8px 0 14px' }}>{w.copy}</p>
                  <a className="st-worklink" href={w.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, textDecoration: 'none', borderBottom: `1px solid ${C.gold}`, paddingBottom: 2, minHeight: 44 }}>
                    サイトを見る <IconArrow color={C.gold} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// About
// ============================================================
function AboutTab({ go }: { go: (t: TabId) => void }) {
  return (
    <div>
      <H2>{ABOUT.title}</H2>
      <div className="st-card">
        <div className="st-serif" style={{ fontSize: 20, fontWeight: 600, color: C.forest }}>{ABOUT.name}</div>
        <div style={{ fontSize: 12.5, letterSpacing: '0.16em', color: C.gold, margin: '4px 0 18px' }}>{ABOUT.alias}</div>
        {ABOUT.story.map(s => (
          <p key={s.slice(0, 12)} style={{ fontSize: 14, lineHeight: 2.1, color: C.ink, margin: '0 0 16px' }}>{s}</p>
        ))}
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16, display: 'grid', gap: 8 }}>
          {ABOUT.facts.map(f => (
            <div key={f.label} style={{ display: 'flex', gap: 14, fontSize: 13.5 }}>
              <span style={{ color: C.sage, minWidth: 44 }}>{f.label}</span>
              <span>{f.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <button className="st-btn st-btn-primary" onClick={() => go('contact')}>話してみる</button>
      </div>
    </div>
  );
}

// ============================================================
// 問い合わせ — 見積ウィザード + mailto
// ============================================================
type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 6 = 結果

const PURPOSES: Array<{ v: Purpose; label: string }> = [
  { v: 'lp', label: '集客LP (1ページ)' },
  { v: 'corporate', label: 'コーポレートサイト' },
  { v: 'ec', label: 'EC・オンライン販売' },
  { v: 'webapp', label: 'Webアプリ・業務ツール' },
  { v: 'saas', label: 'SaaS・本格プロダクト' },
];
const SCALES: Array<{ v: Scale; label: string }> = [
  { v: 'small', label: '小さく (〜5ページ/画面)' },
  { v: 'medium', label: '標準 (〜15ページ/画面)' },
  { v: 'large', label: '大きく (それ以上)' },
];
const FEATURES: Array<{ v: Feature; label: string }> = [
  { v: 'booking', label: '予約' },
  { v: 'payment', label: '決済' },
  { v: 'auth', label: 'ログイン・会員' },
  { v: 'ai', label: 'AI機能' },
  { v: 'multilingual', label: '多言語' },
];
const TIMELINES: Array<{ v: Timeline; label: string }> = [
  { v: 'asap', label: '2週間以内 (特急)' },
  { v: 'normal', label: '1〜2ヶ月' },
  { v: 'flexible', label: '3ヶ月以上・柔軟' },
];
const BUDGETS: Array<{ v: Budget; label: string }> = [
  { v: 'u10', label: '〜10万円' },
  { v: 'u30', label: '〜30万円' },
  { v: 'u100', label: '〜100万円' },
  { v: 'u500', label: '〜500万円' },
  { v: 'over500', label: '500万円以上' },
  { v: 'unknown', label: 'まだわからない' },
];

const labelOf = <T extends string>(list: Array<{ v: T; label: string }>, v: T) => list.find(x => x.v === v)?.label ?? String(v);

function ContactTab() {
  const [step, setStep] = useState<WizardStep>(0);
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [scale, setScale] = useState<Scale | null>(null);
  const [cms, setCms] = useState<boolean | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [copied, setCopied] = useState(false);

  const answers: EstimateAnswers | null = useMemo(() => {
    if (!purpose || !scale || cms === null || !timeline || !budget) return null;
    return { purpose, scale, cms, features, timeline, budget };
  }, [purpose, scale, cms, features, timeline, budget]);

  const result = useMemo(() => (answers ? estimate(answers) : null), [answers]);

  const summaryText = useMemo(() => {
    if (!answers || !result) return '';
    return [
      '【CORE Studio 見積ウィザードの回答】',
      `・目的: ${labelOf(PURPOSES, answers.purpose)}`,
      `・規模: ${labelOf(SCALES, answers.scale)}`,
      `・CMS(自分で更新): ${answers.cms ? '必要' : '不要'}`,
      `・機能: ${answers.features.length ? answers.features.map(f => labelOf(FEATURES, f)).join(' / ') : 'なし'}`,
      `・希望納期: ${labelOf(TIMELINES, answers.timeline)}`,
      `・予算感: ${labelOf(BUDGETS, answers.budget)}`,
      '',
      `【概算結果】${result.plan} プラン / ¥${result.minPrice}万〜¥${result.maxPrice}万`,
      '',
      '(このままご送信ください。1営業日以内にお返事します)',
    ].join('\n');
  }, [answers, result]);

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent('【CORE Studio】制作のご相談');
    const body = encodeURIComponent(summaryText + '\n\n--- ご自由に追記ください ---\nお名前: \n事業内容: \n');
    return `mailto:${STUDIO.email}?subject=${subject}&body=${body}`;
  }, [summaryText]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(`宛先: ${STUDIO.email}\n\n${summaryText}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 不許可環境では選択用に prompt
      window.prompt('以下をコピーしてメールでお送りください', `${STUDIO.email} / ${summaryText.replace(/\n/g, ' ')}`);
    }
  };

  const stepDefs: Array<{ title: string; body: ReactNode }> = [
    {
      title: '作りたいものは?',
      body: <ChoiceGrid items={PURPOSES} value={purpose} onPick={v => { setPurpose(v); setStep(1); }} />,
    },
    {
      title: '規模の感覚は?',
      body: <ChoiceGrid items={SCALES} value={scale} onPick={v => { setScale(v); setStep(2); }} />,
    },
    {
      title: '自分で更新したいですか? (CMS)',
      body: (
        <ChoiceGrid
          items={[{ v: 'yes', label: 'はい — お知らせ等を自分で更新したい' }, { v: 'no', label: 'いいえ — 更新はお任せしたい' }]}
          value={cms === null ? null : cms ? 'yes' : 'no'}
          onPick={v => { setCms(v === 'yes'); setStep(3); }}
        />
      ),
    },
    {
      title: '必要な機能は? (複数可・なければそのまま次へ)',
      body: (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FEATURES.map(f => (
              <button key={f.v} className="st-chip" data-on={features.includes(f.v)}
                onClick={() => setFeatures(prev => prev.includes(f.v) ? prev.filter(x => x !== f.v) : [...prev, f.v])}>
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="st-btn st-btn-primary" onClick={() => setStep(4)}>次へ</button>
          </div>
        </div>
      ),
    },
    {
      title: '希望の納期は?',
      body: <ChoiceGrid items={TIMELINES} value={timeline} onPick={v => { setTimeline(v); setStep(5); }} />,
    },
    {
      title: 'ご予算の感覚は?',
      body: <ChoiceGrid items={BUDGETS} value={budget} onPick={v => { setBudget(v); setStep(6); }} />,
    },
  ];

  if (step === 6 && result) {
    return (
      <div>
        <H2 sub="回答から自動算出した概算です。正式なお見積りはヒアリング後に固定します。">概算結果</H2>
        <div className="st-card" style={{ borderColor: C.gold, textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.22em', color: C.sage }}>おすすめプラン</div>
          <div className="st-serif" style={{ fontSize: 30, fontWeight: 600, color: C.forest, margin: '8px 0 2px' }}>{result.plan}</div>
          <div style={{ fontSize: 12.5, color: C.sage }}>{result.kind === 'dev' ? '受託開発' : 'サイト制作'}</div>
          <div className="st-serif" style={{ fontSize: 24, color: C.ink, margin: '18px 0 4px' }}>
            ¥{result.minPrice}万 <span style={{ fontSize: 15, color: C.sage }}>〜</span> ¥{result.maxPrice}万
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.9, color: C.ink, margin: '16px 0 0', textAlign: 'left', background: 'rgba(111,128,116,0.09)', borderRadius: 10, padding: '12px 14px' }}>{result.note}</p>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          <a className="st-btn st-btn-primary" href={mailtoHref} style={{ width: '100%', boxSizing: 'border-box' }}>
            <IconMail /> この内容で相談する (メールが開きます)
          </a>
          <button className="st-btn st-btn-ghost" onClick={copySummary} style={{ width: '100%', boxSizing: 'border-box' }}>
            <IconCopy /> {copied ? 'コピーしました' : '内容をコピーする (メールが開かない方)'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: C.sage, lineHeight: 1.9, marginTop: 14, textAlign: 'center' }}>
          送信先: {STUDIO.email}<br />メールが開かない場合は「内容をコピー」して、お使いのメールアプリから貼り付けてお送りください。
        </p>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button onClick={() => { setStep(0); setPurpose(null); setScale(null); setCms(null); setFeatures([]); setTimeline(null); setBudget(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: C.sage, textDecoration: 'underline', minHeight: 44, fontFamily: SANS }}>
            最初からやり直す
          </button>
        </div>
      </div>
    );
  }

  const def = stepDefs[step];
  return (
    <div>
      <H2 sub="6つの質問で、最適なプランと概算がその場でわかります。">見積ウィザード</H2>
      {/* 進捗 */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
        {stepDefs.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? C.gold : C.line }} />
        ))}
      </div>
      <div className="st-card">
        <div style={{ fontSize: 12, letterSpacing: '0.14em', color: C.sage, marginBottom: 8 }}>質問 {step + 1} / {stepDefs.length}</div>
        <div className="st-serif" style={{ fontSize: 18, fontWeight: 600, color: C.forest, marginBottom: 16, lineHeight: 1.6 }}>{def.title}</div>
        {def.body}
        {step > 0 && (
          <button onClick={() => setStep((step - 1) as WizardStep)}
            style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: C.sage, textDecoration: 'underline', minHeight: 44, padding: 0, fontFamily: SANS }}>
            ひとつ戻る
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: C.sage, marginTop: 14, lineHeight: 1.9, textAlign: 'center' }}>
        ウィザードを使わず直接の相談も歓迎です — <a href={`mailto:${STUDIO.email}?subject=${encodeURIComponent('【CORE Studio】ご相談')}`} style={{ color: C.forest }}>{STUDIO.email}</a>
      </p>
    </div>
  );
}

function ChoiceGrid<T extends string>({ items, value, onPick }: {
  items: Array<{ v: T; label: string }>;
  value: T | null;
  onPick: (v: T) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map(it => (
        <button key={it.v} className="st-chip" data-on={value === it.v} onClick={() => onPick(it.v)} style={{ width: '100%' }}>
          {it.label}
        </button>
      ))}
    </div>
  );
}
