// ============================================================
// CORE Studio — 会社案内 (/studio/about) 2026-09-04 全面刷新
// 旧: 白い1段組に「代表メッセージ」「会社概要」のカード2枚。顔も映像も拠点も無かった。
// 新: 社是を見出しに、代表の写真を立てたヒーロー → 代表メッセージ + 企業紹介映像
//     → 代表の歩み → 3つの約束 → 会社概要 → 自社プロダクト8つ → 拠点 → 相談。
// 会社の基本情報は data/companyInfo.ts、文言は plans.ts の COMPANY が正本。
// 代表の歩みは COMPANY.message に書いてある事実からだけ組む (新しい経歴を足さない)。
// ============================================================
import { useRef, useState } from 'react';
import { COMPANY, REASONS, PROCESS, WORKS, CONTACT, CORE_PRODUCT_COUNT } from './plans';
import { FILM_WORKS } from './works';
import { COMPANY_INFO } from '../data/companyInfo';
import { C, D } from './theme';
import { Band, H2, Note, LineCta } from './ui';
import { PageStyle, PageHero, ProductsGrid, ClosingCta } from './PageHero';
import type { Go } from './tabs';

// 代表の歩み (COMPANY.message[1] の事実をそのまま4つに割る)
const PATH = [
  { no: '01', title: '歯学部', body: '医療を学ぶ。人のからだと、向き合う仕事の重さを知る。' },
  { no: '02', title: 'チューリッヒ', body: '音楽を学ぶ。ひとつの表現を、細部まで磨き上げる訓練を積む。' },
  { no: '03', title: '世界100カ国', body: '歩いて見てきた。業種も文化も違う事業を、その場で理解する土台になる。' },
  { no: '04', title: `株式会社CORE`, body: `${COMPANY_INFO.founded}、神戸で設立。AIプロダクトを自社で開発・運営しながら、制作と開発を請け負う。` },
];

// 3つの約束 (COMPANY.message[2] の3項目。本文は既存の PROCESS / REASONS から引く)
const PROMISES = [
  { title: '成果から逆算した設計', body: REASONS[1]?.body ?? '' },
  { title: 'ご契約時に確定する金額', body: PROCESS[2]?.body ?? '' },
  { title: '公開後も続く改善', body: PROCESS[5]?.body ?? '' },
];

// ---- 企業紹介映像 (/corp トップに掲載中のもの)。押すまで読み込まない ----
function BrandFilm() {
  const ref = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const play = () => {
    const el = ref.current;
    if (!el) return;
    setOn(true);
    el.muted = false;
    void el.play().catch(() => { /* 自動再生が拒否されたら controls から再生できる */ });
  };
  return (
    <figure className="sp-film" style={{ margin: 0 }}>
      <video ref={ref} src="/corp-creed-portrait.mp4" poster="/corp-creed-poster.webp" playsInline preload="none" controls={on} onEnded={() => setOn(false)} />
      {!on && (
        <>
          <button type="button" className="sp-film-play" onClick={play} aria-label="企業紹介映像を再生する">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          </button>
          <figcaption className="sp-film-cap">BRAND FILM — 企業紹介映像</figcaption>
        </>
      )}
    </figure>
  );
}

export default function AboutPage({ go }: { go: Go }) {
  const profile = [
    { k: '名称', v: COMPANY_INFO.name },
    { k: '英文名称', v: COMPANY_INFO.nameEn },
    { k: '代表', v: COMPANY_INFO.representative },
    { k: '設立', v: COMPANY_INFO.founded },
    { k: '資本金', v: COMPANY_INFO.capitalDisplay },
    { k: '所在地', v: COMPANY_INFO.addressJa },
    { k: '連絡先', v: <a href={`mailto:${COMPANY_INFO.email}`}>{COMPANY_INFO.email}</a> },
    { k: '事業内容', v: COMPANY.profile.find(p => p.label === '事業内容')?.value ?? '' },
  ];

  return (
    <div>
      <PageStyle />
      <PageHero
        en="Company"
        size="compact"
        title={<>いつの時代も、<br />変わらない核を。</>}
        lead="株式会社COREは、神戸を拠点に、映像制作・Webサイト制作・システム開発を行う制作会社です。AIプロダクトを自社で開発・運営し、そこで検証を重ねた設計と技術を、貴社の案件に投入します。"
        amb="/corp/kobe-night.webp"
        facts={[
          { v: COMPANY_INFO.founded, l: '設立' },
          { v: '神戸', l: '拠点' },
          { v: String(CORE_PRODUCT_COUNT), l: '自社開発・運営プロダクト' },
          { v: `${WORKS.length + FILM_WORKS.length}件`, l: '公開中の実績 (サイト・映像)' },
        ]}
        cta={<><LineCta where="about-hero" /><button className="st-btn st-btn-dark" onClick={() => go('works')}>実績を見る</button></>}
        note={CONTACT.lineNote}
        visual={
          <figure className="sp-portrait" style={{ margin: 0 }}>
            <picture>
              <source srcSet="/ceo-naoki-ide-v2.webp" type="image/webp" />
              <img src="/ceo-naoki-ide-v2.jpg" alt={`${COMPANY.repName} — ${COMPANY.repTitle}`} width={675} height={900} decoding="async" />
            </picture>
            <figcaption className="sp-portrait-name"><span>{COMPANY.repTitle} / Founder</span><b>{COMPANY.repName}</b></figcaption>
          </figure>
        }
      />

      {/* 代表メッセージ + 企業紹介映像 */}
      <Band wide pad="clamp(56px, 6vw, 88px) 0">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 36 }} className="sp-msg-grid">
          <div>
            <H2 en="Message">{COMPANY.messageTitle}</H2>
            <p className="sp-quote">{COMPANY.message[0]}</p>
            {COMPANY.message.slice(1).map(s => (
              <p key={s.slice(0, 12)} className="sp-msg">{s}</p>
            ))}
            <div style={{ marginTop: 22, paddingLeft: 14, borderLeft: `2px solid ${C.gold}` }}>
              <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{COMPANY.repName}</div>
              <div style={{ fontSize: 12.5, color: C.mute, marginTop: 2 }}>{COMPANY_INFO.name} {COMPANY.repTitle}</div>
            </div>
          </div>
          <div>
            <BrandFilm />
            <p style={{ fontSize: 12.5, color: C.mute, textAlign: 'center', margin: '12px 0 0', lineHeight: 1.8 }}>当社自身の企業紹介映像。制作もCORE Studioが担当しました。</p>
          </div>
        </div>
        <style>{`@media (min-width: 860px) { .sp-msg-grid { grid-template-columns: minmax(0, 1fr) 320px !important; align-items: start; } }`}</style>
      </Band>

      {/* 代表の歩み */}
      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <H2 en="Path" sub="分野の異なる知見は、業種ごとに大きく異なるお客様の事業を深く理解するための土台になっています。">代表の歩み</H2>
        <ol className="sp-path">
          {PATH.map(p => (
            <li key={p.no}>
              <span className="sp-tl-no">{p.no}</span>
              <div><b>{p.title}</b><p>{p.body}</p></div>
            </li>
          ))}
        </ol>
      </Band>

      {/* 3つの約束 */}
      <Band wide pad="clamp(52px, 6vw, 84px) 0">
        <H2 en="Promise" sub="どの案件でも変わらない、3つのお約束です。">私たちがお約束すること</H2>
        <div className="sp-grid3">
          {PROMISES.map((p, i) => (
            <div key={p.title} className="st-card">
              <span className="st-serif" style={{ display: 'block', fontSize: 15, fontWeight: 700, color: C.goldText, marginBottom: 10 }}>{String(i + 1).padStart(2, '0')}</span>
              <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.6 }}>{p.title}</div>
              <p style={{ fontSize: 14, lineHeight: 2, color: C.body, margin: '8px 0 0' }}>{p.body}</p>
            </div>
          ))}
        </div>
      </Band>

      {/* 会社概要 */}
      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <H2 en="Profile">会社概要</H2>
        <dl className="sp-dl">
          {profile.map(row => (
            <div key={row.k}><dt>{row.k}</dt><dd>{row.v}</dd></div>
          ))}
        </dl>
      </Band>

      {/* 自社プロダクト */}
      <section style={{ background: D.bg, padding: 'clamp(52px, 6vw, 84px) 0' }}>
        <div className="st-inner st-wide">
          <H2 dark en="Our products" sub="受託だけの会社ではありません。自分たちの事業として日々運営し、そこで検証した設計と技術を貴社の案件に投入します。">自社で開発・運営している{CORE_PRODUCT_COUNT}つのプロダクト</H2>
          <ProductsGrid />
        </div>
      </section>

      {/* 拠点 */}
      <Band wide pad="clamp(52px, 6vw, 84px) 0">
        <div className="sp-place">
          <img src="/corp/kobe-night.webp" alt="" loading="lazy" decoding="async" />
          <div className="sp-place-copy">
            <div className="st-label" style={{ color: D.gold, marginBottom: 12 }}>Kobe</div>
            <div className="st-serif" style={{ fontSize: 'clamp(20px, 2.6vw, 30px)', fontWeight: 700, lineHeight: 1.5 }}>神戸から、全国のご相談に。</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.9, color: D.body, margin: '12px 0 0', maxWidth: 520 }}>
              {COMPANY_INFO.addressJa}<br />
              打ち合わせはオンラインでも対面でも承ります。
            </p>
          </div>
        </div>
      </Band>

      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <ClosingCta title="貴社の事業を前に進めるパートナーとして。" body="映像・サイト・システム・運用、どの入口からでも構いません。まずはお気軽にご相談ください。">
          <LineCta where="about-bottom" />
          <div style={{ marginTop: 12 }}>
            <button className="st-btn st-btn-ghost" onClick={() => go('contact')}>先に概算を知る</button>
          </div>
          <Note>{CONTACT.lineNote}</Note>
        </ClosingCta>
      </Band>
    </div>
  );
}
