// ============================================================
// RoaiScore — CORE ROAI SCORE（/roai-score）。開始画面 → 質問（1画面1決定）→ AI TRANSFORMATION BRIEF。
//
// 設計（MASTER PROMPT §18〜§39）:
//   ・Mobile First。1 画面に 1 つの質問、選んだら次へ。戻れる。閉じても続きから。
//   ・スコアと金額は engine.ts の決定論計算。ここでは表示と導線だけ。
//   ・結果は連絡先を入れる前に全部見せる（Progressive Profiling）。連絡先は価値を見た後で。
//   ・Lead Score は本人に見せない（サーバーでだけ算定）。
//   ・送信結果は API の応答を見てから表示する（「届きました」を先に言わない）。
// ============================================================
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type FormEvent } from 'react';
import { FONT_JA, FONT_EN, ACCENT, ACCENT_LIGHT, PAPER, TEXT_BODY, TEXT_MUTED, LINE, INK, ctaHero, ctaGhost } from '../corpTheme';
import { activeQuestions, findOption, CATEGORY_LABEL, INDUSTRY_LABEL, type Question } from './schema';
import { computeRoai, formatRangeYen, formatYen, formatHours, ASSUMPTIONS, type RoaiResult, type Basis } from './engine';
import { RETURN_BY_KEY, RETURNS } from './model';
import { loadSession, saveSession, clearSession, newSession, type RoaiSession } from './store';
import { track, takeSource } from './track';
import { ScoreGauge } from './HomeRoaiSections';

type AnchorHandler = (e: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;
type Phase = 'start' | 'quiz' | 'brief';

const OUTPUTS = ['AI投資の優先領域', '削減できる時間', '経済価値の概算', '売上改善余地', 'コスト削減余地', 'リスク削減余地', 'AI Readiness', '投資余力の目安'];

export default function RoaiScore({ onAnchor }: { onAnchor: AnchorHandler }) {
  const [session, setSession] = useState<RoaiSession>(() => loadSession() ?? newSession());
  const [phase, setPhase] = useState<Phase>(() => (loadSession()?.completedAt ? 'brief' : 'start'));
  const [saveFailed, setSaveFailed] = useState(false);
  const hasProgress = Object.keys(session.answers).length > 0 && !session.completedAt;

  // 開始画面を見た（1 回だけ）。source は開いた瞬間のものを使う
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    track('roai_view', session.source || takeSource() || 'direct');
  }, [session.source]);

  const persist = (s: RoaiSession) => {
    setSession(s);
    const ok = saveSession(s);
    setSaveFailed(!ok);
  };

  const start = (resume: boolean) => {
    const src = session.source || takeSource() || 'direct';
    if (resume) { track('roai_resume', src); persist({ ...session, source: src }); }
    else { track('roai_start', src); persist({ ...newSession(src) }); }
    setPhase('quiz');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const restart = () => { track('roai_restart'); clearSession(); persist(newSession('restart')); setPhase('start'); window.scrollTo({ top: 0, behavior: 'auto' }); };

  return (
    <div className="rs-page" style={{ background: INK, minHeight: '70vh' }}>
      {phase === 'start' && <StartScreen onStart={() => start(false)} onResume={hasProgress ? () => start(true) : undefined} answered={Object.keys(session.answers).length} />}
      {phase === 'quiz' && (
        <Quiz
          session={session}
          saveFailed={saveFailed}
          onChange={persist}
          onComplete={(s) => { persist({ ...s, completedAt: Date.now() }); track('roai_complete', s.source); setPhase('brief'); window.scrollTo({ top: 0, behavior: 'auto' }); }}
        />
      )}
      {phase === 'brief' && <Brief session={session} onAnchor={onAnchor} onRestart={restart} onLeadSent={(k) => persist({ ...session, leadSent: k })} />}
    </div>
  );
}

// ── 開始画面 ──────────────────────────────────────────
function StartScreen({ onStart, onResume, answered }: { onStart: () => void; onResume?: () => void; answered: number }) {
  return (
    <section className="rs-shell rs-start lp-safe" aria-labelledby="rs-start-h">
      <p style={{ fontFamily: FONT_EN, fontSize: '0.72rem', letterSpacing: '0.3em', color: ACCENT_LIGHT, fontWeight: 700, margin: '0 0 1rem' }}>CORE ROAI SCORE</p>
      <h1 id="rs-start-h" className="rs-h1" style={{ fontFamily: FONT_JA }}>
        あなたの会社の、<br />次にAI投資すべき場所はどこか。
      </h1>
      <p style={{ fontFamily: FONT_JA, fontSize: '1rem', lineHeight: 1.95, color: TEXT_BODY, margin: '1.2rem 0 1.6rem' }}>
        約3分・選択式の診断で、次を可視化します。すべての数字は入力と公開された仮定から計算し、根拠を開いて確かめられます。
      </p>
      <ul className="ro-outputs" style={{ fontFamily: FONT_JA }}>
        {OUTPUTS.map(o => <li key={o}>{o}</li>)}
      </ul>
      <div className="rs-start-cta">
        {onResume && (
          <button type="button" onClick={onResume} style={{ ...ctaHero, border: 'none', cursor: 'pointer', width: '100%' }}>
            続きから再開する（{answered}問まで回答済み）
          </button>
        )}
        <button type="button" onClick={onStart} style={{ ...(onResume ? ctaGhost : ctaHero), border: onResume ? ctaGhost.border : 'none', cursor: 'pointer', width: '100%' }}>
          {onResume ? '最初からやり直す' : '無料でROAIを診断する'}
        </button>
      </div>
      <p style={{ fontFamily: FONT_JA, fontSize: '0.76rem', color: TEXT_MUTED, lineHeight: 1.8, margin: '1.4rem 0 0' }}>
        連絡先の入力は不要です。結果を見たあとで、詳細レポートや相談を希望する場合にだけお聞きします。
        回答はお使いの端末に保存され、送信するまでCOREには届きません。
      </p>
    </section>
  );
}

// ── 質問 ──────────────────────────────────────────────
function Quiz({ session, saveFailed, onChange, onComplete }: { session: RoaiSession; saveFailed: boolean; onChange: (s: RoaiSession) => void; onComplete: (s: RoaiSession) => void }) {
  const questions = useMemo(() => activeQuestions(session.answers), [session.answers]);
  const idx = Math.min(session.idx, questions.length - 1);
  const q: Question = questions[idx];
  const selected = session.answers[q.id];
  const [pending, setPending] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { headRef.current?.focus({ preventScroll: true }); setPending(null); }, [q.id]);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const choose = (value: string) => {
    if (pending) return;
    setPending(value);
    const next: RoaiSession = { ...session, answers: { ...session.answers, [q.id]: value } };
    track('roai_step', q.id);
    // 回答で分岐が変わることがある（業界）ので、次の質問リストは新しい回答で引き直す
    const nextQs = activeQuestions(next.answers);
    const nextIdx = nextQs.findIndex(x => x.id === q.id) + 1;
    timer.current = window.setTimeout(() => {
      if (nextIdx >= nextQs.length) onComplete({ ...next, idx: nextIdx - 1 });
      else onChange({ ...next, idx: nextIdx });
    }, 180);
  };
  const back = () => {
    if (idx === 0) return;
    track('roai_back', q.id);
    onChange({ ...session, idx: idx - 1 });
  };

  // 数字キーで選べる（キーボード操作）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length && !(e.target instanceof HTMLInputElement)) choose(q.options[n - 1].value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id, pending]);

  const cat = CATEGORY_LABEL[q.category];
  const pct = Math.round((idx / questions.length) * 100);
  return (
    <section className="rs-shell rs-quiz lp-safe" aria-live="polite">
      <div className="rs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="診断の進み具合">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="rs-quiz-meta">
        <span style={{ fontFamily: FONT_EN, color: ACCENT_LIGHT, letterSpacing: '0.24em', fontSize: '0.66rem', fontWeight: 700 }}>{cat.en}</span>
        <span style={{ fontFamily: FONT_JA, color: TEXT_MUTED, fontSize: '0.76rem' }}>{cat.ja} ・ {idx + 1} / {questions.length}</span>
      </div>
      <h2 ref={headRef} tabIndex={-1} className="rs-q" style={{ fontFamily: FONT_JA }}>{q.text}</h2>
      {q.hint && <p style={{ fontFamily: FONT_JA, fontSize: '0.82rem', color: TEXT_MUTED, margin: '0 0 1.2rem', lineHeight: 1.7 }}>{q.hint}</p>}
      <div className="rs-opts" role="radiogroup" aria-label={q.text}>
        {q.options.map((o, i) => {
          const on = (pending ?? selected) === o.value;
          return (
            <button
              key={o.value} type="button" role="radio" aria-checked={on}
              className={'rs-opt' + (on ? ' is-on' : '')}
              onClick={() => choose(o.value)}
              style={{ fontFamily: FONT_JA }}
            >
              <span className="rs-opt-n" style={{ fontFamily: FONT_EN }} aria-hidden>{i + 1}</span>
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
      <div className="rs-nav">
        <button type="button" onClick={back} disabled={idx === 0} className="rs-back" style={{ fontFamily: FONT_JA }}>← 前の質問へ</button>
        {saveFailed && <span style={{ fontFamily: FONT_JA, fontSize: '0.74rem', color: '#FCA5A5' }}>この端末に途中保存できません（結果は表示できます）</span>}
      </div>
    </section>
  );
}

// ── AI TRANSFORMATION BRIEF ────────────────────────────
function Brief({ session, onAnchor, onRestart, onLeadSent }: { session: RoaiSession; onAnchor: AnchorHandler; onRestart: () => void; onLeadSent: (k: 'report' | 'consult') => void }) {
  const r = useMemo(() => computeRoai(session.answers), [session.answers]);
  useEffect(() => { track('roai_result_view', r.recommendation.mode); }, [r.recommendation.mode]);
  const [fallbackNow] = useState(() => Date.now());
  const date = new Date(session.completedAt ?? fallbackNow);
  const emp = findOption(activeQuestions(session.answers).find(q => q.id === 'employees')!, session.answers.employees)?.label;
  const ind = r.industry ? INDUSTRY_LABEL[r.industry] : '業種未回答';
  const top3 = r.priorities.slice(0, 3);

  return (
    <article className="rs-brief lp-safe" aria-labelledby="rs-brief-h">
      {/* 表紙 */}
      <header className="rs-shell rs-brief-head">
        <p style={{ fontFamily: FONT_EN, fontSize: '0.72rem', letterSpacing: '0.3em', color: ACCENT_LIGHT, fontWeight: 700, margin: '0 0 0.8rem' }}>AI TRANSFORMATION BRIEF</p>
        <h1 id="rs-brief-h" className="rs-h1" style={{ fontFamily: FONT_JA }}>{ind}・{emp ?? '規模未回答'}の御社の、<br />AI投資の優先順位。</h1>
        <p style={{ fontFamily: FONT_EN, fontSize: '0.74rem', color: TEXT_MUTED, margin: '0.8rem 0 0', letterSpacing: '0.06em' }}>
          {date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })} ・ CORE ROAI SCORE v{r.version}
        </p>
      </header>

      {/* Executive Summary + Score */}
      <section className="rs-shell rs-sec" aria-labelledby="rs-sum-h">
        <div className="rs-score-row">
          <ScoreGauge value={r.score} label="CORE ROAI SCORE" size={190} />
          <div className="rs-score-side">
            <h2 id="rs-sum-h" className="rs-h2" style={{ fontFamily: FONT_JA }}>Executive Summary</h2>
            <ul className="rs-summary" style={{ fontFamily: FONT_JA }}>
              {r.summary.map(s => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </div>
        <div className="rs-kpis">
          <Kpi k="AI READINESS" v={`${r.readiness}`} sub="/ 100 ・ 実装できる状態か" />
          <Kpi k="OPPORTUNITY" v={`${r.scoreBreakdown.opportunity}`} sub="/ 100 ・ 改善余地の大きさ" />
          <Kpi k="MAGNITUDE" v={`${r.scoreBreakdown.magnitude}`} sub="/ 100 ・ 年商に対する価値の大きさ" />
        </div>
      </section>

      {/* Opportunity Map */}
      <section className="rs-shell rs-sec" aria-labelledby="rs-map-h">
        <h2 id="rs-map-h" className="rs-h2" style={{ fontFamily: FONT_JA }}>ROAI Opportunity Map</h2>
        <p className="rs-lead" style={{ fontFamily: FONT_JA }}>5つのReturnそれぞれで、改善余地がどれだけ大きいか。高いほど、そこにAI投資する意味が大きい。</p>
        <div className="rs-map">
          {RETURNS.map(d => {
            const v = r.categoryScores[d.key];
            return (
              <div key={d.key} className="rs-map-row">
                <div className="rs-map-k"><span style={{ fontFamily: FONT_EN }}>{d.en}</span><span style={{ fontFamily: FONT_JA }}>{d.ja}</span></div>
                <div className="rs-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={`${d.en} ${v}`}><span style={{ width: `${v}%` }} /></div>
                <span className="rs-map-v" style={{ fontFamily: FONT_EN }}>{v}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Priorities */}
      <section className="rs-shell rs-sec" aria-labelledby="rs-prio-h">
        <h2 id="rs-prio-h" className="rs-h2" style={{ fontFamily: FONT_JA }}>Your AI Priorities</h2>
        <p className="rs-lead" style={{ fontFamily: FONT_JA }}>投資の優先順位。Return の大きさと、その Return の経営上の重みで並べています。</p>
        <ol className="rs-prio">
          {top3.map(p => (
            <li key={p.key}>
              <span className="rs-prio-no" style={{ fontFamily: FONT_EN }}>0{p.rank}</span>
              <div>
                <p style={{ fontFamily: FONT_EN, fontSize: '1.02rem', fontWeight: 800, color: PAPER, margin: 0 }}>{p.title}</p>
                <p style={{ fontFamily: FONT_JA, fontSize: '0.86rem', fontWeight: 700, color: '#fff', margin: '0.1rem 0 0.35rem' }}>{p.titleJa}</p>
                <p style={{ fontFamily: FONT_JA, fontSize: '0.82rem', color: TEXT_BODY, lineHeight: 1.8, margin: 0 }}>{p.why}</p>
                <ul className="rs-usecases" style={{ fontFamily: FONT_JA }}>
                  {RETURN_BY_KEY[p.key].useCases.slice(0, 3).map(u => <li key={u}>{u}</li>)}
                </ul>
              </div>
              <span className={'rs-pot is-' + p.potential.toLowerCase().replace('-', '')} style={{ fontFamily: FONT_EN }}>{p.potential}</span>
            </li>
          ))}
        </ol>
        {r.priorities.length > 3 && (
          <p style={{ fontFamily: FONT_JA, fontSize: '0.78rem', color: TEXT_MUTED, margin: '0.8rem 0 0' }}>
            続いて {r.priorities.slice(3).map(p => `${p.titleJa}（${p.potential}）`).join('、')}。
          </p>
        )}
      </section>

      {/* Economic value */}
      <section className="rs-shell rs-sec" aria-labelledby="rs-val-h">
        <h2 id="rs-val-h" className="rs-h2" style={{ fontFamily: FONT_JA }}>Estimated Annual AI Opportunity</h2>
        <p className="rs-lead" style={{ fontFamily: FONT_JA }}>年間の潜在的な経済価値。幅で示し、下の「算定根拠を見る」で式と仮定を確かめられます。</p>
        <div className="rs-value">
          <Val k="POTENTIAL HOURS SAVED" v={`${formatHours(r.value.hoursSaved.mid)} / 年`} sub={`${formatHours(r.value.hoursSaved.low)}〜${formatHours(r.value.hoursSaved.high)}`} />
          <Val k="PRODUCTIVITY VALUE" v={formatYen(r.value.productivity.mid)} sub={formatRangeYen(r.value.productivity)} />
          <Val k="POTENTIAL COST REDUCTION" v={r.value.costReduction.mid > 0 ? formatYen(r.value.costReduction.mid) : '—'} sub={r.value.costReduction.mid > 0 ? formatRangeYen(r.value.costReduction) : '置き換え対象の外注なし'} />
          <Val k="REVENUE OPPORTUNITY" v={r.value.revenue.mid > 0 ? formatRangeYen(r.value.revenue) : '—'} sub="売上改善の幅" />
          <Val k="POTENTIAL LOSS AVOIDANCE" v={r.value.lossAvoidance.mid > 0 ? `${formatYen(r.value.lossAvoidance.mid)}+` : '—'} sub="期待損失ベース" />
        </div>
        <div className="rs-total">
          <span style={{ fontFamily: FONT_EN, fontSize: '0.66rem', letterSpacing: '0.24em', color: ACCENT_LIGHT, fontWeight: 700 }}>TOTAL POTENTIAL VALUE</span>
          <strong style={{ fontFamily: FONT_EN, fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: '#fff', letterSpacing: '-0.02em' }}>{formatRangeYen(r.value.total)}</strong>
          <span style={{ fontFamily: FONT_JA, fontSize: '0.78rem', color: TEXT_MUTED }}>/ 年（中央値 {formatYen(r.value.total.mid)}）</span>
        </div>
        <p className="rs-disclaimer" style={{ fontFamily: FONT_JA }}>
          入力情報および一定の仮定に基づく概算シミュレーションであり、成果を保証するものではありません。実際の数値は、AI Transformation Session で御社の実数から算定します。
        </p>
        <BasisPanel r={r} />
      </section>

      {/* Investment capacity */}
      <section className="rs-shell rs-sec" aria-labelledby="rs-cap-h">
        <h2 id="rs-cap-h" className="rs-h2" style={{ fontFamily: FONT_JA }}>AI Investment Capacity</h2>
        <p className="rs-lead" style={{ fontFamily: FONT_JA }}>Return から逆算した、合理的な投資額の目安。「高いか安いか」ではなく「何を得るためにいくらか」で判断するために。</p>
        <div className="rs-cap">
          {r.capacity.table.map(t => (
            <div key={t.roai} className={'rs-cap-cell' + (t.roai === r.capacity.targetRoai ? ' is-target' : '')}>
              <span style={{ fontFamily: FONT_EN, fontSize: '0.66rem', letterSpacing: '0.2em', color: t.roai === r.capacity.targetRoai ? ACCENT_LIGHT : TEXT_MUTED, fontWeight: 700 }}>TARGET ROAI {t.roai}.0x</span>
              <strong style={{ fontFamily: FONT_EN, fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: '#fff', letterSpacing: '-0.02em' }}>{t.investment > 0 ? formatYen(t.investment) : '—'}</strong>
              <span style={{ fontFamily: FONT_JA, fontSize: '0.74rem', color: TEXT_MUTED }}>{t.roai === r.capacity.targetRoai ? '基準' : t.roai < r.capacity.targetRoai ? '積極' : '保守'}</span>
            </div>
          ))}
        </div>
        {r.budget.gapNote && <p style={{ fontFamily: FONT_JA, fontSize: '0.86rem', color: TEXT_BODY, lineHeight: 1.85, margin: '1.2rem 0 0', borderLeft: `2px solid ${ACCENT}`, paddingLeft: '0.9rem' }}>{r.budget.gapNote}</p>}
      </section>

      {/* Recommendation + Roadmap */}
      <section className="rs-shell rs-sec" aria-labelledby="rs-rec-h">
        <p style={{ fontFamily: FONT_EN, fontSize: '0.66rem', letterSpacing: '0.24em', color: ACCENT_LIGHT, fontWeight: 700, margin: '0 0 0.5rem' }}>RECOMMENDATION</p>
        <h2 id="rs-rec-h" className="rs-h2" style={{ fontFamily: FONT_JA, fontSize: 'clamp(1.4rem, 3vw, 1.9rem)' }}>{r.recommendation.headline}</h2>
        <p style={{ fontFamily: FONT_JA, fontSize: '0.92rem', color: TEXT_BODY, lineHeight: 1.95, margin: '0 0 2rem' }}>{r.recommendation.body}</p>
        <h3 style={{ fontFamily: FONT_EN, fontSize: '0.72rem', letterSpacing: '0.24em', color: TEXT_MUTED, fontWeight: 700, margin: '0 0 1rem' }}>90-DAY AI TRANSFORMATION ROADMAP</h3>
        <div className="rs-road">
          {r.roadmap.map(p => (
            <div key={p.en} className="rs-road-phase">
              <span style={{ fontFamily: FONT_EN, fontSize: '0.66rem', letterSpacing: '0.2em', color: ACCENT, fontWeight: 700 }}>{p.range}</span>
              <p style={{ fontFamily: FONT_EN, fontSize: '1rem', fontWeight: 800, color: PAPER, margin: '0.2rem 0 0' }}>{p.en}</p>
              <p style={{ fontFamily: FONT_JA, fontSize: '0.8rem', fontWeight: 700, color: '#fff', margin: '0 0 0.6rem' }}>{p.ja}</p>
              <ul style={{ fontFamily: FONT_JA }}>{p.items.map(i => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      {/* Next action */}
      <NextAction session={session} r={r} onAnchor={onAnchor} onLeadSent={onLeadSent} />

      <footer className="rs-shell" style={{ padding: '1rem 1.25rem 4rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={onRestart} className="rs-back" style={{ fontFamily: FONT_JA }}>もう一度診断する</button>
        <a href="/return-on-ai" onClick={e => onAnchor(e, '/return-on-ai')} className="ch-textlink">Return on AI の考え方 →</a>
      </footer>
    </article>
  );
}

function Kpi({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="rs-kpi">
      <span style={{ fontFamily: FONT_EN, fontSize: '0.62rem', letterSpacing: '0.24em', color: ACCENT_LIGHT, fontWeight: 700 }}>{k}</span>
      <strong style={{ fontFamily: FONT_EN, fontSize: '1.7rem', color: '#fff', letterSpacing: '-0.02em' }}>{v}</strong>
      <span style={{ fontFamily: FONT_JA, fontSize: '0.72rem', color: TEXT_MUTED }}>{sub}</span>
    </div>
  );
}
function Val({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="rs-val">
      <span style={{ fontFamily: FONT_EN, fontSize: '0.62rem', letterSpacing: '0.22em', color: ACCENT_LIGHT, fontWeight: 700 }}>{k}</span>
      <strong style={{ fontFamily: FONT_EN, fontSize: 'clamp(1.2rem, 2.4vw, 1.6rem)', color: '#fff', letterSpacing: '-0.02em' }}>{v}</strong>
      <span style={{ fontFamily: FONT_JA, fontSize: '0.72rem', color: TEXT_MUTED }}>{sub}</span>
    </div>
  );
}

const BASIS_KIND: Record<Basis['kind'], string> = { input: '入力', benchmark: 'ベンチマーク', assumption: '仮定', formula: '式' };
function BasisPanel({ r }: { r: RoaiResult }) {
  const groups: { t: string; b: Basis[] }[] = [
    { t: '削減できる時間・生産性価値', b: [...r.value.hoursSaved.basis, ...r.value.productivity.basis] },
    { t: 'コスト削減', b: r.value.costReduction.basis },
    { t: '売上機会', b: r.value.revenue.basis },
    { t: '損失回避', b: r.value.lossAvoidance.basis },
    { t: '合計・投資余力', b: [...r.value.total.basis, ...r.capacity.basis] },
    { t: 'スコアの合成', b: [{ kind: 'formula', label: 'CORE ROAI SCORE', value: `改善余地 ${r.scoreBreakdown.opportunity} × 50% ＋ 価値の大きさ ${r.scoreBreakdown.magnitude} × 20% ＋ Readiness ${r.readiness} × 30%` }, { kind: 'assumption', label: '価値の大きさの満点', value: `年間経済価値が年商の 12% に達したとき 100` }] },
  ];
  return (
    <details className="rs-basis" onToggle={e => { if ((e.currentTarget as HTMLDetailsElement).open) track('roai_basis_open'); }}>
      <summary style={{ fontFamily: FONT_JA }}>算定根拠を見る</summary>
      <div className="rs-basis-body">
        <p style={{ fontFamily: FONT_JA, fontSize: '0.8rem', color: TEXT_MUTED, margin: '0 0 1rem', lineHeight: 1.8 }}>
          すべての数字は、御社の入力・公開されたベンチマーク・明示した仮定・式のどれかから計算しています。LLMは使っていません。同じ回答なら同じ結果になります。
        </p>
        {groups.map(g => (
          <div key={g.t} className="rs-basis-group">
            <h4 style={{ fontFamily: FONT_JA }}>{g.t}</h4>
            <dl>
              {g.b.map((b, i) => (
                <div key={i}>
                  <dt><span className={'rs-basis-kind is-' + b.kind} style={{ fontFamily: FONT_JA }}>{BASIS_KIND[b.kind]}</span><span style={{ fontFamily: FONT_JA }}>{b.label}</span></dt>
                  <dd style={{ fontFamily: FONT_JA }}>{b.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p style={{ fontFamily: FONT_JA, fontSize: '0.74rem', color: TEXT_MUTED, margin: '1rem 0 0' }}>人件費単価 ¥{ASSUMPTIONS.hourlyCost.toLocaleString('ja-JP')}/時 は賞与・社会保険を含む総額ベースの概算中央値。御社の実数に置き換えると精度が上がります。</p>
      </div>
    </details>
  );
}

// ── 次の一手（Progressive Profiling） ──────────────────
function NextAction({ session, r, onAnchor, onLeadSent }: { session: RoaiSession; r: RoaiResult; onAnchor: AnchorHandler; onLeadSent: (k: 'report' | 'consult') => void }) {
  const [kind, setKind] = useState<'report' | 'consult'>('consult');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'fail'>(session.leadSent ? 'ok' : 'idle');
  const [failMsg, setFailMsg] = useState('');
  const [sentKind, setSentKind] = useState<'report' | 'consult' | undefined>(session.leadSent);
  const resultRef = useRef<HTMLParagraphElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === 'sending') return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setState('fail'); setFailMsg('メールアドレスの形式を確認してください。'); return; }
    setState('sending');
    track(kind === 'consult' ? 'roai_consult_click' : 'roai_report_request', 'brief-form');
    try {
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch('/api/roai/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ kind, answers: session.answers, contact: { email: email.trim(), company, name, phone, message }, source: session.source || '', website }),
      });
      window.clearTimeout(t);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && (data.delivered || data.stored)) {
        setState('ok'); setSentKind(kind); onLeadSent(kind);
        track(kind === 'consult' ? 'roai_consult_submit' : 'roai_report_request', 'ok');
      } else {
        setState('fail');
        setFailMsg(res.status === 429 ? '送信回数が多すぎます。しばらくしてからお試しください。' : data.error === 'invalid_email' ? 'メールアドレスの形式を確認してください。' : '送信できませんでした。時間をおいて再度お試しいただくか、info@core-ai.jp へ直接ご連絡ください。');
        track(kind === 'consult' ? 'roai_consult_submit' : 'roai_report_request', 'fail');
      }
    } catch {
      setState('fail');
      setFailMsg('通信できませんでした。電波の良い場所で再度お試しください。');
      track(kind === 'consult' ? 'roai_consult_submit' : 'roai_report_request', 'fail');
    }
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: 'nearest' }));
  };

  return (
    <section className="rs-shell rs-sec rs-next" aria-labelledby="rs-next-h">
      <p style={{ fontFamily: FONT_EN, fontSize: '0.66rem', letterSpacing: '0.24em', color: ACCENT_LIGHT, fontWeight: 700, margin: '0 0 0.5rem' }}>NEXT ACTION</p>
      <h2 id="rs-next-h" className="rs-h2" style={{ fontFamily: FONT_JA }}>この会社のROAIを、<br />実際の数字で算定する。</h2>
      <p style={{ fontFamily: FONT_JA, fontSize: '0.92rem', color: TEXT_BODY, lineHeight: 1.95, margin: '0 0 1.6rem' }}>
        COREのAI Transformation Sessionでは、業務構造・売上構造・人件費・システム・データ・リスクを分析し、
        「どこへ、いくらAI投資すると、どの程度のReturnが期待できるか」を御社の実数で具体化します。
        最初の投資先は「{r.priorities[0].titleJa}」。ここから話を始めます。
      </p>

      {state === 'ok' ? (
        <div className="rs-done" role="status">
          <p style={{ fontFamily: FONT_JA, fontSize: '1rem', fontWeight: 800, color: '#fff', margin: '0 0 0.4rem' }}>
            {sentKind === 'consult' ? 'ROAI戦略相談を受け付けました。' : '詳細レポートのご依頼を受け付けました。'}
          </p>
          <p style={{ fontFamily: FONT_JA, fontSize: '0.84rem', color: TEXT_BODY, lineHeight: 1.85, margin: 0 }}>
            通常1〜3営業日以内に、診断結果を踏まえてご連絡します。急ぎの場合は <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={{ color: ACCENT_LIGHT }}>相談フォーム</a> からもどうぞ。
          </p>
        </div>
      ) : (
        <form className="rs-form" onSubmit={submit} noValidate>
          <div className="rs-kind" role="radiogroup" aria-label="希望する次の一手">
            <button type="button" role="radio" aria-checked={kind === 'consult'} className={'rs-kind-btn' + (kind === 'consult' ? ' is-on' : '')} onClick={() => setKind('consult')} style={{ fontFamily: FONT_JA }}>
              <strong>ROAI戦略相談を申し込む</strong><span>60分・無料。実数でのROAI算定の進め方をご案内。</span>
            </button>
            <button type="button" role="radio" aria-checked={kind === 'report'} className={'rs-kind-btn' + (kind === 'report' ? ' is-on' : '')} onClick={() => setKind('report')} style={{ fontFamily: FONT_JA }}>
              <strong>詳細レポートを受け取る</strong><span>この Brief の詳細版（経営会議で使える形）をメールで。</span>
            </button>
          </div>
          <label className="rs-field"><span style={{ fontFamily: FONT_JA }}>メールアドレス <em>必須</em></span>
            <input type="email" inputMode="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.co.jp" />
          </label>
          <div className="rs-field-row">
            <label className="rs-field"><span style={{ fontFamily: FONT_JA }}>会社名</span>
              <input type="text" autoComplete="organization" value={company} onChange={e => setCompany(e.target.value)} maxLength={120} />
            </label>
            <label className="rs-field"><span style={{ fontFamily: FONT_JA }}>お名前</span>
              <input type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={80} />
            </label>
          </div>
          {kind === 'consult' && (
            <>
              <label className="rs-field"><span style={{ fontFamily: FONT_JA }}>電話番号（任意）</span>
                <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} />
              </label>
              <label className="rs-field"><span style={{ fontFamily: FONT_JA }}>いま一番、お金・時間・機会を失っている場所（任意）</span>
                <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} />
              </label>
            </>
          )}
          {/* honeypot: 人は見えない・触れない */}
          <label className="rs-hp" aria-hidden="true"><input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
          <button type="submit" disabled={state === 'sending'} style={{ ...ctaHero, border: 'none', cursor: state === 'sending' ? 'wait' : 'pointer', width: '100%', opacity: state === 'sending' ? 0.7 : 1 }}>
            {state === 'sending' ? '送信しています…' : kind === 'consult' ? 'ROAI戦略相談を申し込む' : '詳細レポートを受け取る'}
          </button>
          <p ref={resultRef} role="alert" style={{ fontFamily: FONT_JA, fontSize: '0.8rem', color: '#FCA5A5', minHeight: '1.2em', margin: '0.6rem 0 0' }}>{state === 'fail' ? failMsg : ''}</p>
          <p style={{ fontFamily: FONT_JA, fontSize: '0.72rem', color: TEXT_MUTED, lineHeight: 1.8, margin: '0.4rem 0 0' }}>
            送信すると、診断の回答と連絡先が株式会社COREに届きます。ご連絡とレポート作成の目的にのみ使用し、1年で削除します。第三者に提供しません。
          </p>
        </form>
      )}
      <p style={{ fontFamily: FONT_JA, fontSize: '0.78rem', color: TEXT_MUTED, margin: '1.4rem 0 0', borderTop: `1px solid ${LINE}`, paddingTop: '1rem' }}>
        フォームを使わずに相談したい場合は <a href="#contact" onClick={e => { track('roai_consult_click', 'brief-contact-link'); onAnchor(e, '#contact'); }} style={{ color: ACCENT_LIGHT }}>お問い合わせ</a>、または {' '}
        <a href="mailto:info@core-ai.jp" style={{ color: ACCENT_LIGHT }}>info@core-ai.jp</a> へ。
      </p>
    </section>
  );
}
