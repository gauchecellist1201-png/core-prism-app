// ============================================================
// HomeSections — /corp ホーム（〈変革〉タブ）の章。2026-09-02 全面再構築。
//
// オーナー指示: 「AIが作ったっぽい／決定打に欠ける／写真が少ない。
//   もっと売れている会社っぽく、かっこよく、美しく、洗練され、分かりやすく、
//   誰が見ても信頼に足るホームページに」
//
// 設計:
//   ・写真を主役にする（神戸港のヒーロー、会議室、開発、現場、診断、代表）。
//     人物は名前も肩書きも付けない（架空の社員を「実在の誰か」に見せない）。
//     ヒーローだけは笑顔が要る＝顔を写す。2026-09-02 オーナー指示
//     「工房の写真はかっこよくない。笑顔だが、もっとかっこよく」。
//   ・数字は実在するものだけ（自社プロダクト数は suiteData から、設立・資本金は companyInfo から）。
//     「導入◯社」「効果◯%」のような未確定の数字は作らない。
//   ・本文は既存の transformData を使い回す（言葉の正本を増やさない）。
//   ・書体は Noto Sans JP の太字＋Inter。金・明朝は使わない（corpTheme 2026-09-02）。
// ============================================================
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { motion } from 'framer-motion';
import {
  FONT_JA, FONT_EN, ACCENT, ACCENT_LIGHT, PAPER, TEXT_BODY, TEXT_MUTED, LINE, INK, INK_2,
  ctaHero, ctaGhost, sectionH2, sectionLead, reveal,
} from './corpTheme';
import { SERVICE_LAYERS, DIFF_CORE, ASSESSMENT_STEPS, ASSESSMENT_TARGETS } from './transformData';
import { SUITE_COUNT } from './suiteData';
import { COMPANY_INFO } from '../data/companyInfo';
import { rememberSource, track } from './roai/track';

type AnchorHandler = (e: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;

/** 英字のキッカー（章の小さな見出し）。 */
function Kick({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p style={{
      fontFamily: FONT_EN, fontSize: '0.72rem', letterSpacing: '0.28em', textTransform: 'uppercase',
      color: ACCENT_LIGHT, fontWeight: 600, marginBottom: '1rem', textAlign: center ? 'center' : 'left',
      display: 'flex', alignItems: 'center', gap: 10, justifyContent: center ? 'center' : 'flex-start',
    }}>
      <span aria-hidden style={{ width: 22, height: 1, background: ACCENT, display: 'inline-block' }} />
      {children}
    </p>
  );
}

// ── 写真の一覧（public/corp/*.webp・2026-09-02 生成） ──
const IMG = {
  hero: '/corp/hero-office-kobe.webp',
  heroKobe: '/corp/hero-kobe.webp',
  consulting: '/corp/consulting.webp',
  development: '/corp/development.webp',
  operations: '/corp/operations.webp',
  industry: '/corp/industry.webp',
  assessment: '/corp/assessment.webp',
  kobeNight: '/corp/kobe-night.webp',
  texture: '/corp/texture.webp',
  datacenter: '/corp/datacenter.webp',
} as const;

// ============================================================
//  HERO — ブランドフィルム（2026-09-04 オーナー指示）
//
//  ・トップは縦型のブランド動画（public/corp-creed-portrait.mp4・54秒・音あり）。
//    自動再生はブラウザの規則で無音のみ＝「音を出す」ボタンを添える。
//  ・いちばん大きい言葉は社是「いつの時代も、変わらない核を。」（H1）。
//    「核とは、人。」はその答えとして一段小さく置く（前は逆で、答えの方が大きかった）。
//  ・下にあった事実の帯（神戸／2026年／8／4）は「謎のタブ」に見えるので廃止。
//  ・PC: 左に言葉、右に縦型フィルム（ポスターをぼかした地の上）。
//    スマホ: 縦型の動画がそのまま画面いっぱい＝言葉は下に重ねる（CSS .ch-hero--film）。
//  ・省データ/動きを減らす設定の人には自動再生しない。画面外に出たら止める。
// ============================================================
/** スピーカーの絵だけの切り替え（言葉は付けない。押すたびに音の入切）。 */
function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z" fill="currentColor" stroke="currentColor" strokeWidth={1.4} />
      {muted ? (
        <>
          <path d="M16.4 9.6l4 4.8" />
          <path d="M20.4 9.6l-4 4.8" />
        </>
      ) : (
        <>
          <path d="M15.8 9.2a3.8 3.8 0 0 1 0 5.6" />
          <path d="M18.4 6.9a7.2 7.2 0 0 1 0 10.2" />
        </>
      )}
    </svg>
  );
}

const FILM = {
  src: '/corp-creed-portrait.mp4',
  poster: '/corp-creed-poster.webp',
} as const;

export function HomeHero({ onAnchor }: { onAnchor: AnchorHandler }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [canPlay, setCanPlay] = useState(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (reduce || nav.connection?.saveData) { setCanPlay(false); v.pause(); return; }
    // 画面外では止める（電池と回線の節約）。
    if (typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) void v.play().catch(() => {}); else v.pause();
    }, { threshold: 0.15 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    const nextMuted = !muted;
    v.muted = nextMuted;
    setMuted(nextMuted);
    if (!nextMuted) { setCanPlay(true); void v.play().catch(() => {}); }
  };

  return (
    <section id="top" className="ch-hero ch-hero--film lp-safe">
      <img src={FILM.poster} alt="" aria-hidden className="ch-film-ambient" width={720} height={1280} decoding="async" />
      <div className="ch-hero-shade" aria-hidden />
      <div className="ch-wrap ch-hero-inner ch-hero-grid">
        <motion.div className="ch-hero-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
          <Kick>AI Transformation Company — Kobe, Japan</Kick>
          {/* 言葉の正本は creedData / companyInfo.philosophy */}
          <h1 className="ch-h1 ch-h1--creed" style={{ fontFamily: FONT_JA, color: '#FFFFFF' }}>
            いつの時代も、
            <br />
            変わらない核を。
          </h1>
          <p className="ch-hero-creed-answer" style={{ fontFamily: FONT_JA }}>
            核とは、<span style={{ color: ACCENT_LIGHT }}>人。</span>
          </p>
          <p className="ch-hero-answer" style={{ fontFamily: FONT_JA }}>
            AIは、人の仕事を奪う道具ではありません。
            <br className="ch-br" />
            人にしかできない仕事を、人に返すための道具です。
          </p>
          <div className="ch-cta-row">
            <a href="/roai-score" onClick={e => { rememberSource('home-hero'); track('corp_cta_click', 'home-hero'); onAnchor(e, '/roai-score'); }} style={ctaHero}>ROAIを無料診断する</a>
            <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={{ ...ctaGhost, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
              AI Transformationを相談する
            </a>
          </div>
        </motion.div>

        <motion.figure className="ch-film" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}>
          <video
            ref={videoRef}
            className="ch-film-video"
            src={FILM.src}
            poster={FILM.poster}
            autoPlay={canPlay}
            muted
            loop
            playsInline
            preload="metadata"
            width={720}
            height={1280}
            aria-label="株式会社COREのブランドフィルム。いつの時代も、変わらない核を。"
          />
          <button
            type="button"
            className="ch-film-sound"
            onClick={toggleSound}
            aria-pressed={!muted}
            aria-label={muted ? '音を出す' : '音を消す'}
            title={muted ? '音を出す' : '音を消す'}
          >
            <SoundIcon muted={muted} />
          </button>
        </motion.figure>
      </div>
    </section>
  );
}

// ============================================================
//  PROOF STRIP — 自社プロダクトの名前の帯（「作れる」の証拠）
// ============================================================
const PRODUCT_NAMES = ['Nexus', 'Prism', 'Resonance', 'Crystal', 'Iris', 'Lume', 'Guild', 'Pulse'];

export function ProofStrip({ onAnchor }: { onAnchor: AnchorHandler }) {
  return (
    <section aria-label="自社プロダクト" style={{ background: INK, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: '1.6rem 1.5rem' }}>
      <div className="ch-wrap ch-proof">
        <p style={{ fontFamily: FONT_JA, fontSize: '0.78rem', color: TEXT_MUTED, letterSpacing: '0.08em', margin: 0, whiteSpace: 'nowrap' }}>
          自社開発・本番稼働中の AI プロダクト
        </p>
        <ul className="ch-logos" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {PRODUCT_NAMES.map(n => (
            <li key={n} style={{ fontFamily: FONT_EN, fontSize: '1.02rem', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(236,242,250,0.72)' }}>
              <span style={{ color: 'rgba(236,242,250,0.4)', fontWeight: 500, marginRight: 4 }}>CORE</span>{n}
            </li>
          ))}
        </ul>
        <a href="#products" onClick={e => onAnchor(e, '#products')} className="ch-textlink">プロダクトを見る →</a>
      </div>
    </section>
  );
}

// ============================================================
//  WHY CORE — 3 つの理由（写真つき）
// ============================================================
export function WhyCore() {
  const items = [
    {
      img: IMG.consulting, alt: '会議室で業務の流れを紙とPCで確認している様子',
      no: '01', title: '決める人と、作る人が同じ。',
      body: '経営課題の分析から要件定義、実装、本番運用まで同じチームが持ちます。「決めた人」と「作る人」の間で意図が薄まりません。',
    },
    {
      img: IMG.development, alt: '夕暮れの開発デスク。コードと管理画面が並ぶモニター',
      no: '02', title: `自社で${SUITE_COUNT}つのAIプロダクトを運用。`,
      body: '提案だけの会社ではありません。自分たちで作り、値付けし、売り、直し続けているプロダクトがあります。それが「作れる」ことの証拠です。',
    },
    {
      img: IMG.operations, alt: '工場の現場でタブレットを持つ作業者の後ろ姿',
      no: '03', title: '納品で、終わらない。',
      body: '使われ方を見て、モデルと業務の両方を直し続けます。組織の側が変わらなければAIは効かない。変わったかどうかが、私たちの成果です。',
    },
  ];
  return (
    <section id="why" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, scrollMarginTop: 70 }}>
      <div className="ch-wrap">
        <div className="ch-head">
          <Kick>Why CORE</Kick>
          <h2 style={{ ...sectionH2, margin: 0 }}>
            AIを導入するのではなく、
            <br />
            AI前提で会社をつくり直す。
          </h2>
          <p style={{ ...sectionLead, margin: '1.2rem 0 0', maxWidth: 560 }}>
            戦略から実装、運用、そして次の事業まで。区切らずに引き受けるので、決めたことがそのまま形になります。
          </p>
        </div>
        <div className="ch-grid-3" style={{ marginTop: '3.5rem' }}>
          {items.map((it, i) => (
            <motion.article key={it.no} {...reveal} transition={{ ...reveal.transition, delay: i * 0.1 }} className="ch-card">
              <div className="ch-card-img">
                <img src={it.img} alt={it.alt} loading="lazy" decoding="async" width={1600} height={1067} />
              </div>
              <p style={{ fontFamily: FONT_EN, fontSize: '0.72rem', letterSpacing: '0.24em', color: ACCENT, fontWeight: 700, margin: '1.4rem 0 0.6rem' }}>{it.no}</p>
              <h3 style={{ fontFamily: FONT_JA, fontSize: 'clamp(1.15rem, 1.7vw, 1.35rem)', fontWeight: 800, color: PAPER, lineHeight: 1.5, margin: '0 0 0.7rem', letterSpacing: '-0.005em' }}>{it.title}</h3>
              <p style={{ fontFamily: FONT_JA, fontSize: '0.92rem', color: TEXT_BODY, lineHeight: 1.95, margin: 0 }}>{it.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
//  WHAT WE DO — 4階層を、写真と交互に置く編集レイアウト
// ============================================================
export function ServicesEditorial({ onAnchor }: { onAnchor: AnchorHandler }) {
  const photos = [IMG.consulting, IMG.development, IMG.operations, IMG.industry];
  const alts = [
    'ガラス張りの会議室で図面を囲む',
    '複数モニターの開発環境',
    '製造・物流の現場',
    '朝のクリニック受付',
  ];
  return (
    <section id="whatwedo" className="lp-section-pad" style={{ padding: '7rem 1.5rem 5rem', background: INK_2, scrollMarginTop: 70 }}>
      <div className="ch-wrap">
        <div className="ch-head">
          <Kick>What We Do</Kick>
          <h2 style={{ ...sectionH2, margin: 0 }}>
            戦略から、実装、運用、
            <br />
            そして次の事業まで。
          </h2>
        </div>

        <div style={{ marginTop: '2.5rem' }}>
          {SERVICE_LAYERS.map((s, i) => (
            <motion.div key={s.no} {...reveal} className={'ch-row' + (i % 2 === 1 ? ' is-flip' : '')}>
              <div className="ch-row-media">
                <img src={photos[i]} alt={alts[i]} loading="lazy" decoding="async" width={1600} height={1067} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.9rem' }}>
                  <span style={{ fontFamily: FONT_EN, fontSize: '0.8rem', letterSpacing: '0.2em', color: ACCENT, fontWeight: 700 }}>{s.no}</span>
                  <span style={{ fontFamily: FONT_EN, fontSize: '0.74rem', letterSpacing: '0.16em', color: TEXT_MUTED, textTransform: 'uppercase', fontWeight: 600 }}>{s.titleEn}</span>
                  {s.soon && (
                    <span style={{ fontFamily: FONT_EN, fontSize: '0.58rem', letterSpacing: '0.2em', color: INK, background: ACCENT_LIGHT, padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>
                      COMING SOON
                    </span>
                  )}
                </div>
                <h3 style={{ fontFamily: FONT_JA, fontSize: 'clamp(1.5rem, 2.6vw, 2.1rem)', fontWeight: 800, color: PAPER, lineHeight: 1.35, margin: '0 0 0.5rem', letterSpacing: '-0.01em' }}>
                  {s.titleJa}
                </h3>
                <p style={{ fontFamily: FONT_JA, fontSize: 'clamp(1rem, 1.5vw, 1.12rem)', fontWeight: 700, color: ACCENT_LIGHT, lineHeight: 1.7, margin: '0 0 1rem' }}>
                  {s.copy}
                </p>
                <p style={{ fontFamily: FONT_JA, fontSize: '0.95rem', color: TEXT_BODY, lineHeight: 2, margin: '0 0 1.2rem' }}>{s.body}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {s.items.map(it => (
                    <li key={it} style={{
                      fontFamily: FONT_JA, fontSize: '0.74rem', color: 'rgba(236,242,250,0.8)',
                      border: `1px solid ${LINE}`, background: 'rgba(255,255,255,0.03)', borderRadius: 999, padding: '5px 11px',
                    }}>
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <a href="#services" onClick={e => onAnchor(e, '#services')} style={ctaGhost}>サービスの詳細・進め方・費用感を見る</a>
        </div>
      </div>
    </section>
  );
}

// ============================================================
//  PRODUCTS PROOF — 実際の画面（作れることの証拠）
// ============================================================
const SHOTS: { img: string; name: string; cap: string }[] = [
  { img: '/lp/shot-prism.jpg', name: 'Prism', cap: '経営者専属のAI参謀' },
  { img: '/lp/shot-resonance.jpg', name: 'Resonance', cap: 'LINEの返信を、AIが先に' },
  { img: '/lp/shot-crystal.jpg', name: 'Crystal', cap: '話しかけられるAI接客' },
  { img: '/lp/shot-iris.jpg', name: 'Iris', cap: 'Instagram運用の相棒' },
  { img: '/lp/shot-universe.jpg', name: 'Universe', cap: 'AIに任せられる仕事の地図' },
  { img: '/lp/shot-guild.jpg', name: 'Guild', cap: 'みんなで決める組織OS' },
  { img: '/lp/shot-lume.jpg', name: 'Lume', cap: 'すべてのリンクをひとつに' },
];

export function ProductsProof({ onAnchor }: { onAnchor: AnchorHandler }) {
  return (
    <section id="proof" className="lp-section-pad" style={{ padding: '7rem 0', background: INK, scrollMarginTop: 70, overflow: 'hidden' }}>
      <div className="ch-wrap" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1.5rem' }}>
        <div className="ch-head" style={{ marginBottom: 0 }}>
          <Kick>Products</Kick>
          <h2 style={{ ...sectionH2, margin: 0 }}>作れることの、証拠。</h2>
          <p style={{ ...sectionLead, margin: '1rem 0 0', maxWidth: 560 }}>
            提案書ではなく、実際に動いている画面です。{SUITE_COUNT}つのAIプロダクトを自社で開発し、本番で運用しています。
          </p>
        </div>
        <a href="#products" onClick={e => onAnchor(e, '#products')} style={{ ...ctaGhost, minHeight: 48 }}>すべてのプロダクトを見る</a>
      </div>
      <div className="ch-shots-outer">
        <div className="ch-shots">
          {SHOTS.map((s, i) => (
            <motion.figure key={s.name} {...reveal} transition={{ ...reveal.transition, delay: i * 0.05 }} className="ch-shot">
              <img src={s.img} alt={`${s.name} の実際の画面`} loading="lazy" decoding="async" />
              <figcaption>
                <span style={{ fontFamily: FONT_EN, fontWeight: 700, fontSize: '0.9rem', color: '#fff', letterSpacing: '0.04em' }}>CORE {s.name}</span>
                <span style={{ fontFamily: FONT_JA, fontSize: '0.76rem', color: TEXT_MUTED }}>{s.cap}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
//  APPROACH — 進め方（6段）。「作って納める」との違いを1本の線で見せる。
// ============================================================
export function ApproachSection() {
  return (
    <section id="difference" className="lp-section-pad ch-approach" style={{ padding: '7rem 1.5rem', background: INK_2, scrollMarginTop: 70, position: 'relative', overflow: 'hidden' }}>
      <img src={IMG.texture} alt="" aria-hidden loading="lazy" decoding="async" className="ch-approach-bg" />
      <div className="ch-wrap" style={{ position: 'relative' }}>
        <div className="ch-head">
          <Kick>The Difference</Kick>
          <h2 style={{ ...sectionH2, margin: 0 }}>
            私たちは、会社そのものを
            <br />
            アップデートする。
          </h2>
          <p style={{ ...sectionLead, margin: '1.2rem 0 0', maxWidth: 600 }}>
            一般的な開発会社の仕事は「依頼されたものを作る → 納品 → 終了」で閉じます。CORE は、経営課題の分析から新規事業まで、一本の線でつなぎます。
          </p>
        </div>
        <ol className="ch-steps" style={{ listStyle: 'none', padding: 0, margin: '3.5rem 0 0' }}>
          {DIFF_CORE.map((s, i) => (
            <motion.li key={s} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} className="ch-step">
              <span className="ch-step-dot" aria-hidden />
              <span style={{ fontFamily: FONT_EN, fontSize: '0.7rem', letterSpacing: '0.22em', color: ACCENT, fontWeight: 700, display: 'block', marginBottom: 8 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: FONT_JA, fontSize: 'clamp(1rem, 1.4vw, 1.12rem)', fontWeight: 800, color: PAPER, lineHeight: 1.5 }}>{s}</span>
            </motion.li>
          ))}
        </ol>
        <p style={{ fontFamily: FONT_EN, fontSize: 'clamp(0.95rem, 1.6vw, 1.15rem)', color: TEXT_MUTED, letterSpacing: '0.02em', marginTop: '3rem', fontWeight: 500 }}>
          We don’t just build software. We change how the company works.
        </p>
      </div>
    </section>
  );
}

// ============================================================
//  ASSESSMENT — 診断。写真と5段の工程を2列で。
// ============================================================
export function AssessmentHome({ onAnchor }: { onAnchor: AnchorHandler }) {
  return (
    <section id="assessment" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, scrollMarginTop: 70 }}>
      <div className="ch-wrap ch-two">
        <motion.div {...reveal} className="ch-assess-media">
          <img src={IMG.assessment} alt="机の上のロードマップを指さす手元" loading="lazy" decoding="async" width={1600} height={1200} />
          <div className="ch-assess-tag">
            <span style={{ fontFamily: FONT_EN, fontSize: '0.62rem', letterSpacing: '0.24em', color: ACCENT_LIGHT, fontWeight: 700 }}>DELIVERABLE</span>
            <span style={{ fontFamily: FONT_JA, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>AI Transformation Roadmap</span>
            <span style={{ fontFamily: FONT_JA, fontSize: '0.76rem', color: TEXT_MUTED }}>どの業務を・どの順番で・いくらの効果を見込んで変えるか、実行できる1枚に。</span>
          </div>
        </motion.div>
        <div>
          <Kick>AI Transformation Assessment</Kick>
          <h2 style={{ ...sectionH2, margin: 0 }}>
            AI化すべき場所を、
            <br />
            先に決めます。
          </h2>
          <p style={{ ...sectionLead, margin: '1.2rem 0 1.8rem', maxWidth: 520 }}>
            「AIで何ができるか」から始めると、使われない仕組みができます。変えるべき場所を決めてから、作るものを決めます。
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.8rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {ASSESSMENT_TARGETS.map(t => (
              <li key={t} style={{ fontFamily: FONT_JA, fontSize: '0.76rem', color: 'rgba(236,242,250,0.82)', border: `1px solid ${LINE}`, borderRadius: 999, padding: '5px 11px' }}>{t}</li>
            ))}
          </ul>
          <ol className="ch-assess-steps" style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem' }}>
            {ASSESSMENT_STEPS.map(s => (
              <li key={s.no}>
                <span style={{ fontFamily: FONT_EN, fontSize: '0.72rem', letterSpacing: '0.2em', color: ACCENT, fontWeight: 700 }}>{s.no}</span>
                <span>
                  <strong style={{ fontFamily: FONT_JA, fontSize: '0.98rem', fontWeight: 800, color: PAPER, display: 'block', marginBottom: 2 }}>{s.title}</strong>
                  <span style={{ fontFamily: FONT_JA, fontSize: '0.84rem', color: TEXT_BODY, lineHeight: 1.85 }}>{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={ctaHero}>診断を相談する（無料）</a>
        </div>
      </div>
    </section>
  );
}

// ============================================================
//  FOUNDER — 代表の言葉。実在の写真（ceo-naoki-ide）を使う。
// ============================================================
export function FounderMessage({ onAnchor }: { onAnchor: AnchorHandler }) {
  return (
    <section id="philosophy" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK_2, scrollMarginTop: 70, position: 'relative', overflow: 'hidden' }}>
      <div className="ch-wrap ch-two" style={{ position: 'relative' }}>
        <div>
          <Kick>Founder’s Message</Kick>
          <h2 style={{ ...sectionH2, margin: 0 }}>
            技術は変わる。
            <br />
            人という核は、変わらない。
          </h2>
          <div style={{ fontFamily: FONT_JA, color: TEXT_BODY, fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)', lineHeight: 2.2, marginTop: '1.6rem', maxWidth: 560 }}>
            <p style={{ margin: '0 0 1.2rem' }}>
              私は神戸で、チェロを教えています。生徒が一曲を弾き切った日の顔は、どんな技術にも代えられません。
              けれど、その教室の裏では、予定の調整や請求書や連絡に、弾く時間より長い時間を使っていました。
              その時間を返してくれたのが、AIでした。
            </p>
            <p style={{ margin: '0 0 1.2rem' }}>
              AIも、ツールも、いずれ入れ替わります。五年前に正しかった構成は、五年後には残っていないかもしれません。
              では、何が残るのか。
            </p>
            <p style={{ margin: '0 0 1.2rem' }}>
              <strong style={{ color: PAPER, fontWeight: 800 }}>核とは、人だと、私は思っています。</strong>
              人の役に立つこと。人が価値を生むこと。人が人らしく笑っていられること。
              その核だけは、時代が変わっても同じです。
            </p>
            <p style={{ margin: '0 0 1.2rem' }}>
              私はチェロ奏者として舞台に立ってきました。音楽は、人の手でしか届かない。
              けれど、その手を空けるためにこそ、技術はある。AIが賢くなるほど、人の温度が価値になる。
              そう信じて、この会社をつくりました。
            </p>
            <p style={{ margin: 0 }}>
              CORE が見ているのは、売上の数字ではなく、人が輝いているかどうかです。
              最新の技術を、いちばん古い理由のために使い切る。それが、私たちの仕事です。
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: '2rem' }}>
            <div>
              <p style={{ fontFamily: FONT_JA, fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>{COMPANY_INFO.representative}</p>
              <p style={{ fontFamily: FONT_EN, fontSize: '0.74rem', letterSpacing: '0.12em', color: TEXT_MUTED, margin: '2px 0 0' }}>
                {COMPANY_INFO.representativeEn} — Founder &amp; CEO, {COMPANY_INFO.nameEn}
              </p>
            </div>
          </div>
          <p style={{ marginTop: '1.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem 1.6rem' }}>
            <a href="#philosophy-core" onClick={e => onAnchor(e, '#philosophy-core')} className="ch-textlink">会社の思想と概要を読む →</a>
            <a href={`mailto:${COMPANY_INFO.email}`} className="ch-textlink">この手紙には、返信できます →</a>
          </p>
        </div>
        <motion.div {...reveal} className="ch-founder-photo">
          <picture>
            <source srcSet="/ceo-naoki-ide-v2.webp" type="image/webp" />
            <img src="/ceo-naoki-ide-v2.jpg" alt={`${COMPANY_INFO.representative} / ${COMPANY_INFO.representativeEn} — Founder & CEO`} width={675} height={900} loading="lazy" decoding="async" />
          </picture>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
//  COMPANY — 会社概要（表）。SSOT の companyInfo だけを出す。
// ============================================================
export function CompanyOverview({ onAnchor }: { onAnchor: AnchorHandler }) {
  const rows: { k: string; en: string; v: React.ReactNode }[] = [
    { k: '会社名', en: 'Company', v: <>{COMPANY_INFO.name}<span className="ch-dl-sub">{COMPANY_INFO.nameEn}</span></> },
    { k: '設立', en: 'Founded', v: COMPANY_INFO.founded },
    { k: '資本金', en: 'Capital', v: COMPANY_INFO.capitalDisplay },
    { k: '代表取締役', en: 'CEO', v: <>{COMPANY_INFO.representative}<span className="ch-dl-sub">{COMPANY_INFO.representativeEn}</span></> },
    { k: '本社所在地', en: 'Headquarters', v: <>{COMPANY_INFO.addressJa}<span className="ch-dl-sub">{COMPANY_INFO.addressEn}</span></> },
    { k: '事業内容', en: 'Business', v: SERVICE_LAYERS.map(s => s.titleJa).join('／') + '／自社AIプロダクトの開発・運営' },
    { k: '連絡先', en: 'Contact', v: <a href={`mailto:${COMPANY_INFO.email}`} style={{ color: ACCENT_LIGHT, textDecoration: 'none' }}>{COMPANY_INFO.email}</a> },
  ];
  return (
    <section id="overview" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, scrollMarginTop: 70 }}>
      <div className="ch-wrap ch-two" style={{ alignItems: 'start' }}>
        <div>
          <Kick>Company</Kick>
          <h2 style={{ ...sectionH2, margin: 0 }}>会社概要</h2>
          <p style={{ ...sectionLead, margin: '1.2rem 0 0', maxWidth: 480 }}>
            神戸に本社を置くAI Transformation Companyです。相談から実装、運用まで、すべて自社で行います。
          </p>
          <div className="ch-overview-photo">
            <img src={IMG.kobeNight} alt="六甲山から見た神戸の夜景" loading="lazy" decoding="async" width={2400} height={1029} />
          </div>
        </div>
        <dl className="ch-dl">
          {rows.map(r => (
            <div key={r.k} className="ch-dl-row">
              <dt>
                <span style={{ fontFamily: FONT_JA, fontSize: '0.88rem', fontWeight: 700, color: PAPER, display: 'block' }}>{r.k}</span>
                <span style={{ fontFamily: FONT_EN, fontSize: '0.62rem', letterSpacing: '0.2em', color: TEXT_MUTED, textTransform: 'uppercase' }}>{r.en}</span>
              </dt>
              <dd style={{ margin: 0, fontFamily: FONT_JA, fontSize: '0.92rem', color: TEXT_BODY, lineHeight: 1.8 }}>{r.v}</dd>
            </div>
          ))}
          <div style={{ paddingTop: '1.4rem' }}>
            <a href="#about" onClick={e => onAnchor(e, '#about')} className="ch-textlink">提供状況・沿革などの詳細 →</a>
          </div>
        </dl>
      </div>
    </section>
  );
}

// ============================================================
//  FINAL CTA — 神戸の夜景の帯
// ============================================================
export function FinalCta({ onAnchor }: { onAnchor: AnchorHandler }) {
  return (
    <section id="cta" className="ch-band">
      <img src={IMG.kobeNight} alt="" aria-hidden loading="lazy" decoding="async" />
      <div className="ch-band-shade" aria-hidden />
      <div style={{ position: 'relative', maxWidth: 820, margin: '0 auto' }}>
        <Kick center>Let’s talk</Kick>
        <h2 style={{ ...sectionH2, fontSize: 'clamp(1.9rem, 4.2vw, 3.2rem)', margin: 0, color: '#fff' }}>
          まず、返したい仕事を
          <br />
          ひとつ教えてください。
        </h2>
        <p style={{ ...sectionLead, margin: '1.2rem auto 2.2rem', color: 'rgba(236,242,250,0.85)' }}>
          初回のご相談に費用はいただきません。その場で、AIに渡せる仕事と、人にしか出来ない仕事を切り分けてお返しします。
          御社の「核」を、一緒に守りに行きましょう。
        </p>
        <div className="ch-cta-row" style={{ justifyContent: 'center' }}>
          <a href="/roai-score" onClick={e => { rememberSource('home-final'); track('corp_cta_click', 'home-final'); onAnchor(e, '/roai-score'); }} style={ctaHero}>ROAIを無料診断する</a>
          <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={{ ...ctaGhost, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>AI Transformationを相談する</a>
        </div>
        <p style={{ fontFamily: FONT_JA, fontSize: '0.8rem', color: 'rgba(236,242,250,0.7)', margin: '1.2rem 0 0' }}>
          メールでのご相談は <a href={`mailto:${COMPANY_INFO.email}`} style={{ color: '#BAE6FD' }}>{COMPANY_INFO.email}</a>
        </p>
      </div>
    </section>
  );
}
