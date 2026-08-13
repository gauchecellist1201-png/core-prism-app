// ============================================================
// CORE Studio — ウェブ制作・受託開発 (/studio)
// 白基調・法人トーン。背景 #FFFFFF / 交互セクション #F7F7F5、
// 文字 #111827 系、金 #A8823C は線・ラベル・ホバーのみ少量。
// 見出し Noto Serif JP・本文サンセリフ。CTAは濃色ボタン。
// 文言・価格は plans.ts に集約 (ここにはレイアウトだけを書く)
// ============================================================
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  STUDIO, STATS, REASONS, PROCESS, PRODUCTION_PLANS, DEV_LEAD, DEV_TIERS,
  CARE_PLANS, WORKS, COMPANY,
  type ProductionPlan, type DevTier,
} from './plans';
import { CONTACT } from './plans';
import { FILM } from './film';
import { estimate, type EstimateAnswers, type Purpose, type Scale, type Feature, type Timeline, type Budget } from './estimate';
import { C, D, SERIF, SANS } from './theme';
import { Band, H2, Note, IconCheck, IconArrow, IconChat, IconCopy } from './ui';
import { logEvent } from '../lib/onboardingAnalytics';

const FilmTab = lazy(() => import('./FilmTab'));

// ---- tabs ----
type TabId = 'home' | 'film' | 'plans' | 'dev' | 'care' | 'works' | 'about' | 'contact';
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'ホーム' },
  { id: 'film', label: '映像制作' },
  { id: 'plans', label: 'サイト制作' },
  { id: 'dev', label: '受託開発' },
  { id: 'care', label: '運用' },
  { id: 'works', label: '実績' },
  { id: 'about', label: '会社案内' },
  { id: 'contact', label: 'お問い合わせ' },
];

const isTabId = (v: string): v is TabId => TABS.some(t => t.id === v);

// /studio/film のようなパスと、従来の /studio#film の両方を受ける。
// ハッシュはサーバーにもクローラーにも届かないので、以後は必ずパス側に正規化する。
const readTab = (): TabId => {
  if (typeof window === 'undefined') return 'home';
  const seg = window.location.pathname.replace(/^\/studio\/?/, '').replace(/\/$/, '');
  if (isTabId(seg)) return seg;
  const h = window.location.hash.replace('#', '');
  return isTabId(h) ? h : 'home';
};

const pathOf = (t: TabId) => (t === 'home' ? '/studio' : `/studio/${t}`);

// ---- タブごとの title / description (映像は検索の入口が別なので分ける) ----
// 正本は studio.html / studio-film.html の静的メタ。ここを変えたら向こうも合わせる。
const SEO = {
  ogImage: 'https://core-prism-app.vercel.app/og-studio-film-v1.png',
  default: {
    title: 'CORE Studio — 成果から逆算する、ウェブ制作と受託開発',
    description: 'COREは、AIプロダクトを自社で開発・運営する制作スタジオです。戦略設計からデザイン・実装・公開後の運用改善まで一貫体制で、貴社の事業を前に進めるウェブをつくります。',
  },
  film: {
    title: 'AI動画制作・ショートドラマ制作代行 — CORE Studio',
    description: 'ショートドラマ、ブランドムービー、SNS縦型動画、CMまで。企画・脚本・映像制作・編集・字幕・SNS最適化までを一貫制作するAIクリエイティブスタジオ。初回1本¥29,800、毎月継続は月4本¥198,000から。初期費用0円・最低契約期間なし。',
  },
};

// ============================================================
export default function StudioSite() {
  const [tab, setTab] = useState<TabId>(readTab);

  useEffect(() => {
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', tab === 'film' ? D.bg : C.bg);

    const setMeta = (name: string, content: string) => {
      let m = document.querySelector(`meta[name="${name}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute('name', name); document.head.appendChild(m); }
      m.setAttribute('content', content);
    };
    const setProp = (property: string, content: string) => {
      let m = document.querySelector(`meta[property="${property}"]`);
      if (!m) { m = document.createElement('meta'); m.setAttribute('property', property); document.head.appendChild(m); }
      m.setAttribute('content', content);
    };

    const seo = tab === 'film' ? SEO.film : SEO.default;
    // SNSのカードを出すクローラーはJSを実行しないので、本命は studio.html / studio-film.html の
    // 静的メタ (vercel.json の rewrite で配信) 側。ここは画面遷移した後の表示を合わせるための追従。
    // 一部だけ書き換えるとPrism本体のOGが混ざるので、SNSタグは一式そろえて差し替える。
    const url = `https://core-prism-app.vercel.app${pathOf(tab)}`;
    document.title = seo.title;
    setMeta('description', seo.description);
    setProp('og:title', seo.title);
    setProp('og:description', seo.description);
    setProp('og:url', url);
    setProp('og:site_name', 'CORE Studio');
    setProp('og:image', SEO.ogImage);
    setProp('og:image:alt', seo.title);
    setMeta('twitter:title', seo.title);
    setMeta('twitter:description', seo.description);
    setMeta('twitter:image', SEO.ogImage);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.setAttribute('rel', 'canonical'); document.head.appendChild(canonical); }
    canonical.setAttribute('href', url);
  }, [tab]);

  // Service の構造化データ (SPAなので実行時に差し込む。離脱時に必ず片付ける)
  useEffect(() => {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'studio-jsonld';
    el.textContent = JSON.stringify(studioJsonLd());
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  useEffect(() => {
    const sync = () => setTab(readTab());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);

  const go = (t: TabId) => {
    setTab(t);
    if (typeof window !== 'undefined') {
      history.pushState(null, '', pathOf(t));
      window.scrollTo({ top: 0 });
    }
  };

  return (
    <div style={{ background: C.bg, color: C.body, minHeight: '100dvh', fontFamily: SANS, overflowX: 'clip' }}>
      <style>{`
        .st-inner { max-width: 760px; margin: 0 auto; padding-left: 20px; padding-right: 20px; }
        .st-serif { font-family: ${SERIF}; }
        /* 金は白地で 3.55:1 しかないので、文字には goldText を使う (暗部では D.gold を上書き指定) */
        .st-label { font-family: ${SANS}; font-size: 11px; font-weight: 600; letter-spacing: 0.28em; text-transform: uppercase; color: ${C.goldText}; }
        .st-tabbar { display: flex; gap: 2px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding: 0 12px; }
        .st-tabbar::-webkit-scrollbar { display: none; }
        .st-tab { flex-shrink: 0; min-height: 46px; padding: 12px 13px; border: none; background: none; cursor: pointer;
          font-family: ${SANS}; font-size: 13.5px; letter-spacing: 0.04em; color: ${C.mute}; border-bottom: 2px solid transparent; }
        .st-tab:hover { color: ${C.ink}; }
        .st-tab[data-on="true"] { color: ${C.ink}; border-bottom-color: ${C.gold}; font-weight: 700; }
        .st-card { background: #FFFFFF; border: 1px solid ${C.line}; border-radius: 14px; padding: 24px 22px; }
        .st-card-featured { border: 1.5px solid ${C.goldLine}; box-shadow: 0 12px 32px -20px rgba(17,24,39,0.25); }
        .st-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 50px; padding: 13px 30px;
          border-radius: 6px; font-size: 14.5px; font-weight: 700; letter-spacing: 0.05em; cursor: pointer; text-decoration: none;
          font-family: ${SANS}; transition: opacity 160ms ease, border-color 160ms ease; }
        .st-btn-primary { background: ${C.dark}; color: #FFFFFF; border: 1px solid ${C.dark}; }
        .st-btn-primary:hover { opacity: 0.88; }
        .st-btn-ghost { background: #FFFFFF; color: ${C.ink}; border: 1px solid #C9CDD4; font-weight: 600; }
        .st-btn-ghost:hover { border-color: ${C.gold}; color: ${C.ink}; }
        .st-chip { display: inline-flex; align-items: center; min-height: 46px; padding: 11px 16px; border-radius: 8px;
          border: 1px solid #C9CDD4; background: #FFFFFF; color: ${C.body}; font-size: 14px; cursor: pointer; font-family: ${SANS}; text-align: left;
          transition: border-color 140ms ease; }
        .st-chip:hover { border-color: ${C.gold}; }
        .st-chip[data-on="true"] { border: 1.5px solid ${C.gold}; background: #FBF8F2; color: ${C.ink}; font-weight: 600; }
        .st-grid2 { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 640px) { .st-grid2 { grid-template-columns: 1fr 1fr; } }
        .st-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: ${C.line}; border: 1px solid ${C.line}; border-radius: 12px; overflow: hidden; }
        @media (min-width: 640px) { .st-stats { grid-template-columns: repeat(4, 1fr); } }
        .st-worklink { color: ${C.ink}; }
        .st-worklink:hover { color: ${C.gold}; }
        a { -webkit-tap-highlight-color: rgba(168,130,60,0.15); }
      `}</style>

      {/* ヘッダー */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.line}`, paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 760, margin: '0 auto', padding: '15px 20px 9px' }}>
          <button onClick={() => go('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
            <span className="st-serif" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.16em', color: C.ink }}>CORE <span style={{ color: C.goldText }}>STUDIO</span></span>
          </button>
          <a href="/corp" style={{ fontSize: 12, color: C.mute, textDecoration: 'none', letterSpacing: '0.05em', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>CORE公式サイト</a>
        </div>
        <nav className="st-tabbar" style={{ maxWidth: 760, margin: '0 auto' }} aria-label="スタジオ内メニュー">
          {TABS.map(t => (
            <button key={t.id} className="st-tab" data-on={tab === t.id} onClick={() => go(t.id)}>{t.label}</button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'home' && <HomeTab go={go} />}
        {tab === 'film' && (
          <Suspense fallback={<div style={{ background: D.bg, minHeight: '60dvh' }} />}>
            <FilmTab />
          </Suspense>
        )}
        {tab === 'plans' && <PlansTab go={go} />}
        {tab === 'dev' && <DevTab go={go} />}
        {tab === 'care' && <CareTab />}
        {tab === 'works' && <WorksTab />}
        {tab === 'about' && <AboutTab />}
        {tab === 'contact' && <ContactTab />}
      </main>

      {/* フッター */}
      <footer style={{ borderTop: `1px solid ${C.line}`, background: C.alt, padding: '32px 20px calc(32px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
        <div className="st-serif" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.2em', color: C.ink, marginBottom: 8 }}>CORE STUDIO</div>
        <a href={`mailto:${STUDIO.email}`} style={{ fontSize: 12.5, color: C.mute, textDecoration: 'underline', minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 8px' }}>{STUDIO.email}</a>
        <div style={{ fontSize: 11.5, color: C.mute, marginTop: 10, letterSpacing: '0.04em', lineHeight: 1.9 }}>
          CORE（設立準備中）<br />代表 井出直毅
        </div>
      </footer>
    </div>
  );
}

// ---- 相談導線 (どのタブでも入口はLINEに統一する) ----
const LineCta = ({ label = CONTACT.lineLabel, where }: { label?: string; where: string }) => (
  <a className="st-btn st-btn-primary" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
    onClick={() => logEvent('studio_line_cta', { where })}>
    <IconChat /> {label}
  </a>
);

// ---- 構造化データ (提供サービスの一覧。価格は film.ts / plans.ts の実値に合わせる) ----
function studioJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'CORE Studio',
    url: STUDIO.url,
    email: STUDIO.email,
    areaServed: 'JP',
    description: SEO.default.description,
    makesOffer: [
      {
        '@type': 'Offer',
        name: 'AI動画制作・ショートドラマ制作代行',
        description: 'ショートドラマ・ブランドムービー・SNS縦型動画・CMの企画から脚本・映像制作・編集・字幕・SNS最適化までの一貫制作。',
        priceCurrency: 'JPY',
        price: '29800',
        url: `${STUDIO.url}#film`,
      },
      {
        '@type': 'Offer',
        name: 'ウェブサイト制作',
        description: 'LPからコーポレートサイト、予約・決済を備えた本格サイトまでの制作。',
        priceCurrency: 'JPY',
        price: '50000',
        url: `${STUDIO.url}#plans`,
      },
      {
        '@type': 'Offer',
        name: 'システム受託開発',
        description: 'MVPからSaaS・基幹システムまでのアプリケーション開発。',
        priceCurrency: 'JPY',
        price: '500000',
        url: `${STUDIO.url}#dev`,
      },
    ],
  };
}

// ============================================================
// ホーム
// ============================================================
function HomeTab({ go }: { go: (t: TabId) => void }) {
  return (
    <div>
      {/* ヒーロー */}
      <Band pad="60px 0 48px">
        <div className="st-label" style={{ marginBottom: 18 }}>Web Production &amp; Development</div>
        <h1 className="st-serif" style={{ fontSize: 'clamp(27px, 7vw, 40px)', fontWeight: 700, lineHeight: 1.55, letterSpacing: '0.02em', margin: 0, color: C.ink }}>
          成果から逆算する、<br />ウェブ制作と受託開発。
        </h1>
        <p style={{ fontSize: 15, lineHeight: 2.1, color: C.body, margin: '22px 0 0', maxWidth: 600 }}>
          COREは、AIプロダクトを自社で開発・運営する制作スタジオです。
          戦略設計からデザイン、実装、公開後の運用改善まで一貫体制で、貴社の事業を前に進めるウェブをつくります。
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 30, flexWrap: 'wrap' }}>
          <LineCta where="home-hero" />
          <button className="st-btn st-btn-ghost" onClick={() => go('works')}>実績を見る</button>
        </div>

        {/* 数字バー */}
        <div className="st-stats" style={{ marginTop: 44 }}>
          {STATS.map(s => (
            <div key={s.label} style={{ background: '#FFFFFF', padding: '18px 14px', textAlign: 'center' }}>
              <div className="st-serif" style={{ fontSize: 22, fontWeight: 700, color: C.ink, letterSpacing: '0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: C.mute, marginTop: 4, letterSpacing: '0.04em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Band>

      {/* 映像制作への入口 — 白基調のサイトの中で、ここだけ暗部に落として章の違いを見せる */}
      <section style={{ background: D.bg, padding: '48px 0' }}>
        <div className="st-inner">
          <div className="st-label" style={{ color: D.gold, marginBottom: 14 }}>{FILM.label}</div>
          <h2 className="st-serif" style={{ fontSize: 'clamp(23px, 6.2vw, 32px)', fontWeight: 700, lineHeight: 1.55, color: D.ink, margin: 0, whiteSpace: 'pre-line' }}>
            {FILM.hero}
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 2.05, color: D.body, margin: '18px 0 0', maxWidth: 580 }}>
            {FILM.heroSub}
          </p>
          <div style={{ marginTop: 26 }}>
            <button className="st-btn" style={{ background: '#FFFFFF', color: C.ink, border: '1px solid #FFFFFF' }} onClick={() => go('film')}>
              映像制作を見る
            </button>
          </div>
        </div>
      </section>

      {/* 選ばれる理由 */}
      <Band alt>
        <H2 en="Why CORE" sub="自社プロダクトの開発・運営で培った実践知を、貴社の案件に投入します。">COREが選ばれる理由</H2>
        <div style={{ display: 'grid', gap: 14 }}>
          {REASONS.map((r, i) => (
            <div key={r.id} className="st-card">
              <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                <span className="st-serif" style={{ fontSize: 15, fontWeight: 700, color: C.goldText, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div className="st-serif" style={{ fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.6 }}>{r.title}</div>
                  <p style={{ fontSize: 14, lineHeight: 2, color: C.body, margin: '8px 0 0' }}>{r.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Band>

      {/* 制作の流れ */}
      <Band>
        <H2 en="Process" sub="お見積り時に金額を確定し、以後の追加費用はいただきません。各工程の進捗は随時ご報告します。">制作の流れ</H2>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {PROCESS.map((p, i) => (
            <li key={p.no} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: i < PROCESS.length - 1 ? `1px solid ${C.line}` : 'none' }}>
              <span className="st-serif" style={{ fontSize: 14, fontWeight: 700, color: C.goldText, flexShrink: 0, minWidth: 26, paddingTop: 2 }}>{p.no}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{p.title}</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.9, color: C.body, margin: '4px 0 0' }}>{p.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Band>

      {/* 実績ダイジェスト */}
      <Band alt>
        <H2 en="Works" sub="いずれも公開中のサイト・システムです。実物をご確認いただけます。">制作実績</H2>
        {/* 実物のトップページで語る (文字カード廃止) */}
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))' }}>
          {WORKS.slice(0, 3).map(w => (
            <a key={w.id} href={w.url} target="_blank" rel="noopener noreferrer" className="st-card st-workcard" style={{ textDecoration: 'none', padding: 0, overflow: 'hidden' }}>
              <div style={{ position: 'relative', aspectRatio: '16 / 10', overflow: 'hidden', borderBottom: `1px solid ${C.line}` }}>
                <img src={w.img} alt={`${w.name} のトップページ`} loading="lazy"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
              </div>
              <div style={{ padding: '12px 14px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div className="st-serif" style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{w.name}</div>
                <IconArrow color={C.gold} />
              </div>
            </a>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="st-btn st-btn-ghost" onClick={() => go('works')}>実績をすべて見る</button>
        </div>
      </Band>

      {/* CTA */}
      <Band>
        <div style={{ border: `1px solid ${C.goldLine}`, borderRadius: 14, padding: '36px 22px', textAlign: 'center', background: '#FFFFFF' }}>
          <div className="st-label" style={{ marginBottom: 12 }}>Contact</div>
          <div className="st-serif" style={{ fontSize: 21, fontWeight: 700, color: C.ink, lineHeight: 1.7 }}>まずは、お気軽にご相談ください。</div>
          <p style={{ fontSize: 13.5, color: C.body, margin: '10px 0 22px', lineHeight: 2 }}>
            6つの質問に答えるだけで、概算のお見積りをその場でご確認いただけます。
          </p>
          <LineCta where="home-bottom" />
          <div style={{ marginTop: 12 }}>
            <button className="st-btn st-btn-ghost" onClick={() => go('contact')}>先に概算を知る</button>
          </div>
          <Note>{CONTACT.lineNote}</Note>
        </div>
      </Band>
    </div>
  );
}

// ============================================================
// サイト制作 4プラン
// ============================================================
function PlanCard({ p }: { p: ProductionPlan }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  return (
    <div className={`st-card${p.featured ? ' st-card-featured' : ''}`}>
      {p.featured && <div className="st-label" style={{ fontSize: 10.5, marginBottom: 10 }}>Recommended — 標準プラン</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div className="st-serif" style={{ fontSize: 21, fontWeight: 700, letterSpacing: '0.06em', color: C.ink }}>{p.name}</div>
        <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{p.price}</div>
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: '8px 0 10px', lineHeight: 1.8 }}>{p.lead}</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: '0 0 12px', color: C.body }}>{p.scope}</p>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: C.mute, marginBottom: 16, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        <span>納期の目安 — <strong style={{ color: C.ink, fontWeight: 600 }}>{p.duration}</strong></span>
        <span>規模 — <strong style={{ color: C.ink, fontWeight: 600 }}>{p.pages}</strong></span>
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute, marginBottom: 8 }}>含まれるもの</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {p.includes.map(i => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{i}</li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 14, background: C.alt, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '11px 14px', fontSize: 13, lineHeight: 1.9, color: C.body }}>
        <span style={{ color: C.ink, fontWeight: 600 }}>こんな貴社に — </span>{p.bestFor}
      </div>
      <div style={{ marginTop: 14 }}>
        {p.faq.map((f, i) => (
          <div key={f.q} style={{ borderTop: `1px solid ${C.line}` }}>
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
              style={{ width: '100%', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '10px 0', fontSize: 13.5, color: C.ink, fontFamily: SANS, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>Q. {f.q}</span><span style={{ color: C.goldText, fontSize: 16, lineHeight: 1 }}>{openFaq === i ? '−' : '+'}</span>
            </button>
            {openFaq === i && <p style={{ fontSize: 13, lineHeight: 1.9, color: C.body, margin: '0 0 12px' }}>{f.a}</p>}
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
    <Band>
      <H2 en="Website" sub="1ページのLPから、予約・決済を備えた本格サイトまで。いずれのプランも、ご契約時に金額を確定し、以後の追加費用はいただきません。">サイト制作 — 4つのプラン</H2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {PRODUCTION_PLANS.map((pp, i) => (
          <button key={pp.id} className="st-chip" data-on={sel === i} onClick={() => setSel(i)}>
            {pp.name}<span style={{ marginLeft: 6, fontSize: 12, opacity: 0.75 }}>{pp.price}</span>
          </button>
        ))}
      </div>
      <PlanCard p={p} />
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <LineCta label="このプランをLINEで相談する" where="plans" />
        <div style={{ marginTop: 12 }}>
          <button className="st-btn st-btn-ghost" onClick={() => go('contact')}>先に概算を知る</button>
        </div>
        <Note>{CONTACT.lineNote}</Note>
      </div>
    </Band>
  );
}

// ============================================================
// 受託開発 4Tier
// ============================================================
function TierCard({ t }: { t: DevTier }) {
  return (
    <div className="st-card">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div className="st-serif" style={{ fontSize: 21, fontWeight: 700, letterSpacing: '0.06em', color: C.ink }}>{t.name}</div>
        <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{t.price}</div>
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, margin: '8px 0 10px', lineHeight: 1.8 }}>{t.lead}</div>
      <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: '0 0 12px', color: C.body }}>{t.scope}</p>
      <div style={{ fontSize: 12.5, color: C.mute, marginBottom: 14, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        期間の目安 — <strong style={{ color: C.ink, fontWeight: 600 }}>{t.duration}</strong>
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute, marginBottom: 8 }}>開発例</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {t.examples.map(e => (
            <li key={e} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{e}</li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 14, background: C.alt, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '11px 14px', fontSize: 13, lineHeight: 1.9, color: C.body }}>
        <span style={{ color: C.ink, fontWeight: 600 }}>価格の考え方 — </span>{t.pricing}
      </div>
    </div>
  );
}

function DevTab({ go }: { go: (t: TabId) => void }) {
  const [sel, setSel] = useState(0);
  return (
    <Band>
      <H2 en="Development" sub={DEV_LEAD}>受託開発 — 4つのTier</H2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {DEV_TIERS.map((t, i) => (
          <button key={t.id} className="st-chip" data-on={sel === i} onClick={() => setSel(i)}>{t.name}</button>
        ))}
      </div>
      <TierCard t={DEV_TIERS[sel]} />
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <LineCta label="開発についてLINEで相談する" where="dev" />
        <div style={{ marginTop: 12 }}>
          <button className="st-btn st-btn-ghost" onClick={() => go('contact')}>先に概算を知る</button>
        </div>
        <Note>要件が固まっていない段階からのご相談も承ります。</Note>
      </div>
    </Band>
  );
}

// ============================================================
// 運用プラン
// ============================================================
function CareTab() {
  return (
    <Band>
      <H2 en="Maintenance" sub="公開はゴールではなくスタートです。アクセスデータをもとに、貴社サイトの成果を継続的に高めます。">運用 — 月額プラン</H2>
      <div style={{ display: 'grid', gap: 14 }}>
        {CARE_PLANS.map(cp => (
          <div key={cp.id} className="st-card">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{cp.name}</div>
              <div className="st-serif" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{cp.price}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: '8px 0 12px', lineHeight: 1.8 }}>{cp.lead}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {cp.includes.map(i => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.7, color: C.body }}><IconCheck />{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <LineCta label="運用についてLINEで相談する" where="care" />
        <Note>他社で制作されたサイトの運用のみのご依頼も承ります。</Note>
      </div>
    </Band>
  );
}

// ============================================================
// Works
// ============================================================
function WorksTab() {
  const cats = ['企業サイト', 'EC・ブランド', 'アプリ', '個人'] as const;
  return (
    <Band>
      <H2 en="Works" sub="いずれも公開中のサイト・システムです。実物をご確認ください。">制作実績</H2>
      {cats.map(cat => {
        const list = WORKS.filter(w => w.category === cat);
        if (!list.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 28 }}>
            <div className="st-label" style={{ fontSize: 11, marginBottom: 10 }}>{cat}</div>
            {/* 実物のトップページを主役に (文字だけの無機質カード廃止) */}
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
              {list.map(w => (
                <a
                  key={w.id}
                  className="st-card st-workcard"
                  href={w.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ position: 'relative', aspectRatio: '16 / 10', overflow: 'hidden', borderBottom: `1px solid ${C.line}` }}>
                    <img
                      src={w.img}
                      alt={`${w.name} のトップページ`}
                      loading="lazy"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                    />
                  </div>
                  <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <div className="st-serif" style={{ fontSize: 16.5, fontWeight: 700, color: C.ink }}>{w.name}</div>
                    <p style={{ fontSize: 12.5, lineHeight: 1.8, color: C.body, margin: 0, flex: 1 }}>{w.copy}</p>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 4 }}>
                      サイトを見る <IconArrow color={C.gold} />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 8, textAlign: 'center' }}>
        <LineCta where="works" />
      </div>
    </Band>
  );
}

// ============================================================
// 会社案内
// ============================================================
function AboutTab() {
  return (
    <Band>
      <H2 en="Company">{COMPANY.title}</H2>

      {/* 代表メッセージ */}
      <div className="st-card" style={{ marginBottom: 18 }}>
        <div className="st-label" style={{ fontSize: 11, marginBottom: 14 }}>Message</div>
        <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 16, lineHeight: 1.7 }}>{COMPANY.messageTitle}</div>
        {COMPANY.message.map(s => (
          <p key={s.slice(0, 12)} style={{ fontSize: 14, lineHeight: 2.15, color: C.body, margin: '0 0 16px' }}>{s}</p>
        ))}
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <span style={{ fontSize: 12.5, color: C.mute, marginRight: 10 }}>{COMPANY.repTitle}</span>
          <span className="st-serif" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{COMPANY.repName}</span>
        </div>
      </div>

      {/* 会社概要 */}
      <div className="st-card">
        <div className="st-label" style={{ fontSize: 11, marginBottom: 14 }}>Profile</div>
        <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 8, lineHeight: 1.7 }}>会社概要</div>
        <div>
          {COMPANY.profile.map((f, i) => (
            <div key={f.label} style={{ display: 'flex', gap: 16, fontSize: 13.5, padding: '12px 0', borderBottom: i < COMPANY.profile.length - 1 ? `1px solid ${C.line}` : 'none', lineHeight: 1.9 }}>
              <span style={{ color: C.mute, minWidth: 68, flexShrink: 0, fontWeight: 600 }}>{f.label}</span>
              <span style={{ color: C.body, overflowWrap: 'anywhere' }}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <LineCta where="about" />
        <Note>{CONTACT.lineNote}</Note>
      </div>
    </Band>
  );
}

// ============================================================
// お問い合わせ — 見積ウィザード + mailto
// ============================================================
type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 6 = 結果

const PURPOSES: Array<{ v: Purpose; label: string }> = [
  { v: 'lp', label: '集客LP (1ページ)' },
  { v: 'corporate', label: 'コーポレートサイト' },
  { v: 'ec', label: 'EC・オンライン販売' },
  { v: 'webapp', label: 'Webアプリ・業務システム' },
  { v: 'saas', label: 'SaaS・本格プロダクト' },
];
const SCALES: Array<{ v: Scale; label: string }> = [
  { v: 'small', label: '小規模 (〜5ページ/画面)' },
  { v: 'medium', label: '標準 (〜15ページ/画面)' },
  { v: 'large', label: '大規模 (それ以上)' },
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
  { v: 'unknown', label: '未定' },
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
      '【CORE Studio お見積りのご相談】',
      `・目的: ${labelOf(PURPOSES, answers.purpose)}`,
      `・規模: ${labelOf(SCALES, answers.scale)}`,
      `・CMS (自社更新): ${answers.cms ? '必要' : '不要'}`,
      `・機能: ${answers.features.length ? answers.features.map(f => labelOf(FEATURES, f)).join(' / ') : 'なし'}`,
      `・希望納期: ${labelOf(TIMELINES, answers.timeline)}`,
      `・予算感: ${labelOf(BUDGETS, answers.budget)}`,
      '',
      `【概算結果】${result.plan} プラン / ¥${result.minPrice}万〜¥${result.maxPrice}万`,
    ].join('\n');
  }, [answers, result]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // clipboard 不許可環境では選択用に prompt
      window.prompt('以下をコピーしてLINEに貼り付けてください', summaryText.replace(/\n/g, ' '));
    }
  };

  // LINEを開く前に概算結果をコピーしておく。貼るだけで相談が始まる状態にする。
  const openLine = () => {
    logEvent('studio_line_cta', { where: 'estimate-result' });
    void copySummary();
  };

  const stepDefs: Array<{ title: string; body: ReactNode }> = [
    {
      title: '制作したいものをお選びください',
      body: <ChoiceGrid items={PURPOSES} value={purpose} onPick={v => { setPurpose(v); setStep(1); }} />,
    },
    {
      title: '想定される規模をお選びください',
      body: <ChoiceGrid items={SCALES} value={scale} onPick={v => { setScale(v); setStep(2); }} />,
    },
    {
      title: '貴社での更新機能 (CMS) は必要ですか',
      body: (
        <ChoiceGrid
          items={[{ v: 'yes', label: '必要 — お知らせ等を自社で更新したい' }, { v: 'no', label: '不要 — 更新は依頼したい' }]}
          value={cms === null ? null : cms ? 'yes' : 'no'}
          onPick={v => { setCms(v === 'yes'); setStep(3); }}
        />
      ),
    },
    {
      title: '必要な機能をお選びください (複数可・なければそのまま次へ)',
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
      title: 'ご希望の納期をお選びください',
      body: <ChoiceGrid items={TIMELINES} value={timeline} onPick={v => { setTimeline(v); setStep(5); }} />,
    },
    {
      title: 'ご予算の目安をお選びください',
      body: <ChoiceGrid items={BUDGETS} value={budget} onPick={v => { setBudget(v); setStep(6); }} />,
    },
  ];

  if (step === 6 && result) {
    return (
      <Band>
        <H2 en="Estimate" sub="ご回答をもとに算出した概算です。正式なお見積りはヒアリングの上で確定し、ご契約後の追加費用は発生しません。">概算お見積り</H2>
        <div className="st-card st-card-featured" style={{ textAlign: 'center', padding: '32px 22px' }}>
          <div className="st-label" style={{ fontSize: 10.5 }}>ご提案プラン</div>
          <div className="st-serif" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.06em', color: C.ink, margin: '10px 0 2px' }}>{result.plan}</div>
          <div style={{ fontSize: 12.5, color: C.mute }}>{result.kind === 'dev' ? '受託開発' : 'サイト制作'}</div>
          <div className="st-serif" style={{ fontSize: 24, fontWeight: 700, color: C.ink, margin: '18px 0 4px' }}>
            ¥{result.minPrice}万 <span style={{ fontSize: 15, color: C.mute, fontWeight: 400 }}>〜</span> ¥{result.maxPrice}万
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.9, color: C.body, margin: '16px 0 0', textAlign: 'left', background: C.alt, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '12px 14px' }}>{result.note}</p>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          <a className="st-btn st-btn-primary" href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer"
            style={{ width: '100%', boxSizing: 'border-box' }} onClick={openLine}>
            <IconChat /> この内容でLINE相談する
          </a>
          <button className="st-btn st-btn-ghost" onClick={copySummary} style={{ width: '100%', boxSizing: 'border-box' }}>
            <IconCopy /> {copied ? 'コピーしました' : '内容をコピーする'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: C.mute, lineHeight: 1.9, marginTop: 14, textAlign: 'center' }}>
          LINEを開くと同時に、この内容をコピーします。トークに貼り付けて送信してください。<br />
          LINEをお使いでない場合は <a href={`mailto:${STUDIO.email}?subject=${encodeURIComponent('【CORE Studio】制作のご相談')}`} style={{ color: C.ink }}>{STUDIO.email}</a> でも承ります。
        </p>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button onClick={() => { setStep(0); setPurpose(null); setScale(null); setCms(null); setFeatures([]); setTimeline(null); setBudget(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: C.mute, textDecoration: 'underline', minHeight: 44, fontFamily: SANS }}>
            最初からやり直す
          </button>
        </div>
      </Band>
    );
  }

  const def = stepDefs[step];
  return (
    <Band>
      <H2 en="Contact" sub="6つの質問にお答えいただくと、最適なプランと概算をその場でご確認いただけます。">お問い合わせ</H2>
      {/* 進捗 */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
        {stepDefs.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? C.gold : C.line }} />
        ))}
      </div>
      <div className="st-card">
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: C.mute, marginBottom: 8 }}>質問 {step + 1} / {stepDefs.length}</div>
        <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 16, lineHeight: 1.6 }}>{def.title}</div>
        {def.body}
        {step > 0 && (
          <button onClick={() => setStep((step - 1) as WizardStep)}
            style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: C.mute, textDecoration: 'underline', minHeight: 44, padding: 0, fontFamily: SANS }}>
            ひとつ戻る
          </button>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: C.mute, marginTop: 16, lineHeight: 1.9, textAlign: 'center' }}>
        質問に答えず直接ご相談いただいても構いません — <a href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.ink, fontWeight: 600 }}>LINEで無料相談</a>
      </p>
    </Band>
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
