import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import type { NegotiationScene, NegoTurn, NegoEvaluation } from '../lib/negotiationCoach';
import { NEGO_PRESETS, counterpartReply, evaluateNegotiation } from '../lib/negotiationCoach';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

type Phase = 'select' | 'roleplay' | 'evaluation';

export default function NegotiationCoachModal({ persona, settings, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('select');
  const [scene, setScene] = useState<NegotiationScene | null>(null);
  const [history, setHistory] = useState<NegoTurn[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<NegoEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customScenario, setCustomScenario] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [customStance, setCustomStance] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isThinking]);

  const startScene = useCallback(async (s: NegotiationScene) => {
    setScene(s);
    setHistory([]);
    setEvaluation(null);
    setPhase('roleplay');
    setIsThinking(true);
    setError(null);
    try {
      const reply = await counterpartReply(settings, persona, s, []);
      setHistory([{
        role: 'counterpart',
        content: reply,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsThinking(false);
    }
  }, [settings, persona]);

  const send = useCallback(async () => {
    if (!input.trim() || !scene || isThinking) return;
    const userMsg: NegoTurn = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };
    const next = [...history, userMsg];
    setHistory(next);
    setInput('');
    setIsThinking(true);
    setError(null);
    try {
      const reply = await counterpartReply(settings, persona, scene, next);
      setHistory(prev => [...prev, {
        role: 'counterpart',
        content: reply,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsThinking(false);
    }
  }, [input, scene, isThinking, history, settings, persona]);

  const handleEvaluate = useCallback(async () => {
    if (!scene || history.length < 2) return;
    setIsEvaluating(true);
    setError(null);
    try {
      const ev = await evaluateNegotiation(settings, scene, history);
      setEvaluation(ev);
      setPhase('evaluation');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsEvaluating(false);
    }
  }, [scene, history, settings]);

  const handleCustomStart = useCallback(() => {
    if (!customScenario.trim() || !customRole.trim() || !customGoal.trim()) {
      setError('シナリオ・相手・ゴールは必須です');
      return;
    }
    startScene({
      scenario: customScenario,
      counterpartRole: customRole,
      counterpartStance: customStance || '一般的なビジネス相手として振る舞う',
      userGoal: customGoal,
    });
  }, [customScenario, customRole, customStance, customGoal, startScene]);

  const reset = () => {
    setPhase('select');
    setScene(null);
    setHistory([]);
    setEvaluation(null);
    setError(null);
  };

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
            >🤝</div>
            <div className="min-w-0">
              <p className="text-fg text-lg font-semibold leading-tight truncate">
                AI 交渉コーチ
              </p>
              <p className="text-fg-muted text-xs truncate">
                {phase === 'select' && 'シナリオを選んでロールプレイ'}
                {phase === 'roleplay' && scene?.scenario}
                {phase === 'evaluation' && '評価レポート'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
          >×</button>
        </div>

        {/* Phase: Select */}
        {phase === 'select' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-fg-muted text-sm">
              現実的な相手役の AI と本番さながらに練習。終わったら詳細フィードバック。
            </p>

            {/* プリセット */}
            <div>
              <p className="text-fg-muted text-xs tracking-wider uppercase mb-2">プリセット・シナリオ</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {NEGO_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => startScene(p.scene)}
                    className="text-left p-3 rounded-xl transition-all"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-2xl flex-shrink-0">{p.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-fg text-base font-semibold leading-tight">{p.title}</p>
                        <p className="text-fg-muted text-xs mt-1 line-clamp-2">{p.scene.scenario}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* カスタム */}
            <div>
              <button
                onClick={() => setShowCustom(v => !v)}
                className="text-fg-muted hover:text-fg text-sm flex items-center gap-1"
              >
                {showCustom ? '▾' : '▸'} カスタムシナリオで開始
              </button>
              {showCustom && (
                <div
                  className="mt-2 p-3 rounded-xl space-y-2"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                >
                  <input
                    type="text" value={customScenario} onChange={e => setCustomScenario(e.target.value)}
                    placeholder="シナリオ (例: M&A 価格交渉)"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                  />
                  <input
                    type="text" value={customRole} onChange={e => setCustomRole(e.target.value)}
                    placeholder="相手の役割 (例: 買収先のCEO)"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                  />
                  <input
                    type="text" value={customStance} onChange={e => setCustomStance(e.target.value)}
                    placeholder="相手のスタンス (例: 高値を狙いたい)"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                  />
                  <input
                    type="text" value={customGoal} onChange={e => setCustomGoal(e.target.value)}
                    placeholder="あなたのゴール (例: 50億円以下で合意)"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none bg-surface-3 border-edge border placeholder:text-fg-subtle text-fg"
                  />
                  <button
                    onClick={handleCustomStart}
                    className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
                    style={{ background: persona.accentColor, color: '#0a0a0f' }}
                  >▶ ロールプレイ開始</button>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Phase: Roleplay */}
        {phase === 'roleplay' && scene && (
          <>
            {/* Scene info banner */}
            <div
              className="px-5 py-2"
              style={{ background: persona.accentColorLight, borderBottom: '1px solid var(--border)' }}
            >
              <p className="text-fg text-xs">
                <span className="font-semibold" style={{ color: persona.accentColor }}>あなたのゴール:</span> {scene.userGoal}
              </p>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <AnimatePresence initial={false}>
                {history.map((t, i) => (
                  <motion.div
                    key={i}
                    className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  >
                    <div
                      className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed"
                      style={t.role === 'user' ? {
                        background: persona.accentColorLight,
                        color: persona.accentColor,
                        border: `1px solid ${persona.accentColor}40`,
                      } : {
                        background: 'var(--surface-3)',
                        color: 'var(--fg)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <p className="text-[10px] mb-1 opacity-70">
                        {t.role === 'user' ? 'あなた' : scene.counterpartRole}
                      </p>
                      <p className="whitespace-pre-wrap">{t.content}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isThinking && (
                <motion.div className="flex justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div
                    className="px-4 py-2.5 rounded-xl"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i} className="w-1.5 h-1.5 rounded-full"
                          style={{ background: persona.accentColor }}
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div
                className="flex items-end gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
              >
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="あなたの返答を入力 (Enter送信)"
                  className="flex-1 bg-transparent text-sm outline-none resize-none text-fg placeholder:text-fg-subtle leading-relaxed"
                  rows={2}
                  disabled={isThinking}
                  style={{ minHeight: '36px', maxHeight: '120px' }}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || isThinking}
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                  style={{ background: persona.accentColor, color: '#0a0a0f' }}
                >→</button>
              </div>
              <div className="flex items-center justify-between mt-2 gap-2">
                <button onClick={reset} className="text-fg-muted hover:text-fg text-xs">← シナリオに戻る</button>
                <button
                  onClick={handleEvaluate}
                  disabled={history.length < 2 || isEvaluating}
                  className="text-xs px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'var(--surface-3)', border: `1px solid ${persona.accentColor}50`, color: persona.accentColor }}
                >
                  {isEvaluating ? '🧠 評価中…' : '🎯 評価を見る'}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-xs" style={{ color: '#f87171' }}>{error}</p>
              )}
            </div>
          </>
        )}

        {/* Phase: Evaluation */}
        {phase === 'evaluation' && evaluation && scene && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {/* Score */}
            <div
              className="rounded-2xl p-5 text-center"
              style={{
                background: `linear-gradient(135deg, ${persona.accentColor}25, var(--surface-3))`,
                border: `1px solid ${persona.accentColor}50`,
              }}
            >
              <p className="text-fg-muted text-xs tracking-widest uppercase mb-1">総合スコア</p>
              <p className="text-fg text-6xl font-bold leading-tight">{evaluation.overall}</p>
              <p className="text-fg-muted text-sm">/ 100</p>
              <div
                className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: outcomeColor(evaluation.outcome) + '20',
                  color: outcomeColor(evaluation.outcome),
                  border: `1px solid ${outcomeColor(evaluation.outcome)}40`,
                }}
              >{outcomeLabel(evaluation.outcome)}</div>
            </div>

            {evaluation.strengths.length > 0 && (
              <Section title="✅ 強み" color="#34d399" items={evaluation.strengths} />
            )}
            {evaluation.improvements.length > 0 && (
              <Section title="📌 改善点" color="#c9a96e" items={evaluation.improvements} />
            )}

            {evaluation.specificFeedback.length > 0 && (
              <div className="rounded-xl p-3.5" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <p className="text-xs tracking-widest uppercase font-semibold mb-2" style={{ color: persona.accentColor }}>
                  💬 具体的フィードバック
                </p>
                <div className="space-y-3">
                  {evaluation.specificFeedback.map((f, i) => (
                    <div key={i}>
                      <p className="text-fg-muted text-xs mb-0.5">あなたの発言</p>
                      <p
                        className="text-fg text-sm italic px-3 py-2 rounded-lg"
                        style={{ background: 'var(--surface)', borderLeft: `2px solid ${persona.accentColor}` }}
                      >「{f.quote}」</p>
                      <p className="text-fg-muted text-xs mt-1.5 mb-0.5">より良かった言い方</p>
                      <p className="text-fg text-sm" style={{ color: '#34d399' }}>→ {f.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {evaluation.alternativeApproaches.length > 0 && (
              <Section title="🔀 代替アプローチ" color="#a78bfa" items={evaluation.alternativeApproaches} />
            )}

            <div className="flex justify-center gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setPhase('roleplay')}
                className="px-4 py-2 rounded-lg text-sm bg-surface-3 border-edge border text-fg hover:bg-surface"
              >← 続きを練習</button>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}
              >🔄 別のシナリオ</button>
            </div>
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

function outcomeColor(o: NegoEvaluation['outcome']): string {
  return o === 'win' ? '#34d399' : o === 'partial' ? '#c9a96e' : o === 'loss' ? '#f87171' : '#a78bfa';
}
function outcomeLabel(o: NegoEvaluation['outcome']): string {
  return o === 'win' ? '🏆 達成' : o === 'partial' ? '⚖ 一部達成' : o === 'loss' ? '✗ 未達成' : '⏳ 進行中';
}
