import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import { routeVoiceMemo, type VoiceRouteItem } from '../lib/voiceRouter';
import { usePersonas } from '../hooks/usePersonas';
import { useCRM } from '../hooks/useCRM';
import { useExpenses } from '../hooks/useExpenses';
import type { CRMDeal } from '../types/crm';
import ApiErrorCard from './ApiErrorCard';

// ─── Types ───────────────────────────────────────────────────

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
  onAddKnowledgeNote: (title: string, content: string) => KnowledgeItem;
}

interface RouteItemCheck extends VoiceRouteItem {
  checked: boolean;
}

type Phase = 'idle' | 'recording' | 'preview' | 'routing' | 'results' | 'saving' | 'done';

// ─── localStorage for ideas ───────────────────────────────────

const IDEAS_KEY = 'core_voice_ideas';

interface VoiceIdea {
  id: string;
  title: string;
  summary: string;
  transcript: string;
  createdAt: string;
}

function saveIdea(idea: VoiceIdea) {
  try {
    const raw = localStorage.getItem(IDEAS_KEY);
    const arr: VoiceIdea[] = raw ? JSON.parse(raw) : [];
    arr.unshift(idea);
    localStorage.setItem(IDEAS_KEY, JSON.stringify(arr));
  } catch { /* quota */ }
}

// ─── Waveform animation ───────────────────────────────────────

function WaveformBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-0.5 h-8">
      {Array.from({ length: 16 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full"
          style={{ background: 'var(--prism, #c9a96e)' }}
          animate={active ? {
            height: ['4px', `${12 + Math.random() * 20}px`, '4px'],
          } : { height: '4px' }}
          transition={active ? {
            duration: 0.5 + (i % 3) * 0.15,
            repeat: Infinity,
            delay: i * 0.05,
            ease: 'easeInOut',
          } : { duration: 0.2 }}
        />
      ))}
    </div>
  );
}

// ─── Time format ──────────────────────────────────────────────

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// ─── Kind label helpers ───────────────────────────────────────

const KIND_META: Record<string, { emoji: string; label: string; color: string }> = {
  task:      { emoji: '✅', label: 'タスク',    color: '#4ADE80' },
  knowledge: { emoji: '📚', label: 'ナレッジ',  color: '#5BA8FF' },
  crm:       { emoji: '🤝', label: 'CRM案件',   color: '#FFA94D' },
  expense:   { emoji: '💳', label: '経費',      color: '#C084FC' },
  idea:      { emoji: '💡', label: 'アイデア',  color: '#FACC15' },
};

// ─── Main Component ───────────────────────────────────────────

export default function VoiceCaptureStudio({ persona, settings, onClose, onAddKnowledgeNote }: Props) {
  const { addTask } = usePersonas();
  const crm = useCRM();
  const expenses = useExpenses();

  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [items, setItems] = useState<RouteItemCheck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [saveMsg, setSaveMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<any>(null);
  const finalRef = useRef('');
  const accumulatedRef = useRef('');     // 自動再開をまたいで貯めた確定テキスト
  const manualStopRef = useRef(false);   // ユーザーが意図的に止めたか
  const lastLenRef = useRef(0);          // 直近の再開時点での文字数
  const emptyRestartsRef = useRef(0);    // 無音のまま再開した連続回数
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const personaDeals = crm.getForPersona(persona.id);

  // ─── Speech Recognition ───────────────────────────────────
  // Chrome は無音が続くと continuous=true でも勝手に録音を終了する。
  // その場合は静かに自動再開し、ユーザーには「止まった」と感じさせない。

  const buildRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let fin = '';
      let intr = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else intr += r[0].transcript;
      }
      finalRef.current = accumulatedRef.current + fin;
      setTranscript(finalRef.current);
      setInterim(intr);
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        manualStopRef.current = true;
        setError('マイクの使用が許可されていません。ブラウザのマイク設定で「許可」にしてから、もう一度お試しください。');
      } else if (e.error === 'audio-capture') {
        manualStopRef.current = true;
        setError('マイクが見つかりませんでした。マイクが接続されているか確認して、もう一度お試しください。');
      }
      // no-speech / aborted / network → onend が拾って自動で録音を続けます
    };

    rec.onend = () => {
      if (!manualStopRef.current) {
        const grew = finalRef.current.length > lastLenRef.current;
        lastLenRef.current = finalRef.current.length;
        emptyRestartsRef.current = grew ? 0 : emptyRestartsRef.current + 1;
        accumulatedRef.current = finalRef.current;
        setInterim('');
        // 無音が続いた（4周）ら録音を終える。それ以外は静かに再開
        if (emptyRestartsRef.current < 4) {
          try {
            const next = buildRecognition();
            recognitionRef.current = next;
            next.start();
            return;
          } catch { /* 再開できなければ下で preview へ */ }
        }
      }
      setPhase(p => p === 'recording' ? 'preview' : p);
      setInterim('');
    };

    return rec;
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('このブラウザは音声認識に対応していません。Chrome をお試しください。');
      return;
    }
    finalRef.current = '';
    accumulatedRef.current = '';
    manualStopRef.current = false;
    lastLenRef.current = 0;
    emptyRestartsRef.current = 0;
    setTranscript('');
    setInterim('');
    setError(null);
    setElapsed(0);

    try {
      const rec = buildRecognition();
      recognitionRef.current = rec;
      rec.start();
      setPhase('recording');
    } catch {
      setError('録音を開始できませんでした。もう一度お試しください。');
    }
  }, [buildRecognition]);

  const stopRecording = useCallback(() => {
    manualStopRef.current = true;
    recognitionRef.current?.stop();
    setPhase('preview');
    setInterim('');
  }, []);

  // 経過時間タイマー
  useEffect(() => {
    if (phase === 'recording') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ─── Routing ──────────────────────────────────────────────

  const handleRoute = useCallback(async () => {
    const text = finalRef.current || transcript;
    if (!text.trim()) { setError('音声が認識されませんでした。'); return; }
    setPhase('routing');
    setError(null);
    try {
      const result = await routeVoiceMemo(text, settings);
      const sorted = [...result.categories]
        .sort((a, b) => b.confidence - a.confidence)
        .map(c => ({ ...c, checked: c.confidence >= 0.6 }));
      setItems(sorted);
      setPhase('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : '分類に失敗しました');
      setPhase('preview');
    }
  }, [transcript, settings]);

  // ─── Saving ───────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const checked = items.filter(i => i.checked);
    if (checked.length === 0) { onClose(); return; }
    setPhase('saving');

    const today = new Date().toISOString().slice(0, 10);
    const fullText = finalRef.current || transcript;
    let saved = 0;

    for (const item of checked) {
      try {
        switch (item.kind) {
          case 'task': {
            const det = (item.details ?? {}) as any;
            addTask(persona.id, {
              title: item.title,
              priority: det.priority ?? 'mid',
              due: det.due ?? today,
              done: false,
            });
            saved++;
            break;
          }
          case 'knowledge': {
            const content = `${item.summary}\n\n---\n音声メモ原文:\n${fullText}`;
            onAddKnowledgeNote(item.title, content);
            saved++;
            break;
          }
          case 'crm': {
            const det = (item.details ?? {}) as any;
            if (selectedDealId) {
              crm.addActivity(selectedDealId, {
                date: today,
                type: 'note',
                summary: `[音声メモ] ${item.summary}`,
              });
            } else {
              crm.createDeal(persona.id, {
                title: item.title,
                description: item.summary,
                contact: det.contact ? { id: '', name: det.contact } : undefined,
                amount: det.amount || undefined,
                stage: det.stage || 'lead',
              });
            }
            saved++;
            break;
          }
          case 'expense': {
            const det = (item.details ?? {}) as any;
            const amountIncl = det.amountIncl || 0;
            const taxRate = 10 as const;
            expenses.add({
              personaId: persona.id,
              date: today,
              vendor: det.vendor || item.title,
              category: det.category || 'その他',
              description: item.summary,
              amountIncl,
              taxRate,
              amountExcl: Math.round(amountIncl / (1 + taxRate / 100)),
              taxAmount: amountIncl - Math.round(amountIncl / (1 + taxRate / 100)),
              source: 'manual',
            });
            saved++;
            break;
          }
          case 'idea': {
            saveIdea({
              id: `idea-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              title: item.title,
              summary: item.summary,
              transcript: fullText,
              createdAt: new Date().toISOString(),
            });
            saved++;
            break;
          }
        }
      } catch { /* continue */ }
    }

    setSaveMsg(`${saved}件を保存しました`);
    setPhase('done');
    setTimeout(onClose, 1800);
  }, [items, transcript, selectedDealId, persona.id, addTask, onAddKnowledgeNote, crm, expenses, onClose]);

  // ─── Render ───────────────────────────────────────────────

  const hasCrmItem = items.some(i => i.checked && i.kind === 'crm');

  return (
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '560px' }}
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      >
        {/* Header */}
        <div className="cp-modal-header">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎤</span>
            <div>
              <p className="text-fg font-semibold text-sm">音声メモ</p>
              <p className="text-fg-muted text-xs">AI が自動振り分け</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-fg text-lg leading-none transition-colors"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="cp-modal-body cp-stack" style={{ gap: '16px' }}>

          {/* ─── Idle / Recording ─── */}
          {(phase === 'idle' || phase === 'recording') && (
            <div className="flex flex-col items-center gap-6 py-4">
              <WaveformBars active={phase === 'recording'} />

              {phase === 'recording' ? (
                <>
                  <div className="flex items-center gap-2">
                    <motion.span
                      className="w-2 h-2 rounded-full"
                      style={{ background: '#f87171' }}
                      animate={{ opacity: [1, 0.25, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                    <span className="text-fg text-sm font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTime(elapsed)}
                    </span>
                    <span className="text-fg-subtle text-xs">録音中</span>
                  </div>
                  <div className="w-full min-h-[80px] rounded-xl p-3 text-sm"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                    <span className="text-fg">{transcript}</span>
                    {interim && <span className="text-fg-muted italic"> {interim}</span>}
                    {!transcript && !interim && (
                      <span className="text-fg-subtle">聞き取り中…</span>
                    )}
                  </div>
                  <motion.button
                    onClick={stopRecording}
                    className="px-8 py-3 rounded-xl font-semibold text-sm"
                    style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}
                    whileTap={{ scale: 0.97 }}
                  >
                    ⏹ 録音停止
                  </motion.button>
                  <p className="text-fg-subtle text-xs text-center leading-relaxed">
                    少し黙っても大丈夫。録音は止まりません。<br />
                    話し終わったら ⏹ を押してください。
                  </p>
                </>
              ) : (
                <motion.button
                  onClick={startRecording}
                  className="px-8 py-4 rounded-2xl font-semibold text-base flex items-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${persona.accentColor}30, ${persona.accentColor}15)`,
                    border: `1px solid ${persona.accentColor}60`,
                    color: persona.accentColor,
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  🎙 録音開始
                </motion.button>
              )}

              <ApiErrorCard error={error} onRetry={startRecording} variant="auto" />
            </div>
          )}

          {/* ─── Preview ─── */}
          {phase === 'preview' && (
            <div className="flex flex-col gap-4">
              {transcript.trim() ? (
                <div>
                  <p className="text-fg-muted text-xs mb-2">認識結果</p>
                  <div className="w-full min-h-[100px] rounded-xl p-3 text-sm text-fg"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                    {transcript}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-5 text-center"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <div className="text-3xl mb-2">🤫</div>
                  <p className="text-fg text-sm font-medium mb-1.5">声が聞き取れませんでした</p>
                  <p className="text-fg-muted text-xs leading-relaxed">
                    マイクに少し近づいて、もう一度ゆっくり話してみてください。<br />
                    静かな場所だと、より正確に聞き取れます。
                  </p>
                </div>
              )}
              <ApiErrorCard error={error} onRetry={handleRoute} variant="auto" />
              <div className="flex gap-2">
                <button
                  onClick={startRecording}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  style={transcript.trim()
                    ? { background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }
                    : { background: persona.accentColor, color: '#1F1D26' }}
                >
                  {transcript.trim() ? '再録音' : '🎙 もう一度話す'}
                </button>
                {transcript.trim() && (
                  <motion.button
                    onClick={handleRoute}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: persona.accentColor, color: '#1F1D26' }}
                    whileTap={{ scale: 0.97 }}
                  >
                    🤖 AI 振り分け
                  </motion.button>
                )}
              </div>
            </div>
          )}

          {/* ─── Routing (loading) ─── */}
          {phase === 'routing' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <motion.div
                className="text-4xl"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                🤖
              </motion.div>
              <p className="text-fg-muted text-sm">AI が振り分け中…</p>
            </div>
          )}

          {/* ─── Results ─── */}
          {phase === 'results' && (
            <div className="flex flex-col gap-4">
              <p className="text-fg-muted text-xs">振り分け候補 (チェックして保存)</p>

              <div className="space-y-2">
                {items.map((item, idx) => {
                  const meta = KIND_META[item.kind] ?? { emoji: '📌', label: item.kind, color: '#9088A8' };
                  return (
                    <motion.div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: item.checked ? `${meta.color}12` : 'var(--surface-3)',
                        border: `1px solid ${item.checked ? meta.color + '40' : 'var(--border)'}`,
                      }}
                      onClick={() => setItems(prev => prev.map((p, i) => i === idx ? { ...p, checked: !p.checked } : p))}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}
                    >
                      <div
                        className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center mt-0.5 border transition-all"
                        style={{
                          borderColor: item.checked ? meta.color : 'var(--border)',
                          background: item.checked ? meta.color + '30' : 'transparent',
                        }}
                      >
                        {item.checked && <span style={{ color: meta.color, fontSize: '12px' }}>✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm">{meta.emoji}</span>
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded"
                            style={{ background: meta.color + '20', color: meta.color }}>
                            {meta.label}
                          </span>
                          <span className="text-fg text-sm font-medium truncate">{item.title}</span>
                        </div>
                        <p className="text-fg-muted text-xs mt-0.5 leading-relaxed">{item.summary}</p>
                        <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)', width: '80px' }}>
                          <div className="h-full rounded-full" style={{ width: `${item.confidence * 100}%`, background: meta.color }} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* CRM deal selector */}
              {hasCrmItem && personaDeals.length > 0 && (
                <div>
                  <p className="text-fg-muted text-xs mb-1.5">関連案件 (任意)</p>
                  <select
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    value={selectedDealId}
                    onChange={e => setSelectedDealId(e.target.value)}
                  >
                    <option value="">── 新規案件として登録 ──</option>
                    {personaDeals.map((d: CRMDeal) => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setPhase('preview')}
                  className="px-4 py-2.5 rounded-xl text-sm transition-colors"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
                >
                  戻る
                </button>
                <motion.button
                  onClick={handleSave}
                  disabled={items.filter(i => i.checked).length === 0}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: persona.accentColor, color: '#1F1D26' }}
                  whileTap={{ scale: 0.97 }}
                >
                  💾 保存 ({items.filter(i => i.checked).length}件)
                </motion.button>
              </div>
            </div>
          )}

          {/* ─── Saving / Done ─── */}
          {(phase === 'saving' || phase === 'done') && (
            <div className="flex flex-col items-center gap-4 py-8">
              <motion.div
                className="text-4xl"
                animate={phase === 'saving' ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                transition={{ duration: 0.6, repeat: phase === 'saving' ? Infinity : 0 }}
              >
                {phase === 'done' ? '✅' : '💾'}
              </motion.div>
              <p className="text-fg text-sm font-medium">
                {phase === 'done' ? saveMsg : '保存中…'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
