// ============================================================
// ReturnOnAiPage — /return-on-ai（MASTER PROMPT §50）
//   What is Return on AI → Why AI Projects Fail → Investment vs Return → CORE ROAI MODEL
//   → ROAI Calculation → Loss Avoidance → AI Investment Capacity → CORE TRANSFORMATION LOOP → CORE ROAI SCORE → CTA
// Return on AI は一般的な経営概念として説明し、CORE の独自性は MODEL / SCORE / LOOP に置く。
// 外部の統計・企業事例は載せない（確認できない数字は出さない）。
// ============================================================
import type { MouseEvent as ReactMouseEvent } from 'react';
import { motion } from 'framer-motion';
import { FONT_JA, FONT_EN, ACCENT, ACCENT_LIGHT, PAPER, TEXT_BODY, TEXT_MUTED, LINE, INK, INK_2, ctaGhost, sectionH2, sectionLead, reveal } from '../corpTheme';
import { TRANSFORMATION_LOOP } from './model';
import { ASSUMPTIONS } from './engine';
import { Kick, ScoreCta, RoaiModelSection } from './HomeRoaiSections';

type AnchorHandler = (e: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;

const FAIL_REASONS: { t: string; d: string }[] = [
  { t: 'ツール導入で終わる', d: 'ChatGPTやCopilotを配って「導入した」ことにする。業務も組織も変わらないので、成果が数字に出ない。' },
  { t: 'ベースラインが無い', d: '導入前の時間・コスト・売上を測っていないので、後から「返った」と言えない。' },
  { t: '技術から始める', d: '「AIで何ができるか」から始めると、使われない仕組みができる。「どこで価値が失われているか」から始める。' },
  { t: 'データと手順が整っていない', d: 'Excelと紙と担当者の頭の中に散らばったまま作ると、AIは動かない。先に整えるほうが速い。' },
  { t: '納品がゴールになる', d: '作って納めて終わり。運用・計測・改善が無いので、初期の効果が薄れていく。' },
];

const VALUE_ITEMS: { en: string; ja: string }[] = [
  { en: 'Revenue Gain', ja: '売上の増加' }, { en: 'Cost Savings', ja: 'コスト削減' }, { en: 'Productivity Value', ja: '時間の回復（人件費換算）' },
  { en: 'Loss Avoidance', ja: '損失の回避' }, { en: 'Risk Reduction', ja: 'リスクの低減' }, { en: 'Innovation Value', ja: '新しい価値' },
];
const INVEST_ITEMS: { en: string; ja: string }[] = [
  { en: 'Development', ja: '開発' }, { en: 'Implementation', ja: '導入' }, { en: 'License / API', ja: 'ライセンス・API 利用料' },
  { en: 'Infrastructure', ja: 'インフラ' }, { en: 'Training', ja: '教育' }, { en: 'Operation / Maintenance', ja: '運用・保守' },
];

function Block({ id, kick, h, lead, children, bg = INK }: { id: string; kick: string; h: React.ReactNode; lead?: string; children?: React.ReactNode; bg?: string }) {
  return (
    <section id={id} className="lp-section-pad" style={{ padding: '6.5rem 1.5rem', background: bg, scrollMarginTop: 70 }} aria-labelledby={`${id}-h`}>
      <div className="ch-wrap">
        <motion.div {...reveal} className="ch-head">
          <Kick>{kick}</Kick>
          <h2 id={`${id}-h`} style={sectionH2}>{h}</h2>
          {lead && <p style={{ ...sectionLead, margin: 0 }}>{lead}</p>}
        </motion.div>
        {children}
      </div>
    </section>
  );
}

export default function ReturnOnAiPage({ onAnchor }: { onAnchor: AnchorHandler }) {
  const A = ASSUMPTIONS;
  return (
    <div>
      {/* HERO */}
      <section id="roai" className="ro-hero lp-safe" aria-labelledby="roai-h">
        <div className="ch-wrap ro-hero-inner">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
            <Kick>Return on AI</Kick>
            <h1 id="roai-h" className="ch-h1" style={{ fontFamily: FONT_JA, color: '#fff', maxWidth: 980, fontSize: 'clamp(2rem, 4.6vw, 4rem)' }}>
              問うべきは、<br className="ch-br-m" />「AIを導入したか」<br className="ch-br-m" />ではない。<br /><span style={{ color: ACCENT_LIGHT }}>「AIが何を<br className="ch-br-m" />生み出したか」だ。</span>
            </h1>
            <p style={{ fontFamily: FONT_JA, fontSize: 'clamp(0.98rem, 1.5vw, 1.12rem)', lineHeight: 1.95, color: 'rgba(236,242,250,0.85)', maxWidth: 640, margin: '0 0 2rem', fontWeight: 500 }}>
              1億円を投資した。100個のAIエージェントを作った。全社員に生成AIを配った。
              それ自体は成功ではありません。売上・利益・時間・速度・リスク・新しい価値として、AIが何を返したか。
              それを経営指標として扱うのが Return on AI です。
            </p>
            <div className="ch-cta-row">
              <ScoreCta onAnchor={onAnchor} where="roai-hero" label="Measure Your Return on AI" />
              <a href="#roai-calc" onClick={e => onAnchor(e, '#roai-calc')} style={ctaGhost}>計算の考え方を見る</a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* WHY AI PROJECTS FAIL */}
      <Block id="roai-fail" kick="Why AI projects fail" h={<>AI投資が、<br />成果にならない理由。</>} bg={INK_2}
        lead="失敗の多くは技術ではなく、始め方と終わり方にあります。COREはこの5つを最初に潰します。">
        <div className="ro-fail">
          {FAIL_REASONS.map((f, i) => (
            <motion.div key={f.t} {...reveal} className="ro-fail-item">
              <span style={{ fontFamily: FONT_EN, fontSize: '0.72rem', letterSpacing: '0.2em', color: ACCENT, fontWeight: 700 }}>0{i + 1}</span>
              <div>
                <h3 style={{ fontFamily: FONT_JA, fontSize: '1.02rem', fontWeight: 800, color: PAPER, margin: '0 0 0.3rem' }}>{f.t}</h3>
                <p style={{ fontFamily: FONT_JA, fontSize: '0.86rem', color: TEXT_BODY, lineHeight: 1.85, margin: 0 }}>{f.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Block>

      {/* INVESTMENT vs RETURN */}
      <Block id="roai-calc" kick="ROAI calculation" h={<>ROAI ＝ AIが生んだ経済価値 ÷ AI投資総額</>}
        lead="会計基準の公式指標ではなく、AI投資を経営判断できる形にするための戦略KPIとして扱います。分子と分母に何を入れるかを先に決めるのが、計測の第一歩です。">
        <div className="ro-formula">
          <motion.div {...reveal} className="ro-formula-col">
            <p className="ro-formula-label" style={{ fontFamily: FONT_EN, color: ACCENT_LIGHT }}>ECONOMIC VALUE CREATED BY AI</p>
            <ul style={{ fontFamily: FONT_JA }}>
              {VALUE_ITEMS.map(v => <li key={v.en}><strong>{v.ja}</strong><span style={{ fontFamily: FONT_EN }}>{v.en}</span></li>)}
            </ul>
          </motion.div>
          <div className="ro-formula-div" aria-hidden><span style={{ fontFamily: FONT_EN }}>÷</span></div>
          <motion.div {...reveal} className="ro-formula-col">
            <p className="ro-formula-label" style={{ fontFamily: FONT_EN, color: TEXT_MUTED }}>TOTAL AI INVESTMENT</p>
            <ul style={{ fontFamily: FONT_JA }}>
              {INVEST_ITEMS.map(v => <li key={v.en}><strong>{v.ja}</strong><span style={{ fontFamily: FONT_EN }}>{v.en}</span></li>)}
            </ul>
          </motion.div>
        </div>
      </Block>

      {/* CORE ROAI MODEL */}
      <RoaiModelSection onAnchor={onAnchor} compact />

      {/* LOSS AVOIDANCE */}
      <Block id="roai-loss" kick="Loss avoidance" h={<>売上に出ない価値も、<br />経済価値として数える。</>} bg={INK_2}
        lead="サイバー攻撃を防ぐ。障害を防ぐ。情報漏洩を防ぐ。契約リスクを見つける。人的ミスを防ぐ。売上として表示されなくても、大きな経済価値があります。">
        <motion.div {...reveal} className="ro-expected">
          <p style={{ fontFamily: FONT_EN, fontSize: 'clamp(1.2rem, 2.4vw, 1.8rem)', fontWeight: 700, color: PAPER, margin: '0 0 0.6rem', letterSpacing: '-0.01em' }}>
            Expected Loss ＝ Probability of Event × Estimated Impact
          </p>
          <p style={{ fontFamily: FONT_JA, fontSize: '0.92rem', color: TEXT_BODY, lineHeight: 1.9, margin: 0, maxWidth: 720 }}>
            発生確率 × 想定損失額 で「期待損失」を置き、AIで減らせる分を Loss Avoidance として数えます。
            確定した損害額のようには見せず、必ず幅と前提を添えて出します。CORE ROAI SCORE では対策段階に応じた年間発生確率
            （点検・監査あり 3% ／ 基本対策のみ 8% ／ 担当者まかせ 15%）と削減率 {A.lossReduction * 100}% を仮定として明示します。
          </p>
        </motion.div>
      </Block>

      {/* INVESTMENT CAPACITY */}
      <Block id="roai-capacity" kick="AI investment capacity" h={<>投資の上限は、価格ではなく<br />リターンから逆算する。</>}
        lead="年間に見込める経済価値と目標ROAIから、合理的な投資規模を導きます。金額の妥当性は、相見積もりではなくリターンで判断すべきものです。">
        <motion.div {...reveal} className="ro-capacity">
          {[
            { k: 'Annual Potential Economic Value', v: '¥3,000万', j: '年間の潜在経済価値' },
            { k: 'Target ROAI', v: `${A.targetRoai}.0x`, j: '目標 ROAI' },
            { k: 'Indicative AI Investment Capacity', v: '¥600万', j: '投資余力の目安' },
          ].map((c, i) => (
            <div key={c.k} className="ro-capacity-cell">
              {i > 0 && <span className="ro-capacity-op" aria-hidden style={{ fontFamily: FONT_EN }}>{i === 1 ? '÷' : '='}</span>}
              <p style={{ fontFamily: FONT_EN, fontSize: '0.66rem', letterSpacing: '0.22em', color: ACCENT_LIGHT, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>{c.k}</p>
              <p style={{ fontFamily: FONT_EN, fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)', fontWeight: 800, color: '#fff', margin: '0.3rem 0 0.1rem', letterSpacing: '-0.02em' }}>{c.v}</p>
              <p style={{ fontFamily: FONT_JA, fontSize: '0.8rem', color: TEXT_MUTED, margin: 0 }}>{c.j}</p>
            </div>
          ))}
        </motion.div>
        <p style={{ fontFamily: FONT_JA, fontSize: '0.82rem', color: TEXT_MUTED, textAlign: 'center', margin: '1.4rem auto 0', maxWidth: 640, lineHeight: 1.8 }}>
          上記は前提を置いた試算例です。実際の投資規模は、貴社の現状データに基づく CORE ROAI SCORE の診断結果から算出します。
        </p>
      </Block>

      {/* TRANSFORMATION LOOP */}
      <Block id="roai-loop" kick="CORE Transformation Loop" h={<>Build and Leave ではなく、<br />Build, Measure and Evolve.</>} bg={INK_2}
        lead="納品をゴールにしません。理解・定義・再設計・構築・導入・計測・改善・拡大の8段を回し続けます。">
        <div className="ro-loop">
          {TRANSFORMATION_LOOP.map((s, i) => (
            <motion.div key={s.en} {...reveal} className="ro-loop-step">
              <span style={{ fontFamily: FONT_EN, fontSize: '0.68rem', letterSpacing: '0.2em', color: ACCENT, fontWeight: 700 }}>0{i + 1}</span>
              <h3 style={{ fontFamily: FONT_EN, fontSize: '1.05rem', fontWeight: 800, color: PAPER, margin: '0.3rem 0 0' }}>{s.en}</h3>
              <p style={{ fontFamily: FONT_JA, fontSize: '0.86rem', fontWeight: 700, color: '#fff', margin: '0.1rem 0 0.4rem' }}>{s.ja}</p>
              <p style={{ fontFamily: FONT_JA, fontSize: '0.8rem', color: TEXT_BODY, lineHeight: 1.8, margin: 0 }}>{s.body}</p>
            </motion.div>
          ))}
        </div>
      </Block>

      {/* MEASUREMENT PROCESS */}
      <Block id="roai-measure" kick="Measurement process" h={<>Before → After を、<br />同じKPIで測る。</>}
        lead="Business Goal → Baseline → KPI → ROAI Simulation → Redesign → Build → Deploy → Measure → Optimize → Scale。COREのすべての案件はこの順で進みます。">
        <motion.ol {...reveal} className="ro-measure" style={{ fontFamily: FONT_JA }}>
          {['経営目標を決める', 'ベースライン（今の時間・コスト・売上・リスク）を測る', 'KPI と目標 ROAI を置く', 'ROAI をシミュレーションする', '業務と組織を再設計する', '最適な技術で作る', '現場に導入する', '同じ KPI で After を測る', '改善する', '効いたものを広げる'].map((s, i) => (
            <li key={s}><span style={{ fontFamily: FONT_EN, color: ACCENT }}>{String(i + 1).padStart(2, '0')}</span>{s}</li>
          ))}
        </motion.ol>
        <p style={{ fontFamily: FONT_JA, fontSize: '0.84rem', color: TEXT_MUTED, margin: '1.6rem 0 0', lineHeight: 1.8, maxWidth: 720 }}>
          Technology follows Strategy. 最適ならOpenAI、Claude、Gemini、オープンソース。AIエージェントが不要なら使わない。自動化で十分ならAIすら使わない。
          COREは技術を売る会社ではなく、経営成果のために最適な技術を選ぶ会社です。
        </p>
      </Block>

      {/* FINAL CTA */}
      <section className="ch-band" aria-labelledby="roai-cta-h">
        <div className="ch-band-shade" aria-hidden />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, margin: '0 auto' }}>
          <p style={{ fontFamily: FONT_EN, fontSize: '0.72rem', letterSpacing: '0.3em', color: ACCENT_LIGHT, fontWeight: 600, marginBottom: '1rem' }}>MEASURE YOUR RETURN ON AI</p>
          <h2 id="roai-cta-h" style={{ ...sectionH2, fontSize: 'clamp(2rem, 4.4vw, 3.2rem)' }}>AI投資の前に、<br />Returnを測る。</h2>
          <p style={{ ...sectionLead, margin: '0 auto 2rem' }}>約3分で、あなたの会社のAI投資優先順位と潜在的な経済価値を診断します。</p>
          <div className="ch-cta-row" style={{ justifyContent: 'center' }}>
            <ScoreCta onAnchor={onAnchor} where="roai-final" label="CORE ROAI SCOREを受ける" />
            <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={ctaGhost}>ROAI戦略相談を申し込む</a>
          </div>
          <p style={{ fontFamily: FONT_JA, fontSize: '0.76rem', color: TEXT_MUTED, marginTop: '1.4rem', borderTop: `1px solid ${LINE}`, paddingTop: '1rem', display: 'inline-block' }}>
            CORE ROAI SCORE・CORE ROAI MODEL は株式会社COREの独自名称です。
          </p>
        </div>
      </section>
    </div>
  );
}
