import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import type { DecisionMemo, DecisionInput } from '../lib/decisionMemo';
import { generateDecisionMemo, saveDecision, decisionToMarkdown, loadDecisions } from '../lib/decisionMemo';

interface Props {
  persona: Persona;
  settings: AppSettings;
  knowledge: KnowledgeItem[];
  onClose: () => void;
  onSaveAsKnowledge: (title: string, content: string) => void;
}

type Phase = 'input' | 'result' | 'history';

export default function DecisionMemoModal({ persona, settings, knowledge, onClose, onSaveAsKnowledge }: Props) {
  const [phase, setPhase] = useState<Phase>('input');
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [criteriaText, setCriteriaText] = useState('');
  const [timeHorizon, setTimeHorizon] = useState('');
  const [risk, setRisk] = useState<'low' | 'mid' | 'high'>('mid');
  const [memo, setMemo] = useState<DecisionMemo | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DecisionMemo[]>(loadDecisions);

  const handleGenerate = useCallback(async () => {
    if (!question.trim()) {
      setError('質問を入力してください');
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const input: DecisionInput = {
        question: question.trim(),
        context: context || undefined,
        options: optionsText ? optionsText.split(/\n/).map(s => s.trim()).filter(Boolean) : undefined,
        criteria: criteriaText ? criteriaText.split(/[,、\n]/).map(s => s.trim()).filter(Boolean) : undefined,
        timeHorizon: timeHorizon || undefined,
        riskTolerance: risk,
      };
      const result = await generateDecisionMemo(settings, persona, input, knowledge);
      saveDecision(result);
      setMemo(result);
      setHistory(loadDecisions());
      setPhase('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  }, [question, context, optionsText, criteriaText, timeHorizon, risk, persona, settings, knowledge]);

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

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg, #15151c)', border: '1px solid var(--border)', maxHeight: 'calc(100dvh - 1.5rem)' }}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            >💭</div>
            <div className="min-w-0">
              <p className="text-fg text-lg font-semibold leading-tight truncate">意思決定メモ AI</p>
              <p className="text-fg-muted text-xs">構造化された判断フレームワーク</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && phase !== 'history' && (
              <button
                onClick={() => setPhase('history')}
                className="text-xs px-3 py-1.5 rounded transition-all bg-surface-3 border-edge border text-fg-muted hover:text-fg"
              >📚 履歴 ({history.length})</button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
            >×</button>
          </div>
        </div>

        {/* Phase: Input */}
        {phase === 'input' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div>
              <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">
                決めたい質問 <span style={{ color: persona.accentColor }}>*</span>
              </label>
              <input
                type="text" value={question} onChange={e => setQuestion(e.target.value)}
                placeholder="例: 新規事業に投資すべきか / 採用候補Aを採るか"
                className="w-full text-base rounded-lg px-3 py-2.5 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
              />
            </div>

            <div>
              <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">背景・制約 (任意)</label>
              <textarea
                value={context} onChange={e => setContext(e.target.value)}
                placeholder="現在の状況、予算、期限、チーム構成、制約条件など..."
                className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                style={{ minHeight: '80px' }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">選択肢 (1行ずつ・任意)</label>
                <textarea
                  value={optionsText} onChange={e => setOptionsText(e.target.value)}
                  placeholder={'A: 投資する\nB: 投資しない\nC: 半分だけ投資'}
                  className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                  style={{ minHeight: '70px' }}
                />
              </div>
              <div>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">評価軸 (任意)</label>
                <input
                  type="text" value={criteriaText} onChange={e => setCriteriaText(e.target.value)}
                  placeholder="例: ROI, リスク, 実行可能性"
                  className="w-full text-sm rounded-lg px-3 py-2 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                />
                <p className="text-fg-muted text-xs mt-1">空欄なら AI が人格に応じて補完</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">時間軸</label>
                <input
                  type="text" value={timeHorizon} onChange={e => setTimeHorizon(e.target.value)}
                  placeholder="例: 6ヶ月 / 1年 / 3年"
                  className="w-full text-sm rounded-lg px-3 py-2 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                />
              </div>
              <div>
                <label className="block text-fg-muted text-xs tracking-wider uppercase mb-1.5">リスク許容度</label>
                <div className="flex gap-1">
                  {([['low', '低'], ['mid', '中'], ['high', '高']] as const).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setRisk(id)}
                      className="flex-1 text-sm py-2 rounded-lg transition-all"
                      style={{
                        background: risk === id ? persona.accentColorLight : 'var(--surface-3)',
                        color: risk === id ? persona.accentColor : 'var(--fg-muted)',
                        border: `1px solid ${risk === id ? persona.accentColor + '50' : 'var(--border)'}`,
                      }}
                    >{label}</button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg">キャンセル</button>
              <motion.button
                onClick={handleGenerate}
                disabled={!question.trim() || isGenerating}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}
                whileHover={!isGenerating ? { scale: 1.02 } : {}}
                whileTap={!isGenerating ? { scale: 0.98 } : {}}
              >
                {isGenerating ? '🧠 解析中...' : '✨ 意思決定メモを生成'}
              </motion.button>
            </div>
          </div>
        )}

        {/* Phase: Result */}
        {phase === 'result' && memo && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div>
              <p className="text-fg-muted text-xs tracking-wider uppercase mb-1">質問</p>
              <p className="text-fg text-xl font-bold leading-tight">{memo.question}</p>
              {memo.context && <p className="text-fg-muted text-sm mt-1.5">{memo.context}</p>}
            </div>

            {/* 推奨ヒーロー */}
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
              <p className="text-fg text-xl font-semibold mb-2">→ {memo.recommended}</p>
              <p className="text-fg/90 text-sm leading-relaxed whitespace-pre-wrap">{memo.rationale}</p>
              <div className="mt-2 pt-2 flex items-center gap-2 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-fg-muted">可逆性:</span>
                <span style={{ color: memo.reversibility === 'reversible' ? '#34d399' : memo.reversibility === 'irreversible' ? '#f87171' : '#c9a96e' }}>
                  {memo.reversibility === 'reversible' ? '✅ 可逆 (やり直せる)' : memo.reversibility === 'irreversible' ? '🔒 不可逆 (一度きり)' : '⚠ 部分的'}
                </span>
              </div>
            </div>

            {/* 比較マトリックス */}
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
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-fg text-base font-semibold">
                          {o.name === memo.recommended && '⭐ '}
                          {o.name}
                        </p>
                        <p className="text-fg text-xl font-bold">{o.totalScore}<span className="text-fg-muted text-xs">/100</span></p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <p className="text-xs mb-0.5" style={{ color: '#34d399' }}>メリット</p>
                          <ul className="space-y-0.5">
                            {o.pros.map((p, j) => (
                              <li key={j} className="text-fg text-xs flex gap-1.5"><span style={{ color: '#34d399' }}>+</span><span>{p}</span></li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs mb-0.5" style={{ color: '#f87171' }}>デメリット</p>
                          <ul className="space-y-0.5">
                            {o.cons.map((c, j) => (
                              <li key={j} className="text-fg text-xs flex gap-1.5"><span style={{ color: '#f87171' }}>−</span><span>{c}</span></li>
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
                onClick={() => setPhase('input')}
                className="text-fg-muted hover:text-fg text-sm"
              >← 編集に戻る</button>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-lg text-sm bg-surface-3 border-edge border text-fg hover:bg-surface"
                >📥 .md</button>
                <button
                  onClick={handleSaveToKnowledge}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}
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
              <p className="text-fg-muted text-sm py-8 text-center">まだ履歴がありません</p>
            ) : (
              history.map((m, i) => (
                <button
                  key={i}
                  onClick={() => { setMemo(m); setPhase('result'); }}
                  className="w-full text-left p-3 rounded-xl transition-all"
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
              onClick={() => setPhase('input')}
              className="w-full mt-3 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: persona.accentColor, color: '#0a0a0f' }}
            >＋ 新しい意思決定を作成</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Section({ title, color, items }: { title: string; color: string; items: string[] }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
      <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color }}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="text-fg text-sm flex gap-2 leading-relaxed">
            <span style={{ color }}>·</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
