import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import ApiErrorCard from './ApiErrorCard';
import EmptyState from './EmptyState';
import DelegateToAgentTeamBanner from './DelegateToAgentTeamBanner';
import type { DecisionMemo, DecisionInput } from '../lib/decisionMemo';
import { sortRisksByPriority } from '../lib/riskPriority';
import {
  generateDecisionMemo,
  saveDecision,
  decisionToMarkdown,
  loadDecisions,
  extractDecisionFields,
} from '../lib/decisionMemo';

interface Props {
  persona: Persona;
  settings: AppSettings;
  knowledge: KnowledgeItem[];
  onClose: () => void;
  onSaveAsKnowledge: (title: string, content: string) => void;
}

type Phase = 'speak' | 'result' | 'history';
type Step = 'idle' | 'extracting' | 'analyzing';

export default function DecisionMemoModal({ persona, settings, knowledge, onClose, onSaveAsKnowledge }: Props) {
  const [phase, setPhase] = useState<Phase>('speak');
  const [rawText, setRawText] = useState('');
  const [memo, setMemo] = useState<DecisionMemo | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DecisionMemo[]>(loadDecisions);

  const handleDecide = useCallback(async () => {
    if (!rawText.trim()) {
      setError('迷ってる内容を書いてください');
      return;
    }
    setError(null);
    setStep('extracting');
    try {
      const fields = await extractDecisionFields(settings, rawText, persona);
      if (!fields.question) {
        throw new Error('決めたい質問が読み取れませんでした。もう少し具体的に書いてみてください。');
      }
      setStep('analyzing');
      const input: DecisionInput = {
        question: fields.question,
        context: fields.context || undefined,
        options: fields.options.length ? fields.options : undefined,
        criteria: fields.criteria.length ? fields.criteria : undefined,
        timeHorizon: fields.timeHorizon || undefined,
        riskTolerance: fields.riskTolerance,
      };
      const result = await generateDecisionMemo(settings, persona, input, knowledge);
      saveDecision(result);
      setMemo(result);
      setHistory(loadDecisions());
      setPhase('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStep('idle');
    }
  }, [rawText, settings, persona, knowledge]);

  const handleSaveToKnowledge = useCallback(() => {
    if (!memo) return;
    onSaveAsKnowledge(`💭 ${memo.question.slice(0, 30)}`, decisionToMarkdown(memo));
    onClose();
  }, [memo, onSaveAsKnowledge, onClose]);

  const handleDownload = useCallback(() => {
    if (!memo) return;
    const md = decisionToMarkdown(memo);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [memo]);

  const handleReset = useCallback(() => {
    setRawText('');
    setMemo(null);
    setError(null);
    setPhase('speak');
  }, []);

  const isBusy = step !== 'idle';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-[1400px] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg, #15151c)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 1.5rem)' }}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ width: 44, height: 44, background: persona.accentColorLight, color: persona.accentColor }}
            >💭</div>
            <div className="min-w-0">
              <p className="text-fg text-lg font-semibold leading-tight truncate">意思決定メモ AI</p>
              <p className="text-fg-muted text-xs">話すだけで判断を構造化</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && phase !== 'history' && (
              <button
                onClick={() => setPhase('history')}
                className="text-xs rounded transition-all bg-surface-3 border-edge border text-fg-muted hover:text-fg"
                style={{ minHeight: 36, padding: '0 12px' }}
              >📚 履歴 ({history.length})</button>
            )}
            <button
              onClick={onClose}
              aria-label="閉じる"
              className="rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
              style={{ width: 44, height: 44 }}
            >×</button>
          </div>
        </div>

        <DelegateToAgentTeamBanner
          taskTitle="この意思決定の各案を CXO 視点でも検討"
          suggestedCxos={['CEO', 'CFO', 'CSO']}
          why="判断の偏りを防ぐため、戦略・財務・営業の 3 視点で別角度の評価を出します"
          expected="各 CXO からの賛否と根拠つきレビュー"
        />

        {/* Phase: Speak (1 textarea → 直接 result) */}
        {phase === 'speak' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div>
              <p className="text-fg text-base font-semibold mb-1">迷ってることを話してください</p>
              <p className="text-fg-muted text-xs leading-relaxed">
                背景・選択肢・気がかり、思いつくままで OK。AI が要素を読み取って、推奨を一気に出します。
              </p>
            </div>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              disabled={isBusy}
              placeholder={`迷っている判断を 1 行で書いてみてください (例: A 社の提案を受けるべきか)\n\n背景や選択肢を足すと、AI の精度が上がります。\n例) 新規事業に投資すべきか迷ってる。手元資金は 3000 万、半年で結果を出したい。\n候補は A 案 (SaaS) と B 案 (D2C)。A の方が伸び代はあるけど開発に時間がかかる。`}
              className="w-full text-base rounded-lg px-3 py-3 outline-none resize-y bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg leading-relaxed disabled:opacity-60"
              style={{ minHeight: 240, fontSize: 16 }}
              autoFocus
            />

            <AnimatePresence>
              {isBusy && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-lg p-3 flex items-center gap-3"
                  style={{ background: persona.accentColorLight, border: `1px solid ${persona.accentColor}40` }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: 18, height: 18,
                      border: `2px solid ${persona.accentColor}30`,
                      borderTopColor: persona.accentColor,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-fg text-sm font-semibold">
                      {step === 'extracting'
                        ? '① あなたの悩みを読んでます…'
                        : '② 賛成・反対・推奨 を組み立て中…'}
                    </p>
                    <p className="text-fg-muted text-xs">
                      {step === 'extracting'
                        ? '「決めたい質問・選択肢・評価軸」を AI が読み取り中。10 秒くらい。'
                        : 'ナレッジを参照しながら推奨案と確度 % を作成中。長くて 30 秒くらい。'}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isBusy && <ApiErrorCard error={error} onRetry={handleDecide} />}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={isBusy}
                className="rounded-lg text-sm text-fg-muted hover:text-fg disabled:opacity-50"
                style={{ minHeight: 44, padding: '0 16px' }}
              >キャンセル</button>
              <motion.button
                onClick={handleDecide}
                disabled={!rawText.trim() || isBusy}
                className="rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 44, padding: '0 20px' }}
                whileHover={!isBusy ? { scale: 1.02 } : {}}
                whileTap={!isBusy ? { scale: 0.98 } : {}}
              >
                {isBusy ? '🧠 思考中…' : '✨ 賛成・反対・推奨 を AI に出してもらう'}
              </motion.button>
            </div>
          </div>
        )}

        {/* Phase: Result */}
        {phase === 'result' && memo && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div>
              <p className="text-fg-muted text-xs tracking-wider uppercase mb-1">質問</p>
              <p className="text-fg text-xl font-bold leading-tight" style={{ wordBreak: 'break-word' }}>{memo.question}</p>
              {memo.context && <p className="text-fg-muted text-sm mt-1.5" style={{ wordBreak: 'break-word' }}>{memo.context}</p>}
            </div>

            <div
              className="rounded-2xl p-4"
              style={{
                background: `linear-gradient(135deg, ${persona.accentColor}25, var(--surface-3))`,
                border: `1px solid ${persona.accentColor}50`,
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-fg-muted text-xs tracking-widest uppercase">推奨</p>
                <p className="text-fg text-xs">確度 <span style={{ color: persona.accentColor }} className="font-bold text-base">{memo.confidence}</span>%</p>
              </div>
              <p className="text-fg text-xl font-semibold mb-2" style={{ wordBreak: 'break-word' }}>→ {memo.recommended}</p>
              <p className="text-fg/90 text-sm leading-relaxed whitespace-pre-wrap">{memo.rationale}</p>
              <div className="mt-2 pt-2 flex items-center gap-2 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-fg-muted">可逆性:</span>
                <span style={{ color: memo.reversibility === 'reversible' ? '#34d399' : memo.reversibility === 'irreversible' ? '#f87171' : '#c9a96e' }}>
                  {memo.reversibility === 'reversible' ? '✅ 可逆 (やり直せる)' : memo.reversibility === 'irreversible' ? '🔒 不可逆 (一度きり)' : '⚠ 部分的'}
                </span>
              </div>
            </div>

            {memo.options.length > 0 && (
              <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color: persona.accentColor }}>
                  📊 選択肢の比較
                </p>
                <div className="space-y-3">
                  {memo.options.map((o, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg"
                      style={{
                        background: o.name === memo.recommended ? `${persona.accentColor}18` : 'var(--surface)',
                        border: `1px solid ${o.name === memo.recommended ? persona.accentColor + '60' : 'var(--border)'}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <p className="text-fg text-base font-semibold" style={{ wordBreak: 'break-word' }}>
                          {o.name === memo.recommended && '⭐ '}
                          {o.name}
                        </p>
                        <p className="text-fg text-xl font-bold flex-shrink-0">{o.totalScore}<span className="text-fg-muted text-xs">/100</span></p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <p className="text-xs mb-0.5" style={{ color: '#34d399' }}>メリット</p>
                          <ul className="space-y-0.5">
                            {o.pros.map((p, j) => (
                              <li key={j} className="text-fg text-xs flex gap-1.5"><span style={{ color: '#34d399' }}>+</span><span style={{ wordBreak: 'break-word' }}>{p}</span></li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs mb-0.5" style={{ color: '#f87171' }}>デメリット</p>
                          <ul className="space-y-0.5">
                            {o.cons.map((c, j) => (
                              <li key={j} className="text-fg text-xs flex gap-1.5"><span style={{ color: '#f87171' }}>−</span><span style={{ wordBreak: 'break-word' }}>{c}</span></li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {o.scoreByCriteria.length > 0 && (
                        <div className="space-y-1 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                          {o.scoreByCriteria.map((s, j) => (
                            <div key={j} className="flex items-center gap-2">
                              <span className="text-fg-muted text-xs flex-shrink-0" style={{ width: 80 }}>{s.criterion}</span>
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                <div className="h-full" style={{ width: `${s.score * 10}%`, background: persona.accentColor }} />
                              </div>
                              <span className="text-fg-muted text-xs w-8 text-right">{s.score}/10</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {memo.risks.length > 0 && (
              <Section title="⚠ リスク" color="#f87171" items={memo.risks} />
            )}
            {memo.nextSteps.length > 0 && (
              <Section title="🎯 次のステップ" color="#34d399" items={memo.nextSteps} />
            )}
            {memo.questionsToReflect.length > 0 && (
              <Section title="🤔 決定前に考えるべき質問" color="#a78bfa" items={memo.questionsToReflect} />
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={handleReset}
                className="text-fg-muted hover:text-fg text-sm rounded"
                style={{ minHeight: 44, padding: '0 12px' }}
              >← もう一度話す</button>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="rounded-lg text-sm bg-surface-3 border-edge border text-fg hover:bg-surface"
                  style={{ minHeight: 44, padding: '0 16px' }}
                >📥 .md</button>
                <button
                  onClick={handleSaveToKnowledge}
                  className="rounded-lg text-sm font-semibold"
                  style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 44, padding: '0 16px' }}
                >📚 ナレッジに保存</button>
              </div>
            </div>
          </div>
        )}

        {/* Phase: History */}
        {phase === 'history' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-2">
            <p className="text-fg-muted text-xs tracking-wider uppercase mb-2">過去の意思決定</p>
            {history.length === 0 ? (
              <EmptyState
                icon="🧭"
                title="まだ意思決定の履歴はありません"
                description={'迷っていることを声に出すだけで、AI が「賛成・反対・推奨」に分けて整理。\n「単価をいくらにするか」「来週どっちを出すか」など、決め切れない 1 つをどうぞ。'}
                ctaLabel="最初の意思決定を作る"
                onCta={() => setPhase('speak')}
                accent={persona.accentColor}
                preview="質問 → 賛成 3 / 反対 2 / 推奨 1 つに自動分解 + 確度 %"
                showSample={false}
              />
            ) : (
              history.map((m, i) => (
                <button
                  key={i}
                  onClick={() => { setMemo(m); setPhase('result'); }}
                  className="w-full text-left p-3 rounded-xl transition-all hover:bg-surface"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-fg text-sm font-semibold truncate">{m.question}</p>
                      <p className="text-fg-muted text-xs mt-0.5 truncate">→ {m.recommended} (確度 {m.confidence}%)</p>
                    </div>
                    <p className="text-fg-muted text-xs flex-shrink-0">
                      {new Date(m.generatedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </button>
              ))
            )}
            <button
              onClick={handleReset}
              className="w-full mt-3 rounded-lg text-sm font-semibold"
              style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 48 }}
            >＋ 新しい意思決定を AI に手伝ってもらう</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Section({ title, color, items }: { title: string; color: string; items: string[] }) {
  // タイトルに「リスク」を含む場合は重要度順表示 (オーナー指示 2026-06-03)
  const isRisks = /リスク|risk/i.test(title);
  if (isRisks) {
    const sorted = sortRisksByPriority(items);
    return (
      <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
        <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color }}>{title} (重要度順)</p>
        <ul className="space-y-2">
          {sorted.map((r, i) => (
            <li
              key={i}
              className="text-fg text-sm flex items-start gap-2 leading-relaxed rounded-md px-2 py-1.5"
              style={{ background: `${r.color}12`, borderLeft: `3px solid ${r.color}` }}
            >
              <span
                className="flex-shrink-0 rounded font-bold tracking-wider"
                style={{
                  background: r.color, color: '#fff',
                  fontSize: 9, padding: '2px 6px', lineHeight: 1.3,
                  minWidth: 40, textAlign: 'center',
                }}
              >{r.label}</span>
              <span className="flex-1" style={{ wordBreak: 'break-word' }}>{r.text}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
      <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color }}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="text-fg text-sm flex gap-2 leading-relaxed">
            <span style={{ color }}>·</span>
            <span style={{ wordBreak: 'break-word' }}>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
