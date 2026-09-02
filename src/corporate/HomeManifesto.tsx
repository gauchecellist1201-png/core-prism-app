// ============================================================
// HomeManifesto — 理念の章（2026-09-02 オーナー指示「理念をブーストする」）
//
// 「いつの時代も、変わらない核を。」は社名の由来であり SSOT（companyInfo.philosophy）。
// この章はその一行に「では、核とは何か」の答えを足す。答えは「人」。
//
//   核とは、人。
//   AIは、人が人にしかできないことに時間を使うための道具。
//   儲けるために存在するのではなく、人が輝くために儲ける。
//
// 写真は public/corp/people-*.webp（2026-09-02 生成）。
// 実在の社員・顧客として紹介しない（名前・肩書を付けない）。「私たちが向き合う人々」の情景として使う。
// ============================================================
import { motion } from 'framer-motion';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { FONT_JA, FONT_EN, ACCENT, ACCENT_LIGHT, PAPER, TEXT_BODY, TEXT_MUTED, LINE, INK, INK_2, ctaHero, sectionH2, sectionLead, reveal } from './corpTheme';
import { CREED, PEOPLE } from './creedData';

type AnchorHandler = (e: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;

// 言葉と写真の正本は creedData.ts（react-refresh のため定数はこのファイルに置かない）


/** 小さな英字見出し。 */
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

// ============================================================
//  MANIFESTO — 「核とは、人。」全面写真＋大きな言葉
// ============================================================
export function Manifesto({ onAnchor }: { onAnchor?: AnchorHandler }) {
  return (
    <section id="philosophy" className="ch-manifesto" style={{ scrollMarginTop: 70 }}>
      <img src={PEOPLE.hands} alt="" aria-hidden loading="lazy" decoding="async" width={2400} height={1350} />
      <div className="ch-manifesto-shade" aria-hidden />
      <div className="ch-wrap ch-manifesto-inner">
        <motion.div {...reveal} style={{ maxWidth: 760 }}>
          <Kick>Our Creed — {CREED.tagline}</Kick>
          <h2 className="ch-manifesto-h" style={{ fontFamily: FONT_JA, color: '#fff' }}>
            {CREED.answer}
          </h2>
          <p style={{ fontFamily: FONT_EN, fontSize: 'clamp(0.85rem, 1.3vw, 1rem)', letterSpacing: '0.14em', color: ACCENT_LIGHT, fontWeight: 600, margin: '0 0 1.8rem', textTransform: 'uppercase' }}>
            {CREED.answerEn}
          </p>
          <p style={{ fontFamily: FONT_JA, fontSize: 'clamp(1.05rem, 1.7vw, 1.3rem)', lineHeight: 2, color: 'rgba(240,245,252,0.92)', fontWeight: 600, margin: '0 0 2.2rem', maxWidth: 640 }}>
            {CREED.lead}
          </p>
          <ul className="ch-creed-lines" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {CREED.lines.map((l, i) => (
              <motion.li key={l} {...reveal} transition={{ ...reveal.transition, delay: 0.15 + i * 0.12 }}
                style={{ fontFamily: FONT_JA, fontSize: 'clamp(0.98rem, 1.45vw, 1.12rem)', lineHeight: 1.9, color: PAPER, fontWeight: 700 }}>
                <span aria-hidden style={{ color: ACCENT, marginRight: 12 }}>—</span>{l}
              </motion.li>
            ))}
          </ul>
          {onAnchor && (
            <p style={{ marginTop: '2.4rem' }}>
              <a href="#values" onClick={e => onAnchor(e, '#values')} className="ch-textlink">私たちの3つの約束を読む →</a>
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
//  VALUES — 3つの約束。写真3枚と並べる。
// ============================================================
export function Values() {
  const photos = [PEOPLE.craft, PEOPLE.workshop, PEOPLE.home];
  const alts = [
    '工房で、年配の職人と若い技術者がスマートフォンの画面を見て笑っている',
    '木工の作業場で、店主と若いスタッフがタブレットを囲んで笑っている',
    '早く帰宅した父親に、娘が駆け寄っている',
  ];
  return (
    <section id="values" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK_2, scrollMarginTop: 70 }}>
      <div className="ch-wrap">
        <div className="ch-head">
          <Kick>Our Promises</Kick>
          <h2 style={{ ...sectionH2, margin: 0 }}>
            私たちが、
            <br />
            変わらずに守る三つのこと。
          </h2>
          <p style={{ ...sectionLead, margin: '1.2rem 0 0', maxWidth: 600 }}>
            {CREED.mission}
          </p>
        </div>
        <div className="ch-grid-3" style={{ marginTop: '3.5rem' }}>
          {CREED.values.map((v, i) => (
            <motion.article key={v.no} {...reveal} transition={{ ...reveal.transition, delay: i * 0.1 }} className="ch-card">
              <div className="ch-card-img">
                <img src={photos[i]} alt={alts[i]} loading="lazy" decoding="async" width={1600} height={1200} />
              </div>
              <p style={{ fontFamily: FONT_EN, fontSize: '0.7rem', letterSpacing: '0.24em', color: ACCENT, fontWeight: 700, margin: '1.4rem 0 0.5rem' }}>
                {v.no} — {v.en}
              </p>
              <h3 style={{ fontFamily: FONT_JA, fontSize: 'clamp(1.2rem, 1.8vw, 1.45rem)', fontWeight: 800, color: PAPER, lineHeight: 1.45, margin: '0 0 0.7rem', letterSpacing: '-0.005em' }}>{v.ja}</h3>
              <p style={{ fontFamily: FONT_JA, fontSize: '0.92rem', color: TEXT_BODY, lineHeight: 1.95, margin: 0 }}>{v.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
//  PEOPLE MOSAIC — 私たちが向き合う人々。笑顔の写真の帯（写真だけで語る）。
// ============================================================
export function PeopleMosaic() {
  const tiles: { img: string; alt: string; cap: string; span?: string }[] = [
    { img: PEOPLE.team, alt: '会議室で笑い合うチーム', cap: '決める人と、作る人が同じ部屋にいる。', span: 'wide' },
    { img: PEOPLE.clinic, alt: 'クリニックの受付で微笑み合う', cap: '受付の一日が、少し軽くなる。' },
    { img: PEOPLE.factory, alt: '工場で笑い合う作業者と技術者', cap: '現場の声が、そのまま仕組みになる。' },
    { img: PEOPLE.arcade, alt: '商店街で談笑する店主たち', cap: '神戸の商いを、次の時代へ。', span: 'wide' },
  ];
  return (
    <section aria-label="私たちが向き合う人々" style={{ background: INK, padding: '0 0 6rem' }}>
      <div className="ch-wrap" style={{ padding: '0 1.5rem' }}>
        <div className="ch-mosaic">
          {tiles.map((t, i) => (
            <motion.figure key={t.img} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} className={'ch-tile' + (t.span ? ' is-wide' : '')}>
              <img src={t.img} alt={t.alt} loading="lazy" decoding="async" />
              <figcaption style={{ fontFamily: FONT_JA }}>{t.cap}</figcaption>
            </motion.figure>
          ))}
        </div>
        <p style={{ fontFamily: FONT_JA, fontSize: '0.78rem', color: TEXT_MUTED, margin: '1rem 0 0', textAlign: 'right' }}>
          写真はイメージです。
        </p>
      </div>
    </section>
  );
}

// ============================================================
//  CREED BAND — 会社タブ用のコンパクト版（思想の章の頭に置く）
// ============================================================
export function CreedBand({ onAnchor }: { onAnchor?: AnchorHandler }) {
  return (
    <section id="mission" className="ch-band" style={{ padding: '8rem 1.5rem', scrollMarginTop: 70 }}>
      <img src={PEOPLE.team} alt="" aria-hidden loading="lazy" decoding="async" />
      <div className="ch-band-shade" aria-hidden />
      <div style={{ position: 'relative', maxWidth: 860, margin: '0 auto' }}>
        <Kick center>Mission</Kick>
        <h2 style={{ ...sectionH2, fontSize: 'clamp(1.7rem, 3.6vw, 2.8rem)', margin: 0, color: '#fff', lineHeight: 1.5 }}>
          {CREED.mission}
        </h2>
        <p style={{ fontFamily: FONT_JA, fontSize: 'clamp(1.4rem, 3vw, 2.2rem)', fontWeight: 900, color: ACCENT_LIGHT, margin: '1.6rem 0 0', letterSpacing: '0.02em' }}>
          {CREED.answer}
        </p>
        <p style={{ ...sectionLead, margin: '1.4rem auto 0', color: 'rgba(236,242,250,0.85)', maxWidth: 640 }}>
          {CREED.lead}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.8rem', flexWrap: 'wrap', marginTop: '2.2rem' }}>
          {CREED.values.map(v => (
            <span key={v.no} style={{ fontFamily: FONT_JA, fontSize: '0.84rem', fontWeight: 700, color: PAPER, border: `1px solid ${LINE}`, background: 'rgba(7,10,16,0.55)', borderRadius: 999, padding: '8px 16px', backdropFilter: 'blur(8px)' }}>
              {v.ja}
            </span>
          ))}
        </div>
        {onAnchor && (
          <p style={{ marginTop: '2.4rem' }}>
            <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={ctaHero}>この理念に、一緒に取り組む</a>
          </p>
        )}
      </div>
    </section>
  );
}
