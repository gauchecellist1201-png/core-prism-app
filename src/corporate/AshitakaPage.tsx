// ============================================================
// AshitakaPage — /ashitaka の本編（CORE WEB 2035・2026-09-06）
//   カテゴリ: CULTURE-LED REGIONAL TRANSFORMATION。コンサート事業ではない。
//   言葉の正本は coreStory.ts（ASHITAKA / ASHITAKA_PAGE）。写真は実写のみ。
//   構想段階であることを「いまの段階」と FAQ で必ず言う（03_FACT_EVIDENCE_MAP D）。
// ============================================================
import { motion } from 'framer-motion';
import { FONT_JA, FONT_EN, INK, INK_2, LINE, ctaHero, ctaGhost, sectionH2, reveal } from './corpTheme';
import { Kick } from './roai/HomeRoaiSections';
import { rememberSource, track } from './roai/track';
import { SIZES_FULL, photoSrcSet } from './photoSet';
import { ASHITAKA, ASHITAKA_PAGE } from './coreStory';
import { Chain, StatusNote, PageHead, Lines, type AnchorHandler } from './StorySections';
import { rememberIntent } from './corpIntent';

export default function AshitakaPage({ onAnchor }: { onAnchor: AnchorHandler }) {
  const consult = (e: React.MouseEvent<HTMLAnchorElement>, where: string) => {
    rememberIntent('地域・自治体（Ashitaka）', 'region');
    rememberSource(where);
    track('corp_intent', 'region');
    track('corp_cta_click', where);
    onAnchor(e, '#contact');
  };
  return (
    <>
      {/* 入口（実写・広い高原に一人） */}
      <section id="ashitaka-top" className="cs-bleed cs-page-hero" aria-labelledby="ashitaka-page-h">
        <img src="/corp/ashitaka-plateau-wide.webp" srcSet={photoSrcSet('/corp/ashitaka-plateau-wide.webp', 1280)} sizes={SIZES_FULL} alt="" aria-hidden width={1280} height={572} fetchPriority="high" />
        <div className="cs-bleed-shade" aria-hidden />
        <div className="ch-wrap cs-bleed-inner">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} style={{ maxWidth: 820 }}>
            <Kick>{ASHITAKA.kicker}</Kick>
            <h1 id="ashitaka-page-h" className="cs-bleed-h" style={{ fontFamily: FONT_JA }}><Lines text={ASHITAKA.h2} /></h1>
            <p className="cs-principle" style={{ fontFamily: FONT_JA }}>{ASHITAKA.principle}</p>
            <p className="cs-bleed-lead" style={{ fontFamily: FONT_JA }}>{ASHITAKA.lead}</p>
            <div className="ch-cta-row" style={{ marginTop: '1.8rem' }}>
              <a href="#contact" onClick={e => consult(e, 'ashitaka-hero')} style={ctaHero}>{ASHITAKA.ctaSecondary}</a>
              <a href="#ashitaka-model" onClick={e => onAnchor(e, '#ashitaka-model')} style={ctaGhost}>道筋を読む</a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* モデル（13段） */}
      <section id="ashitaka-model" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, scrollMarginTop: 70 }} aria-labelledby="ashitaka-model-h">
        <div className="ch-wrap">
          <PageHead id="ashitaka-model-h" kicker="The Model" h2={'一日の音楽が、\n長期の地域価値になるまで。'} lead="入口は音楽。けれど、そこで終わらせません。感情が人を動かし、人の動きが注目になり、注目が来訪と関係人口になり、地域のブランドが立つ。そこからCOREの本業——AI・DX・産業・エネルギー——が始まります。" />
          <motion.div {...reveal}><Chain steps={ASHITAKA.chainFull} /></motion.div>
        </div>
      </section>

      {/* ONE REGION, ONE STORY */}
      <section id="one-region" className="cs-bleed" style={{ minHeight: 'clamp(420px, 60vh, 640px)', scrollMarginTop: 70 }} aria-labelledby="one-region-h">
        <img src="/corp/ashitaka-sea.webp" srcSet={photoSrcSet('/corp/ashitaka-sea.webp', 1280)} sizes={SIZES_FULL} alt="" aria-hidden loading="lazy" decoding="async" width={1280} height={720} />
        <div className="cs-bleed-shade is-center" aria-hidden />
        <div className="ch-wrap cs-bleed-inner is-center">
          <motion.div {...reveal} style={{ maxWidth: 720, margin: '0 auto' }}>
            <Kick center>{ASHITAKA.oneRegion.en}</Kick>
            <h2 id="one-region-h" className="cs-bleed-h" style={{ fontFamily: FONT_JA }}><Lines text={ASHITAKA.oneRegion.ja} /></h2>
            <p className="cs-bleed-lead" style={{ fontFamily: FONT_JA }}>{ASHITAKA.oneRegion.body}</p>
          </motion.div>
        </div>
      </section>

      {/* 一つの日（体験） */}
      <section id="ashitaka-day" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK_2, scrollMarginTop: 70 }} aria-labelledby="ashitaka-day-h">
        <div className="ch-wrap">
          <PageHead id="ashitaka-day-h" kicker={ASHITAKA_PAGE.experience.kicker} h2={ASHITAKA_PAGE.experience.h2} />
          <motion.ul {...reveal} className="cs-scenes" style={{ fontFamily: FONT_JA }}>
            {ASHITAKA_PAGE.experience.scenes.map(s => <li key={s}>{s}</li>)}
          </motion.ul>
          <motion.p {...reveal} style={{ fontFamily: FONT_JA, fontSize: 'clamp(1rem, 1.5vw, 1.12rem)', lineHeight: 2, color: 'rgba(226,232,240,0.85)', maxWidth: 760, margin: '2.2rem 0 0' }}>
            {ASHITAKA_PAGE.experience.then}
          </motion.p>
        </div>
      </section>

      {/* 自治体・地域へ提供できること */}
      <section id="ashitaka-offer" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, scrollMarginTop: 70 }} aria-labelledby="ashitaka-offer-h">
        <div className="ch-wrap">
          <PageHead id="ashitaka-offer-h" kicker={ASHITAKA_PAGE.offer.kicker} h2={ASHITAKA_PAGE.offer.h2} />
          <div className="cs-offer">
            <motion.ol {...reveal} className="cs-offer-now" style={{ fontFamily: FONT_JA }}>
              {ASHITAKA_PAGE.offer.now.map((o, i) => (
                <li key={o.t}>
                  <span style={{ fontFamily: FONT_EN, fontSize: '0.78rem', letterSpacing: '0.2em', color: '#38BDF8', fontWeight: 700, paddingTop: 4 }}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="cs-offer-t">{o.t}</p>
                    <p className="cs-offer-b">{o.b}</p>
                  </div>
                </li>
              ))}
            </motion.ol>
            <motion.div {...reveal}>
              <p style={{ fontFamily: FONT_EN, fontSize: '0.7rem', letterSpacing: '0.26em', color: 'rgba(226,232,240,0.6)', fontWeight: 700, margin: '0 0 0.8rem' }}>NEXT — これから</p>
              <ul className="cs-offer-next" style={{ fontFamily: FONT_JA }}>
                {ASHITAKA_PAGE.offer.next.map(n => <li key={n}>{n}</li>)}
              </ul>
              <div style={{ marginTop: '1.2rem' }}>
                <StatusNote label={ASHITAKA.status.label} body={ASHITAKA.status.body} />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="ashitaka-faq" className="lp-section-pad" style={{ padding: '6rem 1.5rem', background: INK_2, borderTop: `1px solid ${LINE}`, scrollMarginTop: 70 }} aria-labelledby="ashitaka-faq-h">
        <div className="ch-wrap" style={{ maxWidth: 860 }}>
          <PageHead id="ashitaka-faq-h" kicker="FAQ" h2="よくある質問" />
          <motion.div {...reveal} className="cs-faq" style={{ fontFamily: FONT_JA }}>
            {ASHITAKA_PAGE.faq.map(f => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section id="ashitaka-cta" className="cs-bleed" style={{ minHeight: 'clamp(420px, 56vh, 600px)', scrollMarginTop: 70 }} aria-labelledby="ashitaka-cta-h">
        <img src="/corp/ashitaka-sea-play.webp" srcSet={photoSrcSet('/corp/ashitaka-sea-play.webp', 1280)} sizes={SIZES_FULL} alt="" aria-hidden loading="lazy" decoding="async" width={1280} height={720} />
        <div className="cs-bleed-shade is-center" aria-hidden />
        <div className="ch-wrap cs-bleed-inner is-center">
          <motion.div {...reveal} style={{ maxWidth: 720, margin: '0 auto' }}>
            <Kick center>Let’s begin</Kick>
            <h2 id="ashitaka-cta-h" style={{ ...sectionH2, margin: 0, color: '#fff' }}><Lines text={ASHITAKA_PAGE.cta.h2} /></h2>
            <div className="ch-cta-row" style={{ justifyContent: 'center', marginTop: '1.8rem' }}>
              <a href="#contact" onClick={e => consult(e, 'ashitaka-cta')} style={ctaHero}>{ASHITAKA_PAGE.cta.primary}</a>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
