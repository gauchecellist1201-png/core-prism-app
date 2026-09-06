// ============================================================
// AshitakaPage — /ashitaka の本編（CORE WEB 2035・2026-09-06 改訂）
//   二つの固有名を分けて書く: ASHITAKA PROJECT（入口・文化で接点をつくる）／ REGIONAL OS（到達点・街と村の運営を再設計する）。
//   読者は自治体の首長・企画課と地域事業者（toB / toG）。言葉の正本は coreStory.ts（ASHITAKA / ASHITAKA_PAGE）。
//   演奏者（代表本人）は「AIの会社が演奏者を仕様書のように記述する」切り口で、他社との差として作り込む。
//   構想段階であることを「いまの段階」と FAQ で必ず言う（03_FACT_EVIDENCE_MAP D）。写真は実写のみ。
// ============================================================
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FONT_JA, FONT_EN, INK, INK_2, INK_3, LINE, ctaHero, ctaGhost, sectionH2, sectionLead, reveal } from './corpTheme';
import { Kick } from './roai/HomeRoaiSections';
import { rememberSource, track } from './roai/track';
import { SIZES_FULL, photoSrcSet } from './photoSet';
import { ASHITAKA, ASHITAKA_PAGE, STATUS_LABEL } from './coreStory';
import { Chain, StatusNote, PageHead, Lines, type AnchorHandler } from './StorySections';
import { rememberIntent } from './corpIntent';

/** 動きを減らす設定なら、弦の揺れ（SMIL）を描かない。 */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** 演奏者の計器 — 標準調弦の4弦。低い弦ほど大きくゆっくり揺れる。 */
function Strings({ strings, label, reduced }: { strings: readonly { n: string; hz: number }[]; label: string; reduced: boolean }) {
  const W = 640, H = 120;
  const rows = strings.map((s, i) => {
    const y = 18 + i * 28;
    const amp = 7 - i * 1.5;                 // C=7 G=5.5 D=4 A=2.5
    const dur = (1.9 - i * 0.35).toFixed(2); // C=1.90s … A=0.85s
    const up = `M0,${y} Q${W / 2},${y - amp} ${W},${y}`;
    const flat = `M0,${y} Q${W / 2},${y} ${W},${y}`;
    const down = `M0,${y} Q${W / 2},${y + amp} ${W},${y}`;
    return { ...s, y, up, flat, down, dur, thick: 2.4 - i * 0.4 };
  });
  return (
    <figure className="cs-strings" aria-label={label}>
      <figcaption style={{ fontFamily: FONT_EN }}>{label}</figcaption>
      <div className="cs-strings-body">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden focusable="false">
          {rows.map(r => (
            <g key={r.n}>
              <path d={r.flat} className="cs-string-ghost" />
              <path d={r.flat} className="cs-string" style={{ strokeWidth: r.thick }}>
                {!reduced && <animate attributeName="d" values={`${r.up};${r.flat};${r.down};${r.flat};${r.up}`} dur={`${r.dur}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" />}
              </path>
            </g>
          ))}
        </svg>
        <ol className="cs-strings-scale" style={{ fontFamily: FONT_EN }}>
          {rows.map(r => <li key={r.n}><b>{r.n}</b><span>{r.hz.toFixed(2)} Hz</span></li>)}
        </ol>
      </div>
    </figure>
  );
}

/** 演奏者 — 実写の現場（海／高原）を切り替える。 */
function Performer() {
  const P = ASHITAKA_PAGE.performer;
  const [field, setField] = useState<(typeof P.fields)[number]['id']>(P.fields[0].id);
  const reduced = useReducedMotion();
  const active = P.fields.find(f => f.id === field) ?? P.fields[0];
  return (
    <section id="ashitaka-performer" className="lp-section-pad cs-perf" style={{ padding: '7rem 1.5rem', background: INK_2, scrollMarginTop: 70 }} aria-labelledby="ashitaka-performer-h">
      <div className="ch-wrap">
        <PageHead id="ashitaka-performer-h" kicker={P.kicker} h2={P.h2} lead={P.lead} />
        <div className="cs-perf-grid">
          {/* 現場（実写） */}
          <motion.div {...reveal} className="cs-perf-media">
            <div className="cs-perf-frame">
              {P.fields.map(f => (
                <img key={f.id} src={f.img} srcSet={photoSrcSet(f.img, 1280)} sizes="(max-width: 900px) 100vw, 620px" alt={`${P.name} — ${f.ja}の演奏`} loading="lazy" decoding="async" width={f.w} height={f.h} className={'cs-perf-img' + (f.id === field ? ' is-on' : '')} />
              ))}
              <div className="cs-perf-frame-hud" style={{ fontFamily: FONT_EN }} aria-hidden>
                <span>FIELD RECORDING</span>
                <span>{active.en}</span>
              </div>
            </div>
            <div className="cs-perf-fields" role="tablist" aria-label="演奏の現場">
              {P.fields.map(f => (
                <button key={f.id} type="button" role="tab" aria-selected={f.id === field} className={'cs-perf-field' + (f.id === field ? ' is-on' : '')} onClick={() => { setField(f.id); track('corp_cta_click', `performer-field-${f.id}`); }} style={{ fontFamily: FONT_JA }}>
                  <span style={{ fontFamily: FONT_EN }}>{f.en}</span>{f.ja}
                </button>
              ))}
              <p className="cs-perf-cap" style={{ fontFamily: FONT_JA }}>{active.cap}</p>
            </div>
          </motion.div>

          {/* 仕様書 */}
          <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="cs-perf-sheet" style={{ fontFamily: FONT_JA }}>
            <header className="cs-perf-name">
              <p className="cs-perf-en" style={{ fontFamily: FONT_EN }}>{P.name}</p>
              <p className="cs-perf-ja">{P.nameJa}</p>
              <p className="cs-perf-title">{P.title}</p>
            </header>
            <dl className="cs-perf-spec">
              {P.spec.map(r => (
                <div key={r.k}>
                  <dt style={{ fontFamily: FONT_EN }}>{r.k}</dt>
                  <dd>{r.v}</dd>
                </div>
              ))}
            </dl>
            <Strings strings={P.strings} label={P.stringsLabel} reduced={reduced} />
            <div className="cs-perf-venues">
              <p className="cs-perf-venues-label" style={{ fontFamily: FONT_EN }}>{P.venues.label}</p>
              <div className="cs-perf-venue-row"><span style={{ fontFamily: FONT_EN }}>JP</span><ul>{P.venues.domestic.map(v => <li key={v}>{v}</li>)}</ul></div>
              <div className="cs-perf-venue-row"><span style={{ fontFamily: FONT_EN }}>ABROAD</span><ul>{P.venues.overseas.map(v => <li key={v}>{v}</li>)}</ul></div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default function AshitakaPage({ onAnchor }: { onAnchor: AnchorHandler }) {
  const consult = (e: React.MouseEvent<HTMLAnchorElement>, where: string) => {
    rememberIntent('地域・自治体（Ashitaka）', 'region');
    rememberSource(where);
    track('corp_intent', 'region');
    track('corp_cta_click', where);
    onAnchor(e, '#contact');
  };
  const E = ASHITAKA_PAGE.entities;
  const H = ASHITAKA_PAGE.handoff;
  const D = ASHITAKA_PAGE.day;
  const R = ASHITAKA_PAGE.regionalOs;
  const O = ASHITAKA_PAGE.offer;
  return (
    <>
      {/* 入口（実写・広い高原に一人） */}
      <section id="ashitaka-top" className="cs-bleed cs-page-hero" aria-labelledby="ashitaka-page-h">
        <img src="/corp/ashitaka-plateau-wide.webp" srcSet={photoSrcSet('/corp/ashitaka-plateau-wide.webp', 1280)} sizes={SIZES_FULL} alt="" aria-hidden width={1280} height={572} fetchPriority="high" />
        <div className="cs-bleed-shade" aria-hidden />
        <div className="ch-wrap cs-bleed-inner">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} style={{ maxWidth: 860 }}>
            <Kick>{ASHITAKA.kicker}</Kick>
            <h1 id="ashitaka-page-h" className="cs-bleed-h" style={{ fontFamily: FONT_JA }}><Lines text={ASHITAKA.h2} /></h1>
            <p className="cs-principle" style={{ fontFamily: FONT_JA }}>{ASHITAKA.principle}</p>
            <p className="cs-bleed-lead" style={{ fontFamily: FONT_JA, maxWidth: 720 }}>{ASHITAKA.lead}</p>
            <div className="ch-cta-row" style={{ marginTop: '1.8rem' }}>
              <a href="#contact" onClick={e => consult(e, 'ashitaka-hero')} style={ctaHero}>{ASHITAKA.ctaSecondary}</a>
              <a href="#ashitaka-entities" onClick={e => onAnchor(e, '#ashitaka-entities')} style={ctaGhost}>二つの固有名を読む</a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 二つの固有名（入口と到達点を分ける） */}
      <section id="ashitaka-entities" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, scrollMarginTop: 70 }} aria-labelledby="ashitaka-entities-h">
        <div className="ch-wrap">
          <PageHead id="ashitaka-entities-h" kicker={E.kicker} h2={E.h2} lead={E.lead} />
          <div className="cs-split">
            {E.items.map((it, i) => (
              <motion.article key={it.id} {...reveal} transition={{ ...reveal.transition, delay: i * 0.1 }} className={'cs-split-card is-' + it.id} style={{ fontFamily: FONT_JA }} aria-labelledby={`ent-${it.id}-h`}>
                {it.id === 'ashitaka'
                  ? <img src="/corp/ashitaka-sea.webp" srcSet={photoSrcSet('/corp/ashitaka-sea.webp', 1280)} sizes="(max-width: 900px) 100vw, 580px" alt="" aria-hidden loading="lazy" decoding="async" width={1280} height={720} className="cs-split-bg" />
                  : <div className="cs-split-grid" aria-hidden />}
                <div className="cs-split-body">
                  <p className="cs-split-role" style={{ fontFamily: FONT_EN }}><span>{String(i + 1).padStart(2, '0')}</span>{it.role} — {it.roleJa}</p>
                  <h3 id={`ent-${it.id}-h`} className="cs-split-en" style={{ fontFamily: FONT_EN }}>{it.en}</h3>
                  <p className="cs-split-ja">{it.ja}</p>
                  <p className="cs-split-text">{it.body}</p>
                  <ul className="cs-split-points">{it.points.map(p => <li key={p}>{p}</li>)}</ul>
                  <p className="cs-split-status" style={{ fontFamily: FONT_EN }}><span aria-hidden className="cs-status-dot" />NEXT<span style={{ fontFamily: FONT_JA, letterSpacing: '0.04em' }}>{STATUS_LABEL.NEXT}</span></p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* 引き渡し（2区間の道筋） */}
      <section id="ashitaka-handoff" className="lp-section-pad" style={{ padding: '6.5rem 1.5rem', background: INK_2, borderTop: `1px solid ${LINE}`, scrollMarginTop: 70 }} aria-labelledby="ashitaka-handoff-h">
        <div className="ch-wrap">
          <PageHead id="ashitaka-handoff-h" kicker={H.kicker} h2={H.h2} lead={H.lead} />
          <motion.div {...reveal} className="cs-handoff">
            <div className="cs-handoff-seg">
              <p className="cs-handoff-label" style={{ fontFamily: FONT_EN }}>ASHITAKA PROJECT<span style={{ fontFamily: FONT_JA }}>集める</span></p>
              <Chain steps={H.ashitaka} compact accent={false} />
            </div>
            <div className="cs-handoff-arrow" aria-hidden>
              <svg viewBox="0 0 64 16" width="64" height="16" focusable="false"><line x1="0" y1="8" x2="54" y2="8" stroke="#38BDF8" strokeWidth="1.5" /><polyline points="46,1 54,8 46,15" fill="none" stroke="#38BDF8" strokeWidth="1.5" /></svg>
              <span style={{ fontFamily: FONT_EN }}>HANDOFF</span>
            </div>
            <div className="cs-handoff-seg is-os">
              <p className="cs-handoff-label" style={{ fontFamily: FONT_EN }}>REGIONAL OS<span style={{ fontFamily: FONT_JA }}>変える</span></p>
              <Chain steps={H.regionalOs} compact />
            </div>
          </motion.div>
        </div>
      </section>

      {/* 演奏者 */}
      <Performer />

      {/* ONE REGION, ONE STORY */}
      <section id="one-region" className="cs-bleed" style={{ minHeight: 'clamp(420px, 60vh, 640px)', scrollMarginTop: 70 }} aria-labelledby="one-region-h">
        <img src="/corp/ashitaka-plateau-aerial.webp" srcSet={photoSrcSet('/corp/ashitaka-plateau-aerial.webp', 1280)} sizes={SIZES_FULL} alt="" aria-hidden loading="lazy" decoding="async" width={1280} height={572} />
        <div className="cs-bleed-shade is-center" aria-hidden />
        <div className="ch-wrap cs-bleed-inner is-center">
          <motion.div {...reveal} style={{ maxWidth: 720, margin: '0 auto' }}>
            <Kick center>{ASHITAKA.oneRegion.en}</Kick>
            <h2 id="one-region-h" className="cs-bleed-h" style={{ fontFamily: FONT_JA, fontSize: 'clamp(2rem, 4.4vw, 3.6rem)' }}><Lines text={ASHITAKA.oneRegion.ja} /></h2>
            <p className="cs-bleed-lead" style={{ fontFamily: FONT_JA }}>{ASHITAKA.oneRegion.body}</p>
          </motion.div>
        </div>
      </section>

      {/* 一日を工程として設計する */}
      <section id="ashitaka-day" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, scrollMarginTop: 70 }} aria-labelledby="ashitaka-day-h">
        <div className="ch-wrap">
          <PageHead id="ashitaka-day-h" kicker={D.kicker} h2={D.h2} lead={D.lead} />
          <motion.ol {...reveal} className="cs-program" style={{ fontFamily: FONT_JA }}>
            {D.steps.map((s, i) => (
              <li key={s.t} className="cs-program-step">
                <span className="cs-program-no" style={{ fontFamily: FONT_EN }}>{String(i + 1).padStart(2, '0')}</span>
                <p className="cs-program-t">{s.t}</p>
                <p className="cs-program-b">{s.b}</p>
              </li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* REGIONAL OS */}
      <section id="regional-os" className="lp-section-pad cs-os" style={{ padding: '7rem 1.5rem', background: INK_3, scrollMarginTop: 70 }} aria-labelledby="regional-os-h">
        <div className="cs-split-grid cs-os-bg" aria-hidden />
        <div className="ch-wrap" style={{ position: 'relative' }}>
          <PageHead id="regional-os-h" kicker={R.kicker} h2={R.h2} lead={R.lead} />
          <motion.ol {...reveal} className="cs-os-layers" style={{ fontFamily: FONT_JA }} aria-label="REGIONAL OS の四つの層">
            {R.layers.map((l, i) => (
              <li key={l.en} className="cs-os-layer" style={{ ['--i' as string]: i }}>
                <span className="cs-os-en" style={{ fontFamily: FONT_EN }}>{l.en}</span>
                <div>
                  <p className="cs-os-ja">{l.ja}</p>
                  <p className="cs-os-body">{l.body}</p>
                </div>
              </li>
            ))}
          </motion.ol>
          <motion.div {...reveal} style={{ marginTop: '3rem' }}>
            <p style={{ ...sectionLead, margin: 0 }}>{R.processLead}</p>
            <Chain steps={R.process} compact />
          </motion.div>
          <motion.div {...reveal} style={{ marginTop: '2.2rem', maxWidth: 760 }}>
            <StatusNote label={R.status.label} body={R.status.body} />
          </motion.div>
        </div>
      </section>

      {/* 自治体・地域事業者へ提供できること */}
      <section id="ashitaka-offer" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, borderTop: `1px solid ${LINE}`, scrollMarginTop: 70 }} aria-labelledby="ashitaka-offer-h">
        <div className="ch-wrap">
          <PageHead id="ashitaka-offer-h" kicker={O.kicker} h2={O.h2} />
          <div className="cs-offer">
            <motion.ol {...reveal} className="cs-offer-now" style={{ fontFamily: FONT_JA }}>
              {O.now.map((o, i) => (
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
                {O.next.map(n => <li key={n}>{n}</li>)}
              </ul>
              <dl className="cs-terms" style={{ fontFamily: FONT_JA }}>
                {O.terms.map(t => (
                  <div key={t.k}><dt>{t.k}</dt><dd>{t.v}</dd></div>
                ))}
              </dl>
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
