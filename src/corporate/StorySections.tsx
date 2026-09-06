// ============================================================
// StorySections — CORE WEB 2035（2026-09-06）ホームの新しい章。
//
//   THE CHANGE（技術は変わる。本質は変わらない）／PROCESS（AIから考えない）／ONE CORE（4層）／
//   STUDIO（伝える層）／BRIDGE（会社の境界を越える）／ASHITAKA／ENERGY／CONNECTION／CORE 2035／INVITATION。
//   言葉の正本は coreStory.ts。写真は public/corp/ashitaka-*.webp（オーナー本人の演奏映像から切り出した実写）。
//
//   計測: 各章が画面に入ったら corp_interest を1回だけ送る（「誰が何に興味を持ったか」の母数）。
//   演出: reveal（0.9秒）だけ。ASHITAKA のループ動画は画面に入ってから取りに行き、
//         reduced-motion / saveData では再生しない（ヒーローの規律と同じ）。
// ============================================================
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { motion } from 'framer-motion';
import { FONT_JA, FONT_EN, LINE, INK, INK_2, ctaHero, ctaGhost, sectionH2, sectionLead, reveal } from './corpTheme';
import { Kick } from './roai/HomeRoaiSections';
import { rememberSource, track } from './roai/track';
import { rememberIntent } from './corpIntent';
import { SIZES_FULL, photoSrcSet } from './photoSet';
import { FILM_WORKS } from '../studio/works';
import {
  CHANGE, PROCESS, ONE_CORE, STUDIO, BRIDGE, ASHITAKA, ENERGY, CONNECTION, VISION, INVITE, STATUS_LABEL,
  type LayerStatus,
} from './coreStory';

type AnchorHandler = (e: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;

/** 章が画面に入ったら1回だけ corp_interest を送る。 */
function useInterest(label: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    let done = false;
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting || done) return;
      done = true; io.disconnect(); track('corp_interest', label);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [label]);
  return ref;
}

/** 見出しの改行。"\n" は常に改行、"|" は電話（640px以下）だけ改行（.ch-br-m）。
 *  長い日本語の見出しが「物／語。」のように途中で折れるのを、文言側で制御する。 */
export function Lines({ text }: { text: string }) {
  const parts = text.split('\n');
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p.split('|').map((q, j, a) => <span key={j}>{q}{j < a.length - 1 && <br className="ch-br-m" />}</span>)}
          {i < parts.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

/** 状態の札。構想と実績を混ぜないための語。 */
function StatusBadge({ status }: { status: LayerStatus }) {
  const on = status === 'NOW' || status === 'ENGINE';
  return (
    <span className={'cs-status' + (on ? ' is-on' : '')} style={{ fontFamily: FONT_EN }}>
      <span aria-hidden className="cs-status-dot" />
      {status}
      <span style={{ fontFamily: FONT_JA, letterSpacing: '0.04em' }}>{STATUS_LABEL[status]}</span>
    </span>
  );
}

/** 道筋（矢印でつなぐ札）。PCは横に折り返し、電話では縦に積む。 */
export function Chain({ steps, accent = true, compact }: { steps: readonly string[]; accent?: boolean; compact?: boolean }) {
  return (
    <ol className={'cs-chain' + (accent ? ' is-accent' : '') + (compact ? ' is-compact' : '')} style={{ fontFamily: FONT_JA }}>
      {steps.map((s, i) => (
        <li key={s + i} className="cs-chain-step">
          <span className="cs-chain-no" style={{ fontFamily: FONT_EN }}>{String(i + 1).padStart(2, '0')}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** 「いまの段階」。正直さを、見た目でも1つの塊にする。 */
export function StatusNote({ label, body }: { label: string; body: string }) {
  return (
    <aside className="cs-note" style={{ fontFamily: FONT_JA }} aria-label={label}>
      <p className="cs-note-label" style={{ fontFamily: FONT_EN }}>
        <span aria-hidden className="cs-status-dot" />{label}
      </p>
      <p className="cs-note-body">{body}</p>
    </aside>
  );
}

// ============================================================
//  03 THE CHANGE — 技術は変わる。本質は変わらない。
// ============================================================
export function TheChange() {
  return (
    <section id="change" className="cs-change lp-section-pad" style={{ scrollMarginTop: 70 }} aria-labelledby="change-h">
      <div className="ch-wrap">
        <motion.div {...reveal} className="ch-head">
          <Kick>{CHANGE.kicker}</Kick>
          <h2 id="change-h" style={{ ...sectionH2, margin: 0 }}><Lines text={CHANGE.h2} /></h2>
          <p style={{ ...sectionLead, margin: '1.2rem 0 0' }}>{CHANGE.lead}</p>
        </motion.div>
        <div className="cs-change-grid">
          <motion.div {...reveal} className="cs-change-col is-changing">
            <p className="cs-change-label" style={{ fontFamily: FONT_EN }}>{CHANGE.changingLabel}</p>
            <ul style={{ fontFamily: FONT_JA }}>{CHANGE.changing.map(c => <li key={c}>{c}</li>)}</ul>
          </motion.div>
          <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.12 }} className="cs-change-col is-constant">
            <p className="cs-change-label" style={{ fontFamily: FONT_EN }}>{CHANGE.constantLabel}</p>
            <ul style={{ fontFamily: FONT_JA }}>{CHANGE.constant.map(c => <li key={c}>{c}</li>)}</ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
//  04b PROCESS — AIから考えない。経営成果から逆算する。
// ============================================================
export function ProcessContrast() {
  const ref = useInterest('transformation');
  return (
    <section id="process" ref={ref} className="lp-section-pad" style={{ padding: '6.5rem 1.5rem', background: INK_2, scrollMarginTop: 70 }} aria-labelledby="process-h">
      <div className="ch-wrap">
        <motion.div {...reveal} className="ch-head">
          <Kick>{PROCESS.kicker}</Kick>
          <h2 id="process-h" style={{ ...sectionH2, margin: 0 }}><Lines text={PROCESS.h2} /></h2>
          <p style={{ ...sectionLead, margin: '1.2rem 0 0' }}>{PROCESS.lead}</p>
        </motion.div>
        <motion.div {...reveal} className="cs-process">
          <div className="cs-process-row is-generic">
            <p className="cs-process-label" style={{ fontFamily: FONT_JA }}>{PROCESS.genericLabel}</p>
            <Chain steps={PROCESS.generic} accent={false} compact />
          </div>
          <div className="cs-process-row is-core">
            <p className="cs-process-label" style={{ fontFamily: FONT_JA }}>{PROCESS.coreLabel}</p>
            <Chain steps={PROCESS.core} compact />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
//  05 ONE CORE — 四つの事業ではなく、一つの変革。
// ============================================================
export function OneCore({ onAnchor }: { onAnchor: AnchorHandler }) {
  return (
    <section id="onecore" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, scrollMarginTop: 70 }} aria-labelledby="onecore-h">
      <div className="ch-wrap">
        <motion.div {...reveal} className="ch-head">
          <Kick>{ONE_CORE.kicker}</Kick>
          <h2 id="onecore-h" style={{ ...sectionH2, margin: 0 }}><Lines text={ONE_CORE.h2} /></h2>
          <p style={{ ...sectionLead, margin: '1.2rem 0 0' }}>{ONE_CORE.lead}</p>
        </motion.div>
        <ol className="cs-layers" style={{ fontFamily: FONT_JA }}>
          {ONE_CORE.layers.map((l, i) => (
            <motion.li key={l.no} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} className="cs-layer">
              <span className="cs-layer-no" style={{ fontFamily: FONT_EN }}>{l.no}</span>
              <div className="cs-layer-body">
                <p className="cs-layer-en" style={{ fontFamily: FONT_EN }}>{l.en}</p>
                <h3 className="cs-layer-ja">{l.ja}</h3>
                <p className="cs-layer-text">{l.body}</p>
                <a
                  href={l.href}
                  onClick={e => { track('corp_cta_click', `onecore-${l.no}`); onAnchor(e, l.href); }}
                  className="ch-textlink"
                >詳しく →</a>
              </div>
              <StatusBadge status={l.status} />
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ============================================================
//  06 STUDIO — 変革を、物語にする。
// ============================================================
const STUDIO_WORK_IDS = ['work-laguna-beaute-01', 'work-jrc-01', 'work-core-corp-01'] as const;

export function StudioSection() {
  const ref = useInterest('studio');
  const works = STUDIO_WORK_IDS.map(id => FILM_WORKS.find(w => w.id === id)).filter((w): w is NonNullable<typeof w> => !!w);
  return (
    <section id="studio" ref={ref} className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK_2, scrollMarginTop: 70 }} aria-labelledby="studio-h">
      <div className="ch-wrap">
        <div className="cs-studio-head">
          <motion.div {...reveal} className="ch-head">
            <Kick>{STUDIO.kicker}</Kick>
            <h2 id="studio-h" style={{ ...sectionH2, margin: 0 }}>{STUDIO.h2}</h2>
            <p style={{ ...sectionLead, margin: '1.2rem 0 0' }}>{STUDIO.lead}</p>
          </motion.div>
          <motion.ul {...reveal} className="cs-studio-supports" style={{ fontFamily: FONT_JA }}>
            {STUDIO.supports.map(s => <li key={s}>{s}</li>)}
          </motion.ul>
        </div>
        <div className="cs-works">
          {works.map((w, i) => (
            <motion.figure key={w.id} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} className="cs-work">
              {w.poster && <img src={w.poster} alt={`${w.client} の映像`} loading="lazy" decoding="async" width={720} height={900} />}
              <figcaption>
                <span className="cs-work-status" style={{ fontFamily: FONT_EN }}>COMPLETED · {w.category}</span>
                <span className="cs-work-client" style={{ fontFamily: FONT_JA }}>{w.client}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
        <motion.div {...reveal} style={{ marginTop: '2rem' }}>
          <a href={STUDIO.href} onClick={() => track('corp_cta_click', 'studio-section')} style={ctaGhost}>{STUDIO.cta}</a>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
//  07 BRIDGE — 変革は、会社の境界で止まらない。（夜明けの高原・実写）
// ============================================================
export function Bridge() {
  return (
    <section id="bridge" className="cs-bleed cs-bridge" style={{ scrollMarginTop: 70 }} aria-labelledby="bridge-h">
      <img src="/corp/ashitaka-dawn.webp" srcSet={photoSrcSet('/corp/ashitaka-dawn.webp', 1280)} sizes={SIZES_FULL} alt="" aria-hidden loading="lazy" decoding="async" width={1280} height={504} />
      <div className="cs-bleed-shade is-center" aria-hidden />
      <div className="ch-wrap cs-bleed-inner is-center">
        <motion.div {...reveal} style={{ maxWidth: 760, margin: '0 auto' }}>
          <Kick center>{BRIDGE.kicker}</Kick>
          <h2 id="bridge-h" className="cs-bleed-h" style={{ fontFamily: FONT_JA }}><Lines text={BRIDGE.h2} /></h2>
          <p className="cs-bleed-lead" style={{ fontFamily: FONT_JA }}>{BRIDGE.lead}</p>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
//  08 ASHITAKA — 音楽を入口に、町の未来をつくる。（高原でのチェロ・実写ループ）
// ============================================================
function useLazyLoop() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState('');
  useEffect(() => {
    const v = videoRef.current;
    if (!v || typeof IntersectionObserver !== 'function') return;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (reduce || nav.connection?.saveData) return;
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) { setSrc(s => s || '/corp/ashitaka-loop.mp4'); void v.play().catch(() => {}); }
      else v.pause();
    }, { threshold: 0.2 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return { videoRef, src };
}

export function AshitakaHome({ onAnchor }: { onAnchor: AnchorHandler }) {
  const ref = useInterest('ashitaka');
  const { videoRef, src } = useLazyLoop();
  return (
    <section id="ashitaka" ref={ref} className="cs-bleed cs-ashitaka" style={{ scrollMarginTop: 70 }} aria-labelledby="ashitaka-h">
      <img src="/corp/ashitaka-plateau.webp" srcSet={photoSrcSet('/corp/ashitaka-plateau.webp', 1280)} sizes={SIZES_FULL} alt="" aria-hidden loading="lazy" decoding="async" width={1280} height={572} className="cs-ashitaka-poster" />
      <video
        ref={videoRef}
        className="cs-ashitaka-video"
        {...(src ? { src } : {})}
        muted loop playsInline autoPlay={!!src}
        preload="none"
        aria-hidden
        tabIndex={-1}
      />
      <div className="cs-bleed-shade" aria-hidden />
      <div className="ch-wrap cs-bleed-inner">
        <motion.div {...reveal} className="cs-ashitaka-copy">
          <Kick>{ASHITAKA.kicker}</Kick>
          <h2 id="ashitaka-h" className="cs-bleed-h" style={{ fontFamily: FONT_JA }}><Lines text={ASHITAKA.h2} /></h2>
          <p className="cs-principle" style={{ fontFamily: FONT_JA }}>{ASHITAKA.principle}</p>
          <p className="cs-bleed-lead" style={{ fontFamily: FONT_JA }}>{ASHITAKA.lead}</p>
          <Chain steps={ASHITAKA.chain} compact />
          <div className="cs-two-notes">
            <div className="cs-note" style={{ fontFamily: FONT_JA }}>
              <p className="cs-note-label" style={{ fontFamily: FONT_EN }}>{ASHITAKA.oneRegion.en}</p>
              <p className="cs-note-title">{ASHITAKA.oneRegion.ja.replace(/\|/g, '')}</p>
              <p className="cs-note-body">{ASHITAKA.oneRegion.body}</p>
            </div>
            <StatusNote label={ASHITAKA.status.label} body={ASHITAKA.status.body} />
          </div>
          <div className="ch-cta-row" style={{ marginTop: '2rem' }}>
            <a href="/ashitaka" onClick={e => { track('corp_cta_click', 'ashitaka-home'); onAnchor(e, '/ashitaka'); }} style={ctaHero}>{ASHITAKA.ctaPrimary}</a>
            <a href="#invite" onClick={e => { rememberIntent('地域・自治体（Ashitaka）', 'ashitaka'); track('corp_intent', 'ashitaka'); onAnchor(e, '#contact'); }} style={ctaGhost}>{ASHITAKA.ctaSecondary}</a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
//  09 ENERGY — AIの時代は、エネルギーの時代でもある。
// ============================================================
export function EnergyHome({ onAnchor }: { onAnchor: AnchorHandler }) {
  const ref = useInterest('energy');
  return (
    <section id="energy" ref={ref} className="cs-energy lp-section-pad" style={{ scrollMarginTop: 70 }} aria-labelledby="energy-h">
      <img src="/corp/datacenter.webp" srcSet={photoSrcSet('/corp/datacenter.webp')} sizes={SIZES_FULL} alt="" aria-hidden loading="lazy" decoding="async" className="cs-energy-bg" width={2000} height={1125} />
      <div className="ch-wrap" style={{ position: 'relative', zIndex: 2 }}>
        <div className="cs-energy-grid">
          <motion.div {...reveal}>
            <Kick>{ENERGY.kicker}</Kick>
            <h2 id="energy-h" style={{ ...sectionH2, margin: 0 }}><Lines text={ENERGY.h2} /></h2>
            <p style={{ ...sectionLead, margin: '1.2rem 0 0' }}>{ENERGY.lead}</p>
            <p style={{ ...sectionLead, margin: '1rem 0 0' }}>{ENERGY.region}</p>
          </motion.div>
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
        </div>
        <motion.div {...reveal} className="cs-energy-foot">
          <StatusNote label={ENERGY.honest.label} body={ENERGY.honest.body} />
          <div className="ch-cta-row">
            <a href="/energy" onClick={e => { track('corp_cta_click', 'energy-home'); onAnchor(e, '/energy'); }} style={ctaHero}>{ENERGY.ctaPrimary}</a>
            <a href="#invite" onClick={e => { rememberIntent('エネルギー', 'energy'); track('corp_intent', 'energy'); onAnchor(e, '#contact'); }} style={ctaGhost}>{ENERGY.ctaSecondary}</a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
//  10 THE CONNECTION — AIは知性を変える。文化は人を動かす。エネルギーは社会を支える。
// ============================================================
export function Connection() {
  return (
    <section id="connection" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK_2, scrollMarginTop: 70 }} aria-labelledby="connection-h">
      <div className="ch-wrap cs-connection">
        <motion.div {...reveal}>
          <Kick>{CONNECTION.kicker}</Kick>
          <ul className="cs-conn-lines" style={{ fontFamily: FONT_JA }}>
            {CONNECTION.lines.map(l => <li key={l}>{l}</li>)}
          </ul>
          <h2 id="connection-h" className="cs-conn-answer" style={{ fontFamily: FONT_JA }}>{CONNECTION.answer}</h2>
          <p style={{ ...sectionLead, margin: '1rem 0 0' }}>{CONNECTION.lead}</p>
        </motion.div>
        <motion.ol {...reveal} className="cs-strata" style={{ fontFamily: FONT_JA }} aria-label="変革の層">
          {CONNECTION.layers.map((l, i) => (
            <li key={l.en} className="cs-stratum" style={{ opacity: 1 - i * 0.12 }}>
              <span className="cs-stratum-en" style={{ fontFamily: FONT_EN }}>{l.en}</span>
              <span className="cs-stratum-ja">{l.ja}</span>
            </li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}

// ============================================================
//  11 CORE 2035 — 社会を支える仕組みの、より深い層へ。
// ============================================================
export function Core2035() {
  const ref = useInterest('vision');
  return (
    <section id="vision" ref={ref} className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, borderTop: `1px solid ${LINE}`, scrollMarginTop: 70 }} aria-labelledby="vision-h">
      <div className="ch-wrap">
        <motion.div {...reveal} className="ch-head">
          <Kick>{VISION.kicker}</Kick>
          <h2 id="vision-h" style={{ ...sectionH2, margin: 0 }}><Lines text={VISION.h2} /></h2>
          <p style={{ ...sectionLead, margin: '1.2rem 0 0' }}>{VISION.lead}</p>
        </motion.div>
        <ol className="cs-timeline" style={{ fontFamily: FONT_JA }}>
          {VISION.timeline.map((t, i) => (
            <motion.li key={t.when} {...reveal} transition={{ ...reveal.transition, delay: i * 0.1 }} className="cs-tl">
              <span className="cs-tl-dot" aria-hidden />
              <span className="cs-tl-when" style={{ fontFamily: FONT_EN }}>{t.when}</span>
              <p className="cs-tl-en" style={{ fontFamily: FONT_EN }}>{t.en}</p>
              <h3 className="cs-tl-ja">{t.ja}</h3>
              <p className="cs-tl-body">{t.body}</p>
            </motion.li>
          ))}
        </ol>
        <motion.p {...reveal} className="cs-stance" style={{ fontFamily: FONT_JA }}>{VISION.stance}</motion.p>
      </div>
    </section>
  );
}

// ============================================================
//  14 INVITATION — 未来の仕組みを、一緒につくる。
// ============================================================
export function Invitation({ onAnchor }: { onAnchor: AnchorHandler }) {
  const pick = (e: ReactMouseEvent<HTMLAnchorElement>, id: string, interest: string) => {
    rememberIntent(interest, id);
    rememberSource(`invite-${id}`);
    track('corp_intent', id);
    track('corp_cta_click', `invite-${id}`);
    onAnchor(e, '#contact');
  };
  return (
    <section id="invite" className="cs-invite" style={{ scrollMarginTop: 70 }} aria-labelledby="invite-h">
      <img src="/corp/people-team.webp" srcSet={photoSrcSet('/corp/people-team.webp')} sizes={SIZES_FULL} alt="" aria-hidden loading="lazy" decoding="async" />
      <div className="ch-band-shade" aria-hidden />
      <div className="ch-wrap" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
        <motion.div {...reveal} style={{ maxWidth: 760, margin: '0 auto' }}>
          <Kick center>{INVITE.kicker}</Kick>
          <h2 id="invite-h" style={{ ...sectionH2, fontSize: 'clamp(2rem, 4.6vw, 3.4rem)', margin: 0, color: '#fff' }}><Lines text={INVITE.h2} /></h2>
          <p style={{ ...sectionLead, margin: '1.2rem auto 0', color: 'rgba(240,245,252,0.9)' }}>{INVITE.lead}</p>
        </motion.div>
        <motion.div {...reveal} className="cs-intents">
          {INVITE.intents.map(it => (
            <a key={it.id} href="#contact" onClick={e => pick(e, it.id, it.interest)} className="cs-intent" style={{ fontFamily: FONT_JA }}>
              <span className="cs-intent-label">{it.label}</span>
              <span className="cs-intent-sub" style={{ fontFamily: FONT_EN }}>{it.sub}</span>
            </a>
          ))}
        </motion.div>
        <motion.ul {...reveal} className="cs-quiet" style={{ fontFamily: FONT_JA }}>
          {INVITE.quiet.map(q => (
            <li key={q.id}><a href="#contact" onClick={e => pick(e, q.id, q.interest)} className="ch-textlink">{q.label} →</a></li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

/** 共通の小さな見出し（本編ページ用）。 */
export function PageHead({ kicker, h2, lead, id, center }: { kicker: string; h2: string; lead?: string; id: string; center?: boolean }) {
  return (
    <motion.div {...reveal} className="ch-head" style={center ? { margin: '0 auto', textAlign: 'center' } : undefined}>
      <Kick center={center}>{kicker}</Kick>
      <h2 id={id} style={{ ...sectionH2, margin: 0 }}><Lines text={h2} /></h2>
      {lead && <p style={{ ...sectionLead, margin: center ? '1.2rem auto 0' : '1.2rem 0 0' }}>{lead}</p>}
    </motion.div>
  );
}

export type { AnchorHandler };
