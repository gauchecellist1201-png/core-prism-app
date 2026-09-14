import { useMemo, useRef, useState } from 'react';
import {
  INDUSTRIES, WORKFLOWS, WORKFLOW_QUESTIONS, calculateWorkflowScan,
  type WorkflowAnswers,
} from './workflowScanData';

type Phase = 'intro' | 'questions' | 'result';
const STORAGE_KEY = 'core-workflow-scan-v1';
const nf = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });
const yen = (value: number) => value >= 10000 ? `${nf.format(Math.round(value / 10000))}万円` : `${nf.format(value)}円`;

function loadSaved(): { index: number; answers: WorkflowAnswers } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { index: 0, answers: {} };
    const saved = JSON.parse(raw) as { index?: number; answers?: WorkflowAnswers };
    return { index: Math.min(Math.max(saved.index ?? 0, 0), WORKFLOW_QUESTIONS.length - 1), answers: saved.answers ?? {} };
  } catch {
    return { index: 0, answers: {} };
  }
}

export default function WorkflowScan() {
  const saved = useMemo(loadSaved, []);
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(saved.index);
  const [answers, setAnswers] = useState<WorkflowAnswers>(saved.answers);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const topRef = useRef<HTMLElement>(null);
  const question = WORKFLOW_QUESTIONS[index];

  const moveTop = () => requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const persist = (nextIndex: number, nextAnswers: WorkflowAnswers) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: nextIndex, answers: nextAnswers })); } catch { /* 診断は保存できなくても続行できる */ }
  };
  const start = (fresh = false) => {
    if (fresh) {
      setIndex(0); setAnswers({});
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* 保存不可でも新規診断は開始できる */ }
    }
    setError(''); setPhase('questions'); moveTop();
  };
  const update = (id: string, value: string | number) => {
    setAnswers(current => ({ ...current, [id]: value }));
    setError('');
  };
  const valid = () => {
    if (question.type === 'context') return Boolean(answers.industry && answers.workflow);
    const value = answers[question.id];
    if (question.type === 'choice') return Number(value) >= 1;
    const number = Number(value ?? question.defaultValue);
    return Number.isFinite(number) && number >= question.min && number <= question.max;
  };
  const next = () => {
    if (!valid()) { setError(question.type === 'context' ? '業種と業務を選んでください。' : question.type === 'choice' ? 'もっとも近いものを選んでください。' : `${question.min}〜${question.max.toLocaleString('ja-JP')}の範囲で入力してください。`); return; }
    const nextAnswers = question.type === 'number' && answers[question.id] == null && question.defaultValue != null
      ? { ...answers, [question.id]: question.defaultValue }
      : answers;
    if (index === WORKFLOW_QUESTIONS.length - 1) {
      setAnswers(nextAnswers); persist(index, nextAnswers); setPhase('result'); moveTop(); return;
    }
    const nextIndex = index + 1;
    setAnswers(nextAnswers); setIndex(nextIndex); persist(nextIndex, nextAnswers); setError(''); moveTop();
  };
  const back = () => { if (index === 0) { setPhase('intro'); } else { const nextIndex = index - 1; setIndex(nextIndex); persist(nextIndex, answers); } setError(''); moveTop(); };

  const result = phase === 'result' ? calculateWorkflowScan(answers) : null;
  const summary = result ? `CORE 業務診断\n業種: ${answers.industry}\n業務: ${answers.workflow}\n実装適性: ${result.suitability}/100\n現在時間: ${nf.format(result.annualHours)}時間/年\n検証で戻せる可能性: ${nf.format(result.low)}〜${nf.format(result.high)}時間/年\n推奨: ${result.title}\n※自己申告にもとづく試算で、効果を保証するものではありません。` : '';
  const copy = async () => { try { await navigator.clipboard.writeText(summary); setCopied(true); } catch { setCopied(false); } };

  return (
    <section ref={topRef} id="workflow-scan" className={`ws-section is-${phase}`} aria-labelledby="workflow-scan-title">
      <div className="ws-shell">
        {phase === 'intro' && (
          <div className="ws-intro">
            <div className="ws-intro-copy">
              <p className="ws-kicker">CORE ROAI SCORE / 無料</p>
              <h1 id="workflow-scan-title">最初に検証する業務を、<br />5分で決める。</h1>
              <p>AI投資の優先順位を、年間工数と実装条件から整理します。業種と業務を選び、10問に答えるだけです。</p>
              <button type="button" className="ws-primary" onClick={() => start(false)}>{Object.keys(answers).length ? '続きから診断する' : '無料診断を始める'}</button>
              {Object.keys(answers).length > 0 && <button type="button" className="ws-text-button" onClick={() => start(true)}>最初から診断する</button>}
              <small>登録不要。回答はこの端末に保存され、送信するまでCOREには届きません。</small>
            </div>
            <div className="ws-output" aria-label="診断で得られるもの">
              <p className="ws-kicker">OUTPUT</p>
              <div><span>01</span><strong>優先して検証する業務</strong></div>
              <div><span>02</span><strong>年間の作業時間と時間価値</strong></div>
              <div><span>03</span><strong>実装適性と30日間の検証順序</strong></div>
              <p className="ws-note">自己申告にもとづく機会発見です。導入効果や利益を保証する診断ではありません。</p>
            </div>
          </div>
        )}

        {phase === 'questions' && (
          <div className="ws-question-wrap">
            <div className="ws-progress-copy"><span>{index === 0 ? '業務を決める' : index < 5 ? '時間を測る' : '実装条件を見る'}</span><span>{index + 1} / {WORKFLOW_QUESTIONS.length}</span></div>
            <div className="ws-progress" role="progressbar" aria-label="診断の進み具合" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((index + 1) / WORKFLOW_QUESTIONS.length * 100)}><span style={{ width: `${(index + 1) / WORKFLOW_QUESTIONS.length * 100}%` }} /></div>
            <p className="ws-kicker">QUESTION {String(index + 1).padStart(2, '0')}</p>
            <h1 id="workflow-scan-title">{question.title}</h1>
            {question.hint && <p className="ws-hint">{question.hint}</p>}

            {question.type === 'context' && (
              <div className="ws-fields">
                <label><span>業種</span><select value={String(answers.industry ?? '')} onChange={e => { update('industry', e.target.value); update('workflow', ''); }}><option value="">選択してください</option>{INDUSTRIES.map(item => <option key={item}>{item}</option>)}</select></label>
                <label><span>業務</span><select value={String(answers.workflow ?? '')} disabled={!answers.industry} onChange={e => update('workflow', e.target.value)}><option value="">{answers.industry ? '選択してください' : '先に業種を選んでください'}</option>{answers.industry && [...(WORKFLOWS[String(answers.industry)] ?? WORKFLOWS['その他']), 'その他の業務'].map(item => <option key={item}>{item}</option>)}</select></label>
              </div>
            )}
            {question.type === 'number' && (
              <label className="ws-number"><span>{question.label}</span><span className="ws-number-control"><input type="number" inputMode="decimal" min={question.min} max={question.max} value={String(answers[question.id] ?? question.defaultValue ?? '')} onChange={e => update(question.id, e.target.value)} /><b>{question.unit}</b></span></label>
            )}
            {question.type === 'choice' && (
              <div className="ws-options" role="radiogroup" aria-label={question.title}>{question.options.map(option => <button key={option.value} type="button" role="radio" aria-checked={Number(answers[question.id]) === option.value} className={Number(answers[question.id]) === option.value ? 'is-selected' : ''} onClick={() => update(question.id, option.value)}><span aria-hidden>{String(option.value).padStart(2, '0')}</span><strong>{option.label}</strong></button>)}</div>
            )}
            <p className="ws-error" role="alert">{error}</p>
            <div className="ws-nav"><button type="button" className="ws-back" onClick={back}>戻る</button><button type="button" className="ws-primary" onClick={next}>{index === WORKFLOW_QUESTIONS.length - 1 ? '結果を見る' : '次へ'}</button></div>
          </div>
        )}

        {phase === 'result' && result && (
          <article className="ws-result">
            <div className="ws-result-head">
              <div><p className="ws-kicker">ESTIMATE / 自己申告にもとづく試算</p><h1 id="workflow-scan-title">最初に検証する業務が、<br />決まりました。</h1><p>「{answers.workflow}」は、{result.title.replace('。', '')}ことが最初の判断です。</p></div>
              <div className="ws-score"><strong>{result.suitability}</strong><span>実装適性 / 100</span></div>
            </div>
            <div className="ws-metrics">
              <div><span>INPUT</span><p>現在の年間作業時間</p><strong>{nf.format(result.annualHours)}時間</strong></div>
              <div><span>ESTIMATE</span><p>検証で戻せる可能性</p><strong>{nf.format(result.low)}〜{nf.format(result.high)}時間</strong></div>
              <div><span>ESTIMATE</span><p>時間価値の目安</p><strong>{yen(result.valueLow)}〜{yen(result.valueHigh)}</strong></div>
            </div>
            <div className="ws-decision"><div><p className="ws-kicker">RECOMMENDATION</p><h2>{result.title}</h2><p>{result.body}</p></div><ol>{result.plan.map(item => <li key={item}>{item}</li>)}</ol></div>
            <p className="ws-note">解放時間は実装適性に応じた保守的な試算幅です。時間価値は利益や現金削減を意味しません。実装判断には実データでの計測が必要です。</p>
            <div className="ws-actions"><button type="button" className="ws-secondary" onClick={copy}>{copied ? '結果をコピーしました' : '結果をコピー'}</button><a className="ws-primary" href="#contact">実データで相談する</a><button type="button" className="ws-text-button" onClick={() => start(true)}>もう一度診断する</button></div>
          </article>
        )}
      </div>
    </section>
  );
}
