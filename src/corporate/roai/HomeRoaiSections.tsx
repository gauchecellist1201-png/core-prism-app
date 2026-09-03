// ============================================================
// HomeRoaiSections — /corp ホームに置く「Return on AI」の章（2026-09-03 MASTER PROMPT §46〜§49）
//   RoaiBand         AI Investment is not the goal. Return on AI is.
//   ExecutiveQuestion もし今日、あなたの会社をゼロから作るなら
//   Differentiation  We don't start with AI. We start with business outcomes.
//   RoaiModelSection 5 つの Return（CORE ROAI MODEL）
//   ScoreTeaser      CORE ROAI SCORE への入口
// 言葉の正本は roai/model.ts。ここは並べ方だけ。
// ============================================================
import type { MouseEvent as ReactMouseEvent } from 'react';
import { motion } from 'framer-motion';
import { FONT_JA, FONT_EN, ACCENT, ACCENT_LIGHT, PAPER, TEXT_BODY, TEXT_MUTED, INK, INK_2, ctaHero, ctaGhost, sectionH2, sectionLead, reveal } from '../corpTheme';
import { RETURNS, PROCESS_GENERIC, PROCESS_CORE } from './model';
import { track, rememberSource } from './track';

type AnchorHandler = (e: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;

export function Kick({ children, center }: { children: React.ReactNode; center?: boolean }) {
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

/** 診断への CTA。押した場所を覚え、計測する。 */
export function ScoreCta({ onAnchor, where, label = 'ROAIを無料診断する', ghost }: { onAnchor: AnchorHandler; where: string; label?: string; ghost?: boolean }) {
  return (
    <a
      href="/roai-score"
      onClick={e => { rememberSource(where); track('corp_cta_click', where); onAnchor(e, '/roai-score'); }}
      style={ghost ? ctaGhost : ctaHero}
    >
      {label}
    </a>
  );
}

// ── AI Investment is not the goal. Return on AI is. ──
export function RoaiBand({ onAnchor }: { onAnchor: AnchorHandler }) {
  const lines = ['どれだけ売上を生んだか。', 'どれだけ時間を生んだか。', 'どれだけコストを減らしたか。', 'どれだけリスクを減らしたか。', 'どれだけ新しい価値を生んだか。'];
  return (
    <section id="roai-band" className="ro-band lp-section-pad" aria-labelledby="roai-band-h">
      <div className="ch-wrap">
        <motion.p {...reveal} className="ro-band-en" style={{ fontFamily: FONT_EN }}>
          AI Investment<br />is not the goal.<br /><span style={{ color: ACCENT_LIGHT }}>Return on AI is.</span>
        </motion.p>
        <div className="ro-band-grid">
          <motion.div {...reveal}>
            <h2 id="roai-band-h" style={{ ...sectionH2, marginBottom: '0.8rem' }}>AIにいくら投資したかではない。</h2>
            <ul className="ro-band-lines" style={{ fontFamily: FONT_JA }}>
              {lines.map(l => <li key={l}>{l}</li>)}
            </ul>
            <p style={{ ...sectionLead, margin: '1.4rem 0 0', maxWidth: 520 }}>
              COREは、AIを入れるところまでではなく、AIが経営成果を返すところまでを設計します。
              それを測る経営指標が Return on AI。COREはこの指標を、診断・設計・開発・運用まで一貫して使います。
            </p>
          </motion.div>
          <motion.div {...reveal} className="ro-band-cta">
            <ScoreCta onAnchor={onAnchor} where="home-roai-band" label="自社のROAIを診断する" />
            <a href="/return-on-ai" onClick={e => onAnchor(e, '/return-on-ai')} className="ch-textlink">Return on AI とは →</a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ── もし今日、あなたの会社をゼロから作るなら ──
export function ExecutiveQuestion({ onAnchor }: { onAnchor: AnchorHandler }) {
  const same = ['同じ人数で。', '同じ組織で。', '同じ業務で。', '同じシステムで。', '同じ意思決定で。'];
  return (
    <section id="question" className="ro-question lp-section-pad" aria-labelledby="question-h">
      <img src="/corp/texture.webp" alt="" aria-hidden loading="lazy" decoding="async" className="ro-question-bg" />
      <div className="ch-wrap ro-question-inner">
        <motion.div {...reveal} className="ro-question-head">
          <Kick>A question for the CEO</Kick>
          <h2 id="question-h" className="ro-question-h" style={{ fontFamily: FONT_JA, color: '#fff' }}>
            もし今日、<br />あなたの会社を<br />ゼロから作るなら。
          </h2>
        </motion.div>
        <motion.div {...reveal} className="ro-question-body">
          <p style={{ fontFamily: FONT_JA, fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', color: 'rgba(236,242,250,0.9)', lineHeight: 2, margin: '0 0 1.2rem', fontWeight: 500 }}>
            AIが存在する今、
          </p>
          <ul className="ro-same" style={{ fontFamily: FONT_JA }}>
            {same.map(s => <li key={s}>{s}</li>)}
          </ul>
          <p style={{ fontFamily: FONT_JA, fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', color: 'rgba(236,242,250,0.9)', lineHeight: 2, margin: '1.2rem 0 1.8rem', fontWeight: 500 }}>
            同じ会社をつくるでしょうか。<br />
            <strong style={{ color: '#fff', fontWeight: 800 }}>答えがNOなら、会社を再設計する余地があります。</strong>
          </p>
          <ScoreCta onAnchor={onAnchor} where="home-question" label="AI Transformationの余地を診断する" ghost />
        </motion.div>
      </div>
    </section>
  );
}

// ── We don't start with AI. We start with business outcomes. ──
export function Differentiation() {
  return (
    <section id="difference" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK_2, scrollMarginTop: 70 }} aria-labelledby="difference-h">
      <div className="ch-wrap">
        <motion.div {...reveal} className="ch-head">
          <Kick>How we work</Kick>
          <p style={{ fontFamily: FONT_EN, fontSize: 'clamp(1.1rem, 2vw, 1.5rem)', fontWeight: 700, color: ACCENT_LIGHT, margin: '0 0 0.6rem', letterSpacing: '-0.01em' }}>
            We don't start with AI.<br />We start with business outcomes.
          </p>
          <h2 id="difference-h" style={{ ...sectionH2 }}>AIから考えない。<br />経営成果から逆算する。</h2>
          <p style={{ ...sectionLead, margin: 0 }}>
            一般的なAI会社は「何を作りますか」から始めます。COREは「経営として何を達成しますか」から入り、
            ベースラインとKPIを決め、ROAIを試算してから、業務を再設計し、作り、測ります。
          </p>
        </motion.div>
        <div className="ro-diff">
          <motion.div {...reveal} className="ro-flow is-generic">
            <p className="ro-flow-label" style={{ fontFamily: FONT_EN }}>GENERIC AI VENDOR</p>
            <ol className="ro-flow-steps">
              {PROCESS_GENERIC.map(s => <li key={s} style={{ fontFamily: FONT_JA }}>{s}</li>)}
            </ol>
            <p style={{ fontFamily: FONT_JA, fontSize: '0.82rem', color: TEXT_MUTED, margin: '1rem 0 0', lineHeight: 1.8 }}>作って、納めて、終わる。使われたか、返ったかは測られない。</p>
          </motion.div>
          <motion.div {...reveal} className="ro-flow is-core">
            <p className="ro-flow-label" style={{ fontFamily: FONT_EN, color: ACCENT_LIGHT }}>CORE</p>
            <ol className="ro-flow-steps">
              {PROCESS_CORE.map(s => <li key={s} style={{ fontFamily: FONT_JA }}>{s}</li>)}
            </ol>
            <p style={{ fontFamily: FONT_JA, fontSize: '0.82rem', color: TEXT_BODY, margin: '1rem 0 0', lineHeight: 1.8 }}>Build, Measure and Evolve. 納品はゴールではなく、計測の始まり。</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ── CORE ROAI MODEL: 5 つの Return ──
export function RoaiModelSection({ onAnchor, compact }: { onAnchor: AnchorHandler; compact?: boolean }) {
  return (
    <section id="roai-model" className="lp-section-pad" style={{ padding: '7rem 1.5rem', background: INK, scrollMarginTop: 70 }} aria-labelledby="roai-model-h">
      <div className="ch-wrap">
        <motion.div {...reveal} className="ch-head">
          <Kick>CORE ROAI MODEL</Kick>
          <h2 id="roai-model-h" style={sectionH2}>AIが返すものを、<br />5つのReturnで測る。</h2>
          <p style={{ ...sectionLead, margin: 0 }}>
            すべてのAI案件を、Before → 変革 → After → 計測 → ROAI まで追いかけるための分類です。
            売上とコスト削減だけでなく、速度・損失回避・新しい価値も経済価値として数えます。
          </p>
        </motion.div>
        <div className="ro-returns">
          {RETURNS.map(r => (
            <motion.article key={r.key} {...reveal} className="ro-return">
              <p style={{ fontFamily: FONT_EN, fontSize: '0.72rem', letterSpacing: '0.24em', color: ACCENT, fontWeight: 700, margin: 0 }}>{r.no}</p>
              <h3 style={{ fontFamily: FONT_EN, fontSize: 'clamp(1.4rem, 2.2vw, 1.9rem)', fontWeight: 800, color: PAPER, margin: '0.3rem 0 0.2rem', letterSpacing: '-0.01em' }}>{r.en}</h3>
              <p style={{ fontFamily: FONT_JA, fontSize: '0.98rem', fontWeight: 800, color: '#fff', margin: '0 0 0.7rem' }}>{r.ja}</p>
              <p style={{ fontFamily: FONT_JA, fontSize: '0.86rem', color: TEXT_BODY, lineHeight: 1.85, margin: 0 }}>{r.lead}</p>
              {!compact && (
                <ul className="ro-return-metrics" style={{ fontFamily: FONT_JA }}>
                  {r.metrics.slice(0, 4).map(m => <li key={m}>{m}</li>)}
                </ul>
              )}
            </motion.article>
          ))}
        </div>
        {!compact && (
          <div style={{ textAlign: 'center', marginTop: '2.6rem' }}>
            <a href="/return-on-ai" onClick={e => onAnchor(e, '/return-on-ai')} style={ctaGhost}>Return on AI の考え方をすべて読む</a>
          </div>
        )}
      </div>
    </section>
  );
}

// ── CORE ROAI SCORE への入口 ──
export function ScoreTeaser({ onAnchor }: { onAnchor: AnchorHandler }) {
  const outputs = ['AI投資の優先領域', '削減できる時間', '経済価値の概算', '売上改善余地', 'コスト削減余地', 'リスク削減余地', 'AI Readiness', '投資余力の目安'];
  return (
    <section id="score-teaser" className="ro-teaser lp-section-pad" aria-labelledby="score-h">
      <div className="ch-wrap ch-two">
        <motion.div {...reveal}>
          <Kick>CORE ROAI SCORE</Kick>
          <h2 id="score-h" style={{ ...sectionH2, margin: 0 }}>あなたの会社の、<br />次にAI投資すべき場所はどこか。</h2>
          <p style={{ ...sectionLead, margin: '1.2rem 0 1.6rem', maxWidth: 520 }}>
            約3分・選択式の診断で、どこへAI投資すると最も大きな経営Returnが生まれる可能性があるかを可視化します。
            数字はすべて入力と公開された仮定から決定論的に計算し、算定根拠を開いて確かめられます。
          </p>
          <ul className="ro-outputs" style={{ fontFamily: FONT_JA }}>
            {outputs.map(o => <li key={o}>{o}</li>)}
          </ul>
          <div className="ch-cta-row" style={{ marginTop: '1.8rem' }}>
            <ScoreCta onAnchor={onAnchor} where="home-score-teaser" />
            <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={ctaGhost}>AI Transformationを相談する</a>
          </div>
        </motion.div>
        <motion.div {...reveal} className="ro-teaser-visual" aria-hidden>
          <ScoreGauge value={72} label="SAMPLE" />
          <div className="ro-teaser-map">
            {[['GROW', 82], ['SAVE', 91], ['ACCELERATE', 76], ['PROTECT', 64], ['CREATE', 88]].map(([k, v]) => (
              <div key={k} className="ro-teaser-row">
                <span style={{ fontFamily: FONT_EN }}>{k}</span>
                <span className="ro-teaser-bar"><span style={{ width: `${v}%` }} /></span>
                <span style={{ fontFamily: FONT_EN }}>{v}</span>
              </div>
            ))}
            <p style={{ fontFamily: FONT_JA, fontSize: '0.7rem', color: TEXT_MUTED, margin: '0.8rem 0 0' }}>表示例。実際の数値は回答から計算されます。</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/** 0〜100 の円弧ゲージ。診断結果とティーザーで共用。 */
export function ScoreGauge({ value, label, size = 200 }: { value: number; label?: string; size?: number }) {
  const r = 84, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const dash = (c * 0.75) * (v / 100);
  return (
    <div className="rs-gauge" style={{ width: size, height: size }} role="img" aria-label={`CORE ROAI SCORE ${v} / 100`}>
      <svg viewBox="0 0 200 200" width={size} height={size}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="10"
          strokeDasharray={`${c * 0.75} ${c}`} strokeLinecap="round" transform="rotate(135 100 100)" />
        <circle cx="100" cy="100" r={r} fill="none" stroke={ACCENT} strokeWidth="10"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" transform="rotate(135 100 100)"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div className="rs-gauge-txt">
        <span className="rs-gauge-num" style={{ fontFamily: FONT_EN }}>{v}</span>
        <span className="rs-gauge-den" style={{ fontFamily: FONT_EN }}>/ 100</span>
        {label && <span className="rs-gauge-label" style={{ fontFamily: FONT_EN }}>{label}</span>}
      </div>
    </div>
  );
}
