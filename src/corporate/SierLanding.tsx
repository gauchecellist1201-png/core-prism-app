// ============================================================
// SierLanding — /corp/sier
// SIer・システム開発会社からAI開発案件を継続的に受注するための専用ページ。
//
// 位置づけ: 「AIが得意な制作会社」ではなく
// 「SIerが自社で抱えきれないAI案件を安全に任せられる開発パートナー」。
// 中心メッセージ: AI案件、御社だけで抱えなくて大丈夫です。
//
// ブランド（金×黒・明朝・静かな余白）は /corp と共通の corpTheme.ts をそのまま使う。
// タブは増やさない（[[ux_one_screen_tab_doctrine]]）。/corp の PartnerSection から
// 独立ページとして導線を張るだけの、専用ランディングページ。
//
// 数字・実績は捏造しない。CORE_NUMBERS / NewVenturesTab.tsx と同じ方針で、
// 受託開発（SIer協業）の実受注実績はまだ無いため正直に「公開できる段階になり
// 次第掲載する」と書く。詳細は sierData.ts のコメントを参照。
// ============================================================
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import LpStickyCta from '../components/LpStickyCta';
import { logEvent } from '../lib/onboardingAnalytics';
import {
  FONT_DISPLAY, FONT_SERIF_JA, FONT_SANS,
  GOLD, GOLD_LIGHT, INK, TEXT_BODY, TEXT_MUTED,
  sectionLabel, sectionLabelMain, sectionLabelSub, sectionH2, sectionLead,
  quietCard, stepNumber, ctaHero, ctaGhost, reveal,
} from './corpTheme';
import { Section, Kicker } from './TransformSections';
import { useIsMobile } from './useIsMobile';
import SierContactForm from './SierContactForm';
import {
  SIER_PAIN_POINTS, CAPABILITY_CATEGORIES, CONSULT_CASES, SIZE_BANDS,
  ENGAGEMENT_FLOW, SIER_SAFETY_RULES, SIER_PROOF_NUMBERS, SIER_TECH_GROUPS, SIER_FAQ,
} from './sierData';

const PAGE_URL = 'https://core-prism-app.vercel.app/corp/sier';
const PAGE_TITLE = 'SIer向けAI開発パートナー | AI案件、御社だけで抱えなくて大丈夫です。 — CORE';
const PAGE_DESCRIPTION = 'SIer・システム開発会社の担当者へ。生成AI・RAG・AI PoC・AIシステム開発の案件を、営業同行から要件整理・PoC・開発まで、必要な部分だけCOREが裏側から支援します。ホワイトラベル対応・NDA・提案段階からのご相談も可能です。';

function setMeta(selector: string, content: string) {
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    const [attr, val] = selector.replace(/[[\]"]/g, '').split('=');
    el.setAttribute(attr, val);
    document.head.appendChild(el);
  }
  el.content = content;
}

function useSierMeta() {
  useEffect(() => {
    logEvent('sier_lp_view');
    const prevTitle = document.title;
    document.title = PAGE_TITLE;
    setMeta('meta[name="description"]', PAGE_DESCRIPTION);
    setMeta('meta[property="og:title"]', PAGE_TITLE);
    setMeta('meta[property="og:description"]', PAGE_DESCRIPTION);
    setMeta('meta[property="og:url"]', PAGE_URL);
    setMeta('meta[property="og:type"]', 'website');
    setMeta('meta[name="twitter:card"]', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', PAGE_TITLE);
    setMeta('meta[name="twitter:description"]', PAGE_DESCRIPTION);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const prevCanonical = canonical?.href;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = PAGE_URL;

    return () => {
      document.title = prevTitle;
      if (canonical && prevCanonical) canonical.href = prevCanonical;
    };
  }, []);
}

function onAnchor(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (!href.startsWith('#')) return;
  const el = document.getElementById(href.slice(1));
  if (!el) return;
  e.preventDefault();
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24, behavior: 'smooth' });
  history.replaceState(null, '', href);
}

export default function SierLanding() {
  useSierMeta();
  return (
    <div style={{ background: INK, color: '#F3F6FB', fontFamily: FONT_SANS, minHeight: '100dvh', overflowX: 'clip' }}>
      <TopBar />
      <Hero />
      <PainSection />
      <StructureSection />
      <CapabilitiesSection />
      <ConsultCasesSection />
      <SizeBandsSection />
      <FlowSection />
      <SafetySection />
      <ProofSection />
      <FaqSection />
      <ContactSection />
      <Footer />
      {/* LpStickyCta は href 指定時 <a> を描画し onClick を呼ばないため、
          クリック計測は行わない（[[LpStickyCta.tsx]] 参照）。 */}
      <LpStickyCta
        title="AI案件、御社だけで抱えなくて大丈夫です。"
        sub="今あるAI案件を相談する"
        cta="相談する"
        href="#sier-contact"
        accent1={GOLD_LIGHT}
        accent2={GOLD}
        ctaColor="#0B1220"
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────
function TopBar() {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'rgba(5,5,5,0.82)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(125,211,252,0.16)',
      padding: '0.9rem 1.5rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <a href="/corp" style={{
        fontFamily: FONT_DISPLAY, fontSize: '0.95rem', letterSpacing: '0.22em',
        color: '#EEF2F7', textDecoration: 'none', fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', minHeight: 44,
      }}>
        CORE
      </a>
      <a
        href="#sier-contact"
        onClick={e => onAnchor(e, '#sier-contact')}
        style={{ ...ctaGhost, padding: '0 1.1rem', minHeight: 40, fontSize: '0.8rem' }}
      >
        相談する
      </a>
    </div>
  );
}

// ────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{
      position: 'relative', padding: '5.5rem 1.5rem 4.5rem', textAlign: 'center', overflow: 'hidden',
    }}>
      <div aria-hidden style={{
        position: 'absolute', top: -160, left: '50%', transform: 'translateX(-50%)',
        width: 780, height: 780, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(125,211,252,0.18) 0%, transparent 62%)',
        filter: 'blur(70px)', pointerEvents: 'none',
      }} />
      <div style={{ maxWidth: 880, margin: '0 auto', position: 'relative' }}>
        <p style={sectionLabel}>
          <span style={sectionLabelMain}>SIer 向け</span>
          <span style={sectionLabelSub}>AI DEVELOPMENT PARTNER</span>
        </p>
        <motion.h1
          {...reveal}
          style={{
            fontFamily: FONT_SERIF_JA,
            fontSize: 'clamp(1.7rem, 5vw, 3.1rem)',
            fontWeight: 700, lineHeight: 1.55, letterSpacing: '0.03em',
            marginBottom: '1.6rem',
          }}
        >
          AI案件、
          <br />
          御社だけで抱えなくて大丈夫です。
        </motion.h1>
        <motion.p
          {...reveal}
          transition={{ ...reveal.transition, delay: 0.1 }}
          style={{ ...sectionLead, maxWidth: 660, marginBottom: '2.6rem' }}
        >
          AI案件の営業同行・要件整理・PoC・設計・開発まで、必要な部分だけCOREが支援します。
          <br />
          提案前・要件未確定・PoCのみ ── どの段階からでもご相談いただけます。
        </motion.p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="#sier-contact"
            onClick={e => { onAnchor(e, '#sier-contact'); logEvent('sier_hero_cta_click', { cta: 'primary' }); }}
            style={ctaHero}
          >
            今あるAI案件を相談する →
          </a>
          <a
            href="#sier-contact"
            onClick={e => { onAnchor(e, '#sier-contact'); logEvent('sier_hero_cta_click', { cta: 'secondary' }); }}
            style={ctaGhost}
          >
            まずパートナーについて話を聞く
          </a>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────
function PainSection() {
  return (
    <Section
      id="pain"
      background="#080B11"
      labelJa="よくある状況"
      labelEn="SIER PAIN POINTS"
      title={<>こんな状況、ありませんか。</>}
      narrow
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {SIER_PAIN_POINTS.map((p, i) => (
          <motion.p
            key={p}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.05 }}
            style={{
              ...quietCard,
              fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', color: TEXT_BODY, lineHeight: 1.9,
              margin: 0, textAlign: 'left',
            }}
          >
            「{p}」
          </motion.p>
        ))}
      </div>
      <p style={{
        marginTop: '2.6rem', textAlign: 'center',
        fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.15rem, 2.4vw, 1.5rem)', fontWeight: 700,
        color: '#F3F6FB', letterSpacing: '0.04em',
      }}>
        その案件、COREが裏側から支援します。
      </p>
    </Section>
  );
}

// ────────────────────────────────────────────────────────
function StructureSection() {
  return (
    <Section
      id="structure"
      background="radial-gradient(120% 95% at 50% 0%, #0C1119 0%, #070A10 70%)"
      labelJa="座組み"
      labelEn="HOW WE FIT IN"
      title={<>「外注先」ではなく、<br />御社の裏にいるAI開発チーム。</>}
      lead={<>丸投げの下請けではありません。御社の営業・PM・開発チームの一部として、<br />必要な工程だけに入ります。</>}
    >
      <StructureDiagram />
      <p style={{ ...sectionLead, textAlign: 'center', marginTop: '2.2rem', fontSize: '0.86rem', color: TEXT_MUTED }}>
        エンドクライアントとの契約は御社のまま。COREは御社の内側で、技術の部分だけを担当します。
      </p>
    </Section>
  );
}

function StructureDiagram() {
  const isMobile = useIsMobile();
  if (isMobile) return <StructureDiagramMobile />;
  return (
    <svg
      viewBox="0 0 720 220"
      role="img"
      aria-label="SIer が エンドクライアント と契約し、CORE AI Development Team が SIer の内側から技術支援する図"
      style={{ width: '100%', maxWidth: 640, margin: '0 auto', display: 'block' }}
    >
      <defs>
        <linearGradient id="sierGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>
      </defs>

      {/* SIer 箱 */}
      <rect x="20" y="30" width="200" height="160" rx="16" fill="rgba(255,255,255,0.045)" stroke="rgba(125,211,252,0.4)" />
      <text x="120" y="70" textAnchor="middle" fill="#EEF2F7" fontSize="17" fontWeight="700" fontFamily={FONT_SERIF_JA}>SIer</text>
      <text x="120" y="94" textAnchor="middle" fill="rgba(226,232,240,0.6)" fontSize="11" fontFamily={FONT_SERIF_JA}>営業・PM</text>

      {/* CORE 箱（SIer の中に半分めり込ませて「内側にいる」ことを示す） */}
      <rect x="150" y="60" width="200" height="100" rx="14" fill="rgba(125,211,252,0.12)" stroke="url(#sierGold)" strokeWidth="1.4" />
      <text x="250" y="102" textAnchor="middle" fill="#F3F6FB" fontSize="14" fontWeight="700" fontFamily={FONT_SERIF_JA}>CORE</text>
      <text x="250" y="122" textAnchor="middle" fill="rgba(226,232,240,0.72)" fontSize="10.5" fontFamily={FONT_SERIF_JA}>AI Development Team</text>

      {/* 矢印: SIer+CORE → エンドクライアント */}
      <line x1="360" y1="110" x2="460" y2="110" stroke="url(#sierGold)" strokeWidth="1.6" markerEnd="url(#sierArrow)" />
      <defs>
        <marker id="sierArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" fill="#BAE6FD" />
        </marker>
      </defs>

      {/* エンドクライアント箱 */}
      <rect x="470" y="55" width="230" height="110" rx="16" fill="rgba(255,255,255,0.03)" stroke="rgba(125,211,252,0.28)" />
      <text x="585" y="100" textAnchor="middle" fill="#EEF2F7" fontSize="15" fontWeight="700" fontFamily={FONT_SERIF_JA}>エンドクライアント</text>
      <text x="585" y="122" textAnchor="middle" fill="rgba(226,232,240,0.6)" fontSize="10.5" fontFamily={FONT_SERIF_JA}>契約は御社のまま</text>

      <text x="360" y="200" textAnchor="middle" fill="rgba(226,232,240,0.5)" fontSize="10.5" letterSpacing="0.08em" fontFamily={FONT_SERIF_JA}>
        SIer ＋ CORE（内側） → エンドクライアント
      </text>
    </svg>
  );
}

/** 縦積み版。viewBox の幅を実際のレンダリング幅(343px前後)に近づけ、
 *  横版のように文字が8px前後まで潰れないようにする
 *  （Codexレビュー2026-08-21: 720幅のSVGを343pxまで縮めると17→約8pxになり読めなかった）。 */
function StructureDiagramMobile() {
  return (
    <svg
      viewBox="0 0 320 400"
      role="img"
      aria-label="SIer が エンドクライアント と契約し、CORE AI Development Team が SIer の内側から技術支援する図"
      style={{ width: '100%', maxWidth: 360, margin: '0 auto', display: 'block' }}
    >
      <defs>
        <linearGradient id="sierGoldM" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>
        {/* orient="auto" は marker のローカル +x 軸をパスの進行方向へ回転させる。
            この矢印は縦線(下向き)に付くので、横向き矢印(sierArrow)と同じ
            「+x を指す」形のまま使う(down 用に描き直すと二重に回転して逆を向く)。 */}
        <marker id="sierArrowM" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" fill="#BAE6FD" />
        </marker>
      </defs>

      {/* SIer 箱 */}
      <rect x="20" y="16" width="280" height="86" rx="16" fill="rgba(255,255,255,0.045)" stroke="rgba(125,211,252,0.4)" />
      <text x="160" y="52" textAnchor="middle" fill="#EEF2F7" fontSize="18" fontWeight="700" fontFamily={FONT_SERIF_JA}>SIer</text>
      <text x="160" y="76" textAnchor="middle" fill="rgba(226,232,240,0.6)" fontSize="12" fontFamily={FONT_SERIF_JA}>営業・PM</text>

      {/* CORE 箱（SIer に半分めり込ませて「内側にいる」ことを示す） */}
      <rect x="45" y="70" width="230" height="70" rx="14" fill="rgba(125,211,252,0.12)" stroke="url(#sierGoldM)" strokeWidth="1.4" />
      <text x="160" y="105" textAnchor="middle" fill="#F3F6FB" fontSize="15" fontWeight="700" fontFamily={FONT_SERIF_JA}>CORE</text>
      <text x="160" y="124" textAnchor="middle" fill="rgba(226,232,240,0.72)" fontSize="11" fontFamily={FONT_SERIF_JA}>AI Development Team</text>

      {/* 矢印: 下向き */}
      <line x1="160" y1="160" x2="160" y2="228" stroke="url(#sierGoldM)" strokeWidth="1.8" markerEnd="url(#sierArrowM)" />

      {/* エンドクライアント箱 */}
      <rect x="20" y="238" width="280" height="86" rx="16" fill="rgba(255,255,255,0.03)" stroke="rgba(125,211,252,0.28)" />
      <text x="160" y="274" textAnchor="middle" fill="#EEF2F7" fontSize="16" fontWeight="700" fontFamily={FONT_SERIF_JA}>エンドクライアント</text>
      <text x="160" y="296" textAnchor="middle" fill="rgba(226,232,240,0.6)" fontSize="11.5" fontFamily={FONT_SERIF_JA}>契約は御社のまま</text>

      <text x="160" y="360" textAnchor="middle" fill="rgba(226,232,240,0.5)" fontSize="11.5" letterSpacing="0.04em" fontFamily={FONT_SERIF_JA}>
        SIer ＋ CORE（内側）
      </text>
      <text x="160" y="380" textAnchor="middle" fill="rgba(226,232,240,0.5)" fontSize="11.5" letterSpacing="0.04em" fontFamily={FONT_SERIF_JA}>
        → エンドクライアント
      </text>
    </svg>
  );
}

// ────────────────────────────────────────────────────────
function CapabilitiesSection() {
  return (
    <Section
      id="capabilities"
      background="#080B11"
      labelJa="対応可能なAI開発"
      labelEn="WHAT WE BUILD"
      title={<>できることを、具体的に。</>}
      lead={<>「AIなら何でもできます」とは言いません。実際に対応している範囲だけを書きます。</>}
    >
      <div className="corp-grid-2">
        {CAPABILITY_CATEGORIES.map((c, i) => (
          <motion.div key={c.title} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }} style={quietCard}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.72rem', letterSpacing: '0.22em', color: GOLD, fontWeight: 700, marginBottom: '0.5rem' }}>
              {c.sub}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700, color: '#F3F6FB', marginBottom: '0.9rem' }}>
              {c.title}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {c.items.map(item => (
                <li key={item} style={{
                  fontFamily: FONT_SERIF_JA, fontSize: '0.8rem', color: 'rgba(226,232,240,0.82)',
                  border: '1px solid rgba(125,211,252,0.26)', borderRadius: 8, padding: '5px 11px',
                }}>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ────────────────────────────────────────────────────────
function ConsultCasesSection() {
  return (
    <Section
      id="consult-cases"
      background="radial-gradient(120% 95% at 50% 0%, #0C1119 0%, #070A10 70%)"
      labelJa="こんな案件をご相談ください"
      labelEn="WHEN TO CALL US"
      title={<>いま持っている、あの案件です。</>}
      narrow
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {CONSULT_CASES.map((c, i) => (
          <motion.div
            key={c}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.04 }}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.8rem',
              padding: '0.9rem 1.1rem', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(125,211,252,0.18)',
            }}
          >
            <span aria-hidden style={{ color: GOLD, fontFamily: FONT_DISPLAY, fontSize: '0.9rem', flexShrink: 0 }}>✓</span>
            <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.92rem', color: TEXT_BODY, lineHeight: 1.8 }}>{c}</span>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ────────────────────────────────────────────────────────
function SizeBandsSection() {
  return (
    <Section
      id="size-bands"
      background="#080B11"
      labelJa="案件規模の目安"
      labelEn="PROJECT SIZE"
      title={<>ご相談いただきやすい規模感。</>}
      lead={<>固定料金ではありません。相談いただきやすい目安として置いています。</>}
    >
      <div className="corp-grid-3">
        {SIZE_BANDS.map((b, i) => (
          <motion.div key={b.name} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }} style={{ ...quietCard, textAlign: 'center' }}>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.92rem', fontWeight: 700, color: '#F3F6FB', marginBottom: '0.6rem' }}>
              {b.name}
            </p>
            <p style={{
              fontFamily: b.range === '個別相談' ? FONT_DISPLAY : FONT_SERIF_JA,
              fontSize: 'clamp(1.2rem, 2.4vw, 1.5rem)', fontWeight: 700, color: GOLD_LIGHT, letterSpacing: '0.03em', marginBottom: '0.5rem',
            }}>
              {b.range}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: TEXT_MUTED, lineHeight: 1.7 }}>{b.note}</p>
          </motion.div>
        ))}
      </div>
      <p style={{ ...sectionLead, textAlign: 'center', marginTop: '2.2rem', fontSize: '0.82rem', color: TEXT_MUTED, maxWidth: 640 }}>
        ※ 固定料金ではなく、ご相談いただきやすい案件規模の目安です。実際の見積りは、要件を伺ったうえで個別にお出しします。
      </p>
    </Section>
  );
}

// ────────────────────────────────────────────────────────
function FlowSection() {
  return (
    <Section
      id="flow"
      background="radial-gradient(120% 95% at 50% 0%, #0C1119 0%, #070A10 70%)"
      labelJa="進め方"
      labelEn="HOW IT WORKS"
      title={<>相談から提供まで、5ステップ。</>}
      narrow
    >
      <div className="corp-steps">
        {ENGAGEMENT_FLOW.map((s, i) => (
          <motion.div key={s.no} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }} className="corp-step">
            <span style={{ ...stepNumber, fontSize: '1.3rem', display: 'block', marginBottom: '0.6rem' }}>{s.no}</span>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.98rem', fontWeight: 700, color: '#EEF2F7', marginBottom: '0.5rem' }}>{s.title}</p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.82rem', color: TEXT_BODY, lineHeight: 1.9 }}>{s.body}</p>
          </motion.div>
        ))}
      </div>
      <Kicker en="Simple to explain, simple to bring into a proposal." />
    </Section>
  );
}

// ────────────────────────────────────────────────────────
function SafetySection() {
  return (
    <Section
      id="safety"
      background="#080B11"
      labelJa="安心して協業するために"
      labelEn="TERMS FOR PARTNERS"
      title={<>「顧客を取られるのでは」に、<br />先にお答えします。</>}
      lead={<>SIerの皆さまが最初に気にされる点です。実際に相談・運用できる範囲を、先に書いておきます。</>}
    >
      <div className="corp-grid-3">
        {SIER_SAFETY_RULES.map((r, i) => (
          <motion.div key={r.t} {...reveal} transition={{ ...reveal.transition, delay: Math.min(i, 8) * 0.04 }} style={quietCard}>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.94rem', fontWeight: 700, color: '#F3F6FB', marginBottom: '0.55rem', letterSpacing: '0.03em' }}>
              {r.t}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.84rem', color: TEXT_BODY, lineHeight: 1.95 }}>{r.d}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ────────────────────────────────────────────────────────
function ProofSection() {
  return (
    <Section
      id="proof"
      background="radial-gradient(120% 95% at 50% 0%, #0C1119 0%, #070A10 70%)"
      labelJa="実績・技術・信頼性"
      labelEn="PROOF & TECHNOLOGY"
      title={<>「作れる」ことは、実物で示します。</>}
      narrow
    >
      <div className="corp-grid-2" style={{ marginBottom: '2.6rem' }}>
        {SIER_PROOF_NUMBERS.map((n, i) => (
          <motion.div key={n.label} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }} style={{ ...quietCard, textAlign: 'center' }}>
            <p style={{
              fontFamily: FONT_DISPLAY, fontSize: 'clamp(2.2rem, 5vw, 3rem)', fontWeight: 700, lineHeight: 1,
              background: 'linear-gradient(120deg,#FFFFFF,#BAE6FD 55%,#7DD3FC)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {n.value}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.86rem', color: '#EEF2F7', marginTop: '0.5rem' }}>{n.labelJa}</p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.74rem', color: TEXT_MUTED, marginTop: '0.3rem', lineHeight: 1.8 }}>{n.note}</p>
          </motion.div>
        ))}
      </div>

      <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.86rem', fontWeight: 700, color: '#EEF2F7', textAlign: 'center', marginBottom: '1.2rem', letterSpacing: '0.05em' }}>
        使っている技術
      </p>
      <div className="corp-grid-2" style={{ marginBottom: '2.4rem' }}>
        {SIER_TECH_GROUPS.map((g, i) => (
          <motion.div key={g.purpose} {...reveal} transition={{ ...reveal.transition, delay: i * 0.05 }} style={quietCard}>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.88rem', fontWeight: 700, color: '#F3F6FB', marginBottom: '0.7rem' }}>{g.purpose}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {g.tech.map(t => (
                <li key={t} style={{
                  fontFamily: FONT_SANS, fontSize: '0.74rem', letterSpacing: '0.05em',
                  color: 'rgba(226,232,240,0.72)', border: '1px solid rgba(125,211,252,0.24)',
                  borderRadius: 6, padding: '5px 10px',
                }}>
                  {t}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      <p style={{ ...sectionLead, textAlign: 'center', fontSize: '0.85rem', color: TEXT_MUTED, maxWidth: 660 }}>
        受託開発（SIer協業を含む）の導入実績・案件数は、実績として公開できる段階に至るまでは記載しません。
        公開可能になり次第、このページに掲載します。
        いま判断の材料にしていただけるのは、自社開発・本番稼働中のプロダクトです。
      </p>
    </Section>
  );
}

// ────────────────────────────────────────────────────────
function FaqSection() {
  return (
    <Section
      id="faq"
      background="#080B11"
      labelJa="よくあるご質問"
      labelEn="FAQ"
      title={<>聞きにくいことから、先に。</>}
      narrow
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {SIER_FAQ.map((f, i) => (
          <motion.details
            key={f.q}
            {...reveal}
            transition={{ ...reveal.transition, delay: Math.min(i, 5) * 0.05 }}
            className="corp-faq"
            style={quietCard}
          >
            <summary className="corp-faq-q">
              <span style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(0.94rem, 1.6vw, 1.05rem)', fontWeight: 700, color: '#F3F6FB', lineHeight: 1.8 }}>
                {f.q}
              </span>
              <span aria-hidden className="corp-faq-mark" style={{ color: GOLD }}>＋</span>
            </summary>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.88rem', color: TEXT_BODY, lineHeight: 2.05, marginTop: '0.9rem' }}>
              {f.a}
            </p>
          </motion.details>
        ))}
      </div>
    </Section>
  );
}

// ────────────────────────────────────────────────────────
function ContactSection() {
  return (
    <section
      id="sier-contact"
      className="lp-section-pad"
      style={{
        padding: '7rem 1.5rem',
        background: 'radial-gradient(ellipse at center, rgba(125,211,252,0.10) 0%, #070A10 72%)',
        scrollMarginTop: 70,
      }}
    >
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p style={sectionLabel}>
            <span style={sectionLabelMain}>ご&nbsp;相&nbsp;談</span>
            <span style={sectionLabelSub}>CONTACT</span>
          </p>
          <motion.h2 {...reveal} style={sectionH2}>
            今あるAI案件を、まず話してください。
          </motion.h2>
          <p style={sectionLead}>
            提案前・受注前でも構いません。要件が固まっていなくても構いません。
            <span style={{ display: 'block', fontSize: '0.85rem', color: TEXT_MUTED, marginTop: '0.8rem' }}>
              通常24時間以内にご返信（土日祝は翌営業日）
            </span>
          </p>
        </div>
        <SierContactForm />
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────
function Footer() {
  const linkStyle: React.CSSProperties = {
    color: 'rgba(226,232,240,0.6)', textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 44, padding: '0 4px', fontFamily: FONT_SERIF_JA, fontSize: '0.8rem',
  };
  return (
    <footer style={{ padding: '3rem 1.5rem', borderTop: '1px solid rgba(125,211,252,0.14)', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <a href="/corp" style={linkStyle}>CORE について</a>
        <a href="/corp#security" style={linkStyle}>機密と安全</a>
        <a href="/privacy" style={linkStyle}>プライバシー</a>
        <a href="/terms" style={linkStyle}>利用規約</a>
        <a href="/tokushoho" style={linkStyle}>特定商取引法</a>
      </div>
      <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.72rem', color: 'rgba(226,232,240,0.4)', margin: 0 }}>
        © 2026 CORE
      </p>
    </footer>
  );
}
