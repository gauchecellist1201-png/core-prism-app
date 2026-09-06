// ============================================================
// EnergyPage — /energy の本編（CORE WEB 2035・2026-09-06）
//   CORE Energy は長期の事業領域（VISION）。電力事業者でもインフラ所有者でもないと必ず言う。
//   言葉の正本は coreStory.ts（ENERGY / ENERGY_PAGE）。
// ============================================================
import { motion } from 'framer-motion';
import { FONT_JA, FONT_EN, INK, INK_2, LINE, ctaHero, ctaGhost, sectionH2, sectionLead, reveal } from './corpTheme';
import { Kick } from './roai/HomeRoaiSections';
import { rememberSource, track } from './roai/track';
import { SIZES_FULL, photoSrcSet } from './photoSet';
import { ENERGY, ENERGY_PAGE } from './coreStory';
import { Chain, StatusNote, PageHead, Lines, type AnchorHandler } from './StorySections';
import { rememberIntent } from './corpIntent';

export default function EnergyPage({ onAnchor }: { onAnchor: AnchorHandler }) {
  const consult = (e: React.MouseEvent<HTMLAnchorElement>, where: string) => {
    rememberIntent('エネルギー', 'energy');
    rememberSource(where);
    track('corp_intent', 'energy');
    track('corp_cta_click', where);
    onAnchor(e, '#contact');
  };
  return (
    <>
      {/* 入口（夜明けの山・実写） */}
      <section id="energy-top" className="cs-bleed cs-page-hero" aria-labelledby="energy-page-h">
        <img src="/corp/ashitaka-dawn.webp" srcSet={photoSrcSet('/corp/ashitaka-dawn.webp', 1280)} sizes={SIZES_FULL} alt="" aria-hidden width={1280} height={504} fetchPriority="high" />
        <div className="cs-bleed-shade" aria-hidden />
        <div className="ch-wrap cs-bleed-inner">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} style={{ maxWidth: 820 }}>
            <Kick>{ENERGY.kicker}</Kick>
            <h1 id="energy-page-h" className="cs-bleed-h" style={{ fontFamily: FONT_JA }}><Lines text={ENERGY.h2} /></h1>
            <p className="cs-bleed-lead" style={{ fontFamily: FONT_JA }}>{ENERGY.lead}</p>
            <div className="ch-cta-row" style={{ marginTop: '1.8rem' }}>
              <a href="#contact" onClick={e => consult(e, 'energy-hero')} style={ctaHero}>{ENERGY.ctaSecondary}</a>
              <a href="#energy-logic" onClick={e => onAnchor(e, '#energy-logic')} style={ctaGhost}>考え方を読む</a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 論理 */}
      <section id="energy-logic" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, scrollMarginTop: 70 }} aria-labelledby="energy-logic-h">
        <div className="ch-wrap cs-connection">
          <motion.div {...reveal}>
            <Kick>{ENERGY_PAGE.logic.kicker}</Kick>
            <h2 id="energy-logic-h" style={{ ...sectionH2, margin: 0 }}><Lines text={ENERGY_PAGE.logic.h2} /></h2>
            <ul className="cs-logic-lines" style={{ fontFamily: FONT_JA }}>
              {ENERGY_PAGE.logic.lines.map(l => <li key={l}>{l}</li>)}
            </ul>
            <p style={{ ...sectionLead, margin: 0 }}>{ENERGY_PAGE.logic.body}</p>
          </motion.div>
          <motion.div {...reveal} className="ch-row-media" style={{ aspectRatio: '4 / 3' }}>
            <img src="/corp/datacenter.webp" srcSet={photoSrcSet('/corp/datacenter.webp')} sizes="(max-width: 900px) 100vw, 560px" alt="データセンターの通路" loading="lazy" decoding="async" width={2000} height={1125} />
          </motion.div>
        </div>
      </section>

      {/* 地域の資源 × 交点 */}
      <section id="energy-intersection" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK_2, scrollMarginTop: 70 }} aria-labelledby="energy-intersection-h">
        <div className="ch-wrap">
          <PageHead id="energy-intersection-h" kicker={ENERGY_PAGE.intersection.kicker} h2={ENERGY_PAGE.intersection.h2} lead={ENERGY.region} />
          <motion.p {...reveal} style={{ ...sectionLead, margin: '1rem 0 0' }}>{ENERGY_PAGE.intersection.body}</motion.p>
          <motion.div {...reveal}><Chain steps={ENERGY_PAGE.intersection.chain} /></motion.div>
          <motion.ul {...reveal} className="cs-fields" style={{ fontFamily: FONT_JA }} aria-label="将来の領域">
            {ENERGY.fields.map(f => <li key={f}>{f}</li>)}
          </motion.ul>
        </div>
      </section>

      {/* 段階 */}
      <section id="energy-stages" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, borderTop: `1px solid ${LINE}`, scrollMarginTop: 70 }} aria-labelledby="energy-stages-h">
        <div className="ch-wrap">
          <PageHead id="energy-stages-h" kicker="The Sequence" h2={'資産を持たず、\n知性と設計から始める。'} lead="サービスから、ソフトウェアへ。ソフトウェアから、プラットフォームへ。段階を飛ばしません。" />
          <div className="cs-energy-grid" style={{ marginTop: '2.6rem' }}>
            <motion.ol {...reveal} className="cs-stages" style={{ fontFamily: FONT_JA }}>
              {ENERGY.stages.map(s => (
                <li key={s.when} className="cs-stage">
                  <span className="cs-stage-when" style={{ fontFamily: FONT_EN }}>{s.when}</span>
                  <p className="cs-stage-en" style={{ fontFamily: FONT_EN }}>{s.en}</p>
                  <p className="cs-stage-ja">{s.ja}</p>
                  <p className="cs-stage-body">{s.body}</p>
                </li>
              ))}
            </motion.ol>
            <motion.div {...reveal}>
              <StatusNote label={ENERGY.honest.label} body={ENERGY.honest.body} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="energy-cta" className="cs-bleed" style={{ minHeight: 'clamp(420px, 56vh, 600px)', scrollMarginTop: 70 }} aria-labelledby="energy-cta-h">
        <img src="/corp/kobe-night.webp" srcSet={photoSrcSet('/corp/kobe-night.webp')} sizes={SIZES_FULL} alt="" aria-hidden loading="lazy" decoding="async" width={2000} height={1125} />
        <div className="cs-bleed-shade is-center" aria-hidden />
        <div className="ch-wrap cs-bleed-inner is-center">
          <motion.div {...reveal} style={{ maxWidth: 760, margin: '0 auto' }}>
            <Kick center>Let’s talk</Kick>
            <h2 id="energy-cta-h" style={{ ...sectionH2, margin: 0, color: '#fff' }}><Lines text={ENERGY_PAGE.cta.h2} /></h2>
            <div className="ch-cta-row" style={{ justifyContent: 'center', marginTop: '1.8rem' }}>
              <a href="#contact" onClick={e => consult(e, 'energy-cta')} style={ctaHero}>{ENERGY_PAGE.cta.primary}</a>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
