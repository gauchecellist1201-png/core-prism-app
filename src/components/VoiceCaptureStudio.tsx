import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import { routeVoiceMemo, type VoiceRouteItem, type VoiceCategory } from '../lib/voiceRouter';
import { usePersonas } from '../hooks/usePersonas';
import { useCRM } from '../hooks/useCRM';
import { useExpenses } from '../hooks/useExpenses';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import type { CRMDeal } from '../types/crm';
import ApiErrorCard from './ApiErrorCard';
import { StudioIntro } from './StudioIntro';
import StudioBackButton from './StudioBackButton';
import { notifyInApp } from '../lib/inAppNotify';

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

// ─── 未処理メモ (オフライン録音バッファ) ─────────────────────
// ネット切断中でも録音を続け、復帰後に AI 振り分けできるようにする

const PENDING_KEY = 'core_voice_pending_v1';
const MAX_PENDING = 30;

interface PendingMemo {
  id: string;
  transcript: string;
  createdAt: string;
  durationSec: number;
}

function loadPending(): PendingMemo[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as PendingMemo[]).slice(0, MAX_PENDING);
  } catch { return []; }
}

function savePending(arr: PendingMemo[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(arr.slice(0, MAX_PENDING))); } catch { /* quota */ }
}

function pushPending(memo: PendingMemo) {
  const arr = loadPending();
  arr.unshift(memo);
  savePending(arr);
}

function removePending(id: string) {
  const arr = loadPending().filter(m => m.id !== id);
  savePending(arr);
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

function fmtElapsedSince(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  return `${Math.floor(hr / 24)}日前`;
}

// ─── Kind label helpers ───────────────────────────────────────

const KIND_META: Record<string, { emoji: string; label: string; color: string }> = {
  task:      { emoji: '✅', label: 'タスク',    color: '#4ADE80' },
  knowledge: { emoji: '📚', label: 'ナレッジ',  color: '#5BA8FF' },
  crm:       { emoji: '🤝', label: 'CRM案件',   color: '#FFA94D' },
  expense:   { emoji: '💳', label: '経費',      color: '#C084FC' },
  idea:      { emoji: '💡', label: 'アイデア',  color: '#FACC15' },
};

const KIND_ORDER: VoiceCategory[] = ['task', 'knowledge', 'crm', 'expense', 'idea'];

// ─── Main Component ───────────────────────────────────────────

export default function VoiceCaptureStudio({ persona, settings, onClose, onAddKnowledgeNote }: Props) {
  const { addTask } = usePersonas();
  const crm = useCRM();
  const expenses = useExpenses();
  const queue = useAgentTaskQueue();

  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [items, setItems] = useState<RouteItemCheck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [saveMsg, setSaveMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState<PendingMemo[]>(loadPending);
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [processingPendingId, setProcessingPendingId] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const finalRef = useRef('');
  const accumulatedRef = useRef('');     // 自動再開をまたいで貯めた確定テキスト
  const manualStopRef = useRef(false);   // ユーザーが意図的に止めたか
  const lastLenRef = useRef(0);          // 直近の再開時点での文字数
  const emptyRestartsRef = useRef(0);    // 無音のまま再開した連続回数
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedAtStopRef = useRef(0);    // 録音停止時の長さ (pending 保存用)
  const chunkSavedAtRef = useRef(0);     // 直近で chunk 保存した時点 (long memory 対策)
  const chunkSavedLenRef = useRef(0);    // 直近 chunk 保存時の文字数

  const personaDeals = crm.getForPersona(persona.id);

  // ─── オンライン/オフライン検知 ─────────────────────────────
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

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

      // ─── chunk safety: 30 分超 or 2,000 字超で一度 pending に退避 ──
      // メモリ溢れ・ブラウザクラッシュで全部失うのを防ぐ
      const now = Date.now();
      const grew = finalRef.current.length - chunkSavedLenRef.current;
      const elapsedSinceLastSave = (now - chunkSavedAtRef.current) / 1000;
      if (grew > 2000 || elapsedSinceLastSave > 30 * 60) {
        chunkSavedAtRef.current = now;
        chunkSavedLenRef.current = finalRef.current.length;
        try {
          // 同一録音セッションは "session" で識別、再保存で上書き
          const sessionId = (recognitionRef.current as any)?._sessionId || `session-${now}`;
          (recognitionRef.current as any)._sessionId = sessionId;
          const arr = loadPending().filter(m => m.id !== sessionId);
          arr.unshift({
            id: sessionId,
            transcript: finalRef.current,
            createdAt: new Date(now - elapsed * 1000).toISOString(),
            durationSec: elapsed,
          });
          savePending(arr);
        } catch { /* quota - 無視 */ }
      }
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
  }, [elapsed]);

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
    chunkSavedAtRef.current = Date.now();
    chunkSavedLenRef.current = 0;
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
    elapsedAtStopRef.current = elapsed;
    recognitionRef.current?.stop();

    // chunk セッションの残骸を pending から取り除く (preview に出すので一旦消す)
    try {
      const sessionId = (recognitionRef.current as any)?._sessionId;
      if (sessionId) {
        const arr = loadPending().filter(m => m.id !== sessionId);
        savePending(arr);
        setPending(arr);
      }
    } catch { /* */ }

    setPhase('preview');
    setInterim('');
  }, [elapsed]);

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

  // ─── オフライン時 preview → pending に保存 ──────────────────
  const stashAsPending = useCallback((text: string, durationSec: number) => {
    const memo: PendingMemo = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      transcript: text,
      createdAt: new Date().toISOString(),
      durationSec,
    };
    pushPending(memo);
    setPending(loadPending());
    notifyInApp({
      kind: 'info',
      title: '未処理メモに保存',
      body: 'ネット復帰後に「AI 振り分け」を押せます',
      duration: 3500,
    });
  }, []);

  // ─── Routing (現在の transcript) ──────────────────────────
  const routeText = useCallback(async (text: string) => {
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
  }, [settings]);

  const handleRoute = useCallback(async () => {
    const text = finalRef.current || transcript;
    if (!text.trim()) { setError('音声が認識されませんでした。'); return; }
    if (!online) {
      stashAsPending(text, elapsedAtStopRef.current || elapsed);
      onClose();
      return;
    }
    await routeText(text);
  }, [transcript, online, elapsed, stashAsPending, routeText, onClose]);

  // ─── Pending memo → AI route ───────────────────────────────
  const processPending = useCallback(async (memo: PendingMemo) => {
    if (!online) {
      notifyInApp({ kind: 'warn', title: 'オフラインです', body: 'ネット復帰後にもう一度押してください' });
      return;
    }
    setProcessingPendingId(memo.id);
    finalRef.current = memo.transcript;
    setTranscript(memo.transcript);
    removePending(memo.id);
    setPending(loadPending());
    setProcessingPendingId(null);
    await routeText(memo.transcript);
  }, [online, routeText]);

  const discardPending = useCallback((memo: PendingMemo) => {
    removePending(memo.id);
    setPending(loadPending());
  }, []);

  // ─── カテゴリ手動上書き ────────────────────────────────────
  const overrideKind = useCallback((idx: number, kind: VoiceCategory) => {
    setItems(prev => prev.map((p, i) => i === idx ? { ...p, kind, checked: true } : p));
  }, []);

  // ─── AgentTaskQueue 委任 ───────────────────────────────────
  const handleDelegateTodos = useCallback(() => {
    const text = finalRef.current || transcript;
    if (!text.trim()) return;
    const taskItems = items.filter(i => i.kind === 'task');
    const summary = taskItems.length > 0
      ? `音声メモから抽出した ToDo を AI 会社で分業実行:\n${taskItems.map(t => `- ${t.title}`).join('\n')}`
      : `音声メモに含まれる ToDo を AI 会社で分業実行`;
    queue.propose({
      title: `音声メモの ToDo を AI 会社に委任`,
      summary,
      why: `オーナーの口頭メモを行動可能なタスクに変換し、CXO が並列で進める`,
      expected: 'タスク完了 + 報告',
      dueDays: 2,
      steps: [
        { cxo: 'CEO', label: 'ToDo を優先順位付け、担当 CXO に分配' },
        { cxo: 'COO', label: '実行手順を細分化、必要な資料を準備' },
        { cxo: 'CDS', label: '進捗と成果を集計、ダッシュボードに反映' },
      ],
    });
    notifyInApp({
      kind: 'success',
      title: 'AI 会社に依頼しました',
      body: `承認後に CEO → COO → CDS の順で実行`,
      duration: 4000,
    });
  }, [transcript, items, queue]);

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

  // ─── 全件をナレッジにエクスポート ──────────────────────────
  const handleExportAllAsKnowledge = useCallback(() => {
    const checked = items.filter(i => i.checked);
    if (checked.length === 0) return;
    const fullText = finalRef.current || transcript;
    const ts = new Date().toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });
    const lines: string[] = [
      `# 音声メモ振り分け結果 (${ts})`,
      '',
      `## 含まれる項目 (${checked.length}件)`,
      ...checked.map(c => {
        const meta = KIND_META[c.kind];
        return `- ${meta.emoji} **${meta.label}** — ${c.title}\n  ${c.summary}`;
      }),
      '',
      '## 原文',
      fullText,
    ];
    onAddKnowledgeNote(`🎤 音声メモ ${ts}`, lines.join('\n'));
    notifyInApp({
      kind: 'success',
      title: 'ナレッジに保存しました',
      body: `${checked.length}件をまとめて 1 件のノートに`,
      duration: 3000,
    });
  }, [items, transcript, onAddKnowledgeNote]);

  // ─── Render ───────────────────────────────────────────────

  const hasCrmItem = items.some(i => i.checked && i.kind === 'crm');
  const hasTaskItem = items.some(i => i.kind === 'task');

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
            <StudioBackButton onClick={onClose} />
            <span className="text-xl">🎤</span>
            <div>
              <p className="text-fg font-semibold text-sm">音声メモ</p>
              <p className="text-fg-muted text-xs">
                AI が自動振り分け
                {!online && <span style={{ color: '#f87171', marginLeft: 6 }}>● オフライン</span>}
              </p>
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
          {phase === 'idle' && (
            <StudioIntro
              id="voice-capture"
              accent={persona.accentColor}
              iconKey="voice"
              what="話すだけで「タスク / ナレッジ / CRM / 経費 / アイデア」に AI が自動で振り分けます。"
              tryThis="🎙 録音開始 を押して、ふだんの口調で 10 秒話してみる。"
              example="「明日 14 時に田中さんと打合せ。来週までに提案書」→ 予定 + タスク + CRM の 3 行が出来上がり。"
              sampleLabel="出来上がる振り分け"
              samplePreview={
                <div
                  style={{
                    width: 160,
                    background: 'var(--surface)',
                    color: 'var(--fg)',
                    borderRadius: 8,
                    padding: '7px 8px',
                    fontSize: 7,
                    lineHeight: 1.45,
                    boxShadow: '0 6px 14px rgba(0,0,0,0.25)',
                    border: `1px solid ${persona.accentColor}40`,
                  }}
                  aria-label="自動振り分けのサンプル"
                >
                  <div
                    style={{
                      fontSize: 6,
                      opacity: 0.7,
                      marginBottom: 4,
                      paddingBottom: 3,
                      borderBottom: '1px dashed var(--border)',
                    }}
                  >
                    「明日 14 時に田中さんと打合せ…」
                  </div>
                  {[
                    { icon: '✅', label: 'タスク', text: '提案書を作成 (来週まで)', color: '#4ADE80' },
                    { icon: '🤝', label: 'CRM', text: '田中さん 商談 14:00', color: '#FFA94D' },
                    { icon: '📚', label: 'ナレッジ', text: '打合せメモ', color: '#5BA8FF' },
                  ].map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 4,
                        alignItems: 'center',
                        marginBottom: i === 2 ? 0 : 2,
                        padding: '2px 4px',
                        background: `${r.color}14`,
                        borderRadius: 3,
                        fontSize: 6,
                      }}
                    >
                      <span style={{ fontSize: 8, flexShrink: 0 }}>{r.icon}</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: r.color,
                          fontSize: 5,
                          flexShrink: 0,
                        }}
                      >
                        {r.label}
                      </span>
                      <span style={{ opacity: 0.85, fontSize: 5.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.text}
                      </span>
                    </div>
                  ))}
                </div>
              }
            />
          )}

          {/* ─── 未処理メモ一覧 (idle 時のみ) ─── */}
          {phase === 'idle' && pending.length > 0 && (
            <div className="cp-card-section">
              <div className="flex items-center justify-between mb-2">
                <p className="cp-h3">📥 未処理メモ ({pending.length})</p>
                {!online && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                    オフライン
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {pending.slice(0, 5).map(memo => (
                  <div key={memo.id}
                    className="rounded-lg p-2.5 text-xs"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                  >
                    <p className="text-fg-muted text-[10px] mb-1">
                      {fmtElapsedSince(memo.createdAt)} · {fmtTime(memo.durationSec)} · {memo.transcript.length}文字
                    </p>
                    <p className="text-fg line-clamp-2 mb-2">{memo.transcript.slice(0, 120)}</p>
                    <div className="flex gap-1.5">
                      <motion.button
                        onClick={() => processPending(memo)}
                        disabled={!online || processingPendingId === memo.id}
                        className="flex-1 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
                        style={{ background: persona.accentColor, color: '#1F1D26' }}
                        whileTap={{ scale: 0.97 }}
                      >
                        🤖 AI 振り分け
                      </motion.button>
                      <button
                        onClick={() => discardPending(memo)}
                        className="px-2 py-1.5 rounded-md text-xs"
                        style={{ background: 'transparent', color: 'var(--fg-subtle)', border: '1px solid var(--border)' }}
                      >
                        破棄
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                    {!online && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                        オフライン
                      </span>
                    )}
                  </div>
                  <div className="w-full min-h-[80px] max-h-[200px] overflow-y-auto rounded-xl p-3 text-sm"
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
                    長時間録音 OK・少し黙っても止まりません。<br />
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
                  <div className="w-full min-h-[100px] max-h-[280px] overflow-y-auto rounded-xl p-3 text-sm text-fg"
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
              {!online && transcript.trim() && (
                <div className="rounded-lg p-2.5 text-xs"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                  オフライン中: 「未処理に保存」を押すと、ネット復帰後に振り分けできます。
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
                    {online ? '🤖 AI 振り分け' : '📥 未処理に保存'}
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
              <p className="text-fg-muted text-xs">振り分け候補 (チェックして保存・カテゴリは右で変更可)</p>

              <div className="space-y-2">
                {items.map((item, idx) => {
                  const meta = KIND_META[item.kind] ?? { emoji: '📌', label: item.kind, color: '#9088A8' };
                  return (
                    <motion.div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-xl transition-all"
                      style={{
                        background: item.checked ? `${meta.color}12` : 'var(--surface-3)',
                        border: `1px solid ${item.checked ? meta.color + '40' : 'var(--border)'}`,
                      }}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}
                    >
                      <div
                        onClick={() => setItems(prev => prev.map((p, i) => i === idx ? { ...p, checked: !p.checked } : p))}
                        className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center mt-0.5 border transition-all cursor-pointer"
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
                          {/* カテゴリ手動上書き */}
                          <select
                            value={item.kind}
                            onChange={e => overrideKind(idx, e.target.value as VoiceCategory)}
                            onClick={e => e.stopPropagation()}
                            className="text-xs font-medium px-1.5 py-0.5 rounded cursor-pointer"
                            style={{ background: meta.color + '20', color: meta.color, border: 'none', outline: 'none' }}
                            aria-label="カテゴリを変更"
                          >
                            {KIND_ORDER.map(k => (
                              <option key={k} value={k} style={{ background: 'var(--surface)', color: 'var(--fg)' }}>
                                {KIND_META[k].emoji} {KIND_META[k].label}
                              </option>
                            ))}
                          </select>
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

              {/* セカンダリアクション: エクスポート / AI 委任 */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={handleExportAllAsKnowledge}
                  disabled={items.filter(i => i.checked).length === 0}
                  className="flex-1 min-w-[120px] py-2 rounded-lg text-xs font-medium disabled:opacity-40"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                >
                  📤 まとめてナレッジ化
                </button>
                {hasTaskItem && (
                  <button
                    onClick={handleDelegateTodos}
                    className="flex-1 min-w-[120px] py-2 rounded-lg text-xs font-medium"
                    style={{ background: 'var(--surface-3)', border: `1px solid ${persona.accentColor}60`, color: persona.accentColor }}
                  >
                    🏢 AI 会社に委任
                  </button>
                )}
              </div>

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
