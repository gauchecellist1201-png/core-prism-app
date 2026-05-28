// ============================================================
// TaskHub — タスク管理ハブ (大幅アップグレード 2026-05-24)
//
// 機能:
//   1. 3 ビュー切替 (今日 / 今週 / すべて) + 優先度 / 期限 / 追加順 ソート
//   2. AI が「次にやるべき 3 つ」を毎朝提案 (1 日 1 回キャッシュ)
//   3. タスクから AgentTaskQueue へ「AI 会社に任せる」ボタン
//   4. 時間ブロック表示 (estimatedMin 合計 / 1 日 8h ベース)
//   5. 完了で紙吹雪 + 連続完了 streak
//   6. 既存音声入力 (GlobalVoiceInput) は textarea / input にフォーカスで自動起動
//   7. モバイル: スワイプで完了 (横スワイプ 80px 以上)
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, KnowledgeItem } from '../types/identity';
import EmptyState from './EmptyState';
import { usePersonas } from '../hooks/usePersonas';
import { useAgentTaskQueue, CXO_META, type CxoRole, type ProposalDraft } from '../hooks/useAgentTaskQueue';
import { RewardBurst } from './visualFx';

interface Props {
  persona: Persona;
  knowledge: KnowledgeItem[];
  onToggleTask: (personaId: string, taskId: string) => void;
  onAcceptAction: (action: string) => void;
  onClose: () => void;
}

type ViewMode = 'today' | 'week' | 'all';
type SortMode = 'priority' | 'due' | 'created';

interface AggregatedTask {
  id: string;
  title: string;
  source: 'persona' | 'knowledge-action' | 'knowledge-strategy' | 'risk';
  sourceLabel: string;
  priority: 'high' | 'mid' | 'low';
  done: boolean;
  due?: string;
  estimatedMin?: number;
  createdAt?: string;
  delegatedAgentTaskId?: string;
  isProposal?: boolean;
  knowledgeId?: string;
  taskId?: string;
}

// ── ユーティリティ ──────────────────────────────────────
const TOP3_CACHE_KEY = 'taskhub_top3_cache_v1';
const STREAK_KEY = 'taskhub_done_streak_v1';

interface Top3Cache {
  personaId: string;
  date: string;             // YYYY-MM-DD
  ids: string[];
  reason: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadTop3(): Top3Cache | null {
  try { return JSON.parse(localStorage.getItem(TOP3_CACHE_KEY) || 'null'); } catch { return null; }
}
function saveTop3(c: Top3Cache) {
  try { localStorage.setItem(TOP3_CACHE_KEY, JSON.stringify(c)); } catch { /* */ }
}

interface StreakData {
  count: number;
  lastDate: string;        // 最後に完了したタスクの日付
}
function loadStreak(): StreakData {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY) || '{"count":0,"lastDate":""}'); } catch { return { count: 0, lastDate: '' }; }
}
function saveStreak(s: StreakData) {
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch { /* */ }
}

/** タスク文言から最適な CXO を推定 (タイトル + sourceLabel) */
function pickCxo(text: string): { primary: CxoRole; secondary?: CxoRole; label: string } {
  const t = text.toLowerCase();
  // 営業・案件
  if (/sales|営業|顧客|商談|提案|アプローチ|crm|リード|case|deal/i.test(t))
    return { primary: 'CSO', secondary: 'CMO', label: '営業として動く' };
  // 議事録・記録系
  if (/議事|録|meeting|ミーティング|会議|ヒアリング|録音/i.test(t))
    return { primary: 'CDS', secondary: 'CPO', label: '議事録から要点を抽出' };
  // 数字・財務
  if (/数字|売上|経費|収支|請求|invoice|p&l|予算|決算/i.test(t))
    return { primary: 'CFO', label: '数字を集計' };
  // デザイン
  if (/デザイン|ui|ux|配色|フォント|ロゴ|design|画像|og/i.test(t))
    return { primary: 'CDO', secondary: 'UIE', label: 'デザインを磨く' };
  // マーケ・SNS
  if (/sns|投稿|発信|マーケ|広告|キャンペーン|コピー|lp/i.test(t))
    return { primary: 'CMO', label: 'コピーを書く' };
  // データ・分析
  if (/分析|データ|集計|レポート|ダッシュ|kpi|metrics/i.test(t))
    return { primary: 'CDS', label: 'データを分析' };
  // 法務
  if (/契約|nda|法務|規約|コンプライアンス/i.test(t))
    return { primary: 'CLO', label: '法務を確認' };
  // 実装・バグ
  if (/実装|バグ|修正|デプロイ|api|エラー|コード/i.test(t))
    return { primary: 'CTO', secondary: 'QAE', label: '実装する' };
  // 仕様・企画
  if (/仕様|機能|ロードマップ|要望|プロダクト/i.test(t))
    return { primary: 'CPO', secondary: 'CDO', label: '仕様を固める' };
  // 整理・運用
  if (/整理|スケジュール|タスク|optim/i.test(t))
    return { primary: 'COO', label: '運用を整える' };
  // デフォルト
  return { primary: 'CEO', label: '全体最適で判断' };
}

function buildAgentProposal(task: AggregatedTask): ProposalDraft {
  const pick = pickCxo(task.title + ' ' + task.sourceLabel);
  const steps: Array<{ cxo: CxoRole; label: string }> = [];
  steps.push({ cxo: pick.primary, label: `「${task.title.slice(0, 40)}」を実行するための要点を整理` });
  if (pick.secondary) steps.push({ cxo: pick.secondary, label: '実行プランを 1 枚にまとめる' });
  steps.push({ cxo: pick.primary, label: '実行結果を 1 つにまとめて報告' });
  return {
    title: `[TaskHub] ${task.title.slice(0, 60)}`,
    summary: `タスクハブから委任。担当: ${CXO_META[pick.primary].name}${pick.secondary ? ` + ${CXO_META[pick.secondary].name}` : ''}。${pick.label}します。`,
    why: `オーナーがタスクハブで「AI 会社に任せる」を選択しました。`,
    expected: '実行結果 (1-2 文の報告)',
    dueDays: task.due ? 3 : 7,
    steps,
  };
}

/** 期日テキストを Date に解釈 (今日/明日/明後日/yyyy-mm-dd/今週/来週) */
function parseDue(due: string | undefined): Date | null {
  if (!due) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (due === '今日' || /today/i.test(due)) return d;
  if (due === '明日') { d.setDate(d.getDate() + 1); return d; }
  if (due === '明後日') { d.setDate(d.getDate() + 2); return d; }
  if (due === '今週') { d.setDate(d.getDate() + 6); return d; }
  if (due === '来週') { d.setDate(d.getDate() + 13); return d; }
  const m = due.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}

function isToday(due: string | undefined): boolean {
  const d = parseDue(due);
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function isThisWeek(due: string | undefined): boolean {
  const d = parseDue(due);
  if (!d) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (d.getTime() - today.getTime()) / 86400000;
  return diff >= 0 && diff <= 7;
}

export default function TaskHub({ persona, knowledge, onToggleTask, onAcceptAction, onClose }: Props) {
  const [view, setView] = useState<ViewMode>('today');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [showDone, setShowDone] = useState(false);
  const [burst, setBurst] = useState<{ message?: string } | null>(null);
  const [streak, setStreak] = useState<StreakData>(loadStreak);
  const [top3, setTop3] = useState<Top3Cache | null>(loadTop3());
  const [top3Loading, setTop3Loading] = useState(false);
  const [delegatingId, setDelegatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 内部の usePersonas() インスタンス — 同一タブ broadcast で同期される
  const { addTask, updateTask, deleteTask } = usePersonas();
  const queue = useAgentTaskQueue();

  const [newTitle, setNewTitle] = useState('');
  const [newEst, setNewEst] = useState<string>('30');
  const [newPriority, setNewPriority] = useState<'high' | 'mid' | 'low'>('mid');
  const [newDue, setNewDue] = useState('今日');
  const newTitleRef = useRef<HTMLInputElement | null>(null);
  const focusNewTitle = useCallback(() => {
    setTimeout(() => {
      newTitleRef.current?.focus();
      newTitleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }, []);

  // 集約タスク
  const tasks: AggregatedTask[] = useMemo(() => {
    const out: AggregatedTask[] = [];
    for (const t of persona.tasks) {
      out.push({
        id: `task:${t.id}`,
        title: t.title,
        source: 'persona',
        sourceLabel: '直接登録',
        priority: t.priority,
        done: t.done,
        due: t.due,
        estimatedMin: t.estimatedMin,
        createdAt: t.createdAt,
        delegatedAgentTaskId: t.delegatedAgentTaskId,
        taskId: t.id,
      });
    }
    const personaKnowledge = knowledge.filter(k => k.personaId === persona.id);
    for (const k of personaKnowledge) {
      const a = k.analysis;
      if (!a) continue;
      for (const act of a.actions || [])
        out.push({ id: `kb-action:${k.id}:${act.slice(0, 30)}`, title: act, source: 'knowledge-action', sourceLabel: `📄 ${k.title}`, priority: 'mid', done: false, isProposal: true, knowledgeId: k.id });
      for (const s of a.strategy || [])
        out.push({ id: `kb-strategy:${k.id}:${s.slice(0, 30)}`, title: s, source: 'knowledge-strategy', sourceLabel: `🎯 ${k.title}`, priority: 'mid', done: false, isProposal: true, knowledgeId: k.id });
      for (const r of a.risks || [])
        out.push({ id: `kb-risk:${k.id}:${r.slice(0, 30)}`, title: r, source: 'risk', sourceLabel: `⚠ ${k.title}`, priority: 'high', done: false, isProposal: true, knowledgeId: k.id });
    }
    return out;
  }, [persona.tasks, knowledge, persona.id]);

  // ビュー (期日) フィルタ
  const viewFiltered = useMemo(() => {
    if (view === 'all') return tasks;
    if (view === 'today') return tasks.filter(t => t.done || t.isProposal || isToday(t.due));
    return tasks.filter(t => t.done || t.isProposal || isThisWeek(t.due));
  }, [tasks, view]);

  // ソート
  const sorted = useMemo(() => {
    const arr = [...viewFiltered];
    const pri = { high: 0, mid: 1, low: 2 };
    if (sortMode === 'priority') arr.sort((a, b) => pri[a.priority] - pri[b.priority]);
    else if (sortMode === 'due') arr.sort((a, b) => {
      const da = parseDue(a.due)?.getTime() ?? Infinity;
      const db = parseDue(b.due)?.getTime() ?? Infinity;
      return da - db;
    });
    else if (sortMode === 'created') arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return arr;
  }, [viewFiltered, sortMode]);

  const open = useMemo(() => sorted.filter(t => !t.done), [sorted]);
  const done = useMemo(() => sorted.filter(t => t.done), [sorted]);
  const realOpen = useMemo(() => open.filter(t => !t.isProposal), [open]);
  const proposals = useMemo(() => open.filter(t => t.isProposal), [open]);

  // サマリー
  const summary = useMemo(() => {
    const totalEst = realOpen.reduce((s, t) => s + (t.estimatedMin || 0), 0);
    const hours = totalEst / 60;
    const dayBudget = 8;
    const fill = Math.min(100, (hours / dayBudget) * 100);
    return {
      openCount: realOpen.length,
      highCount: realOpen.filter(t => t.priority === 'high').length,
      proposalCount: proposals.length,
      doneCount: tasks.filter(t => t.done).length,
      totalEst, hours, dayBudget, fill,
    };
  }, [realOpen, proposals, tasks]);

  // ─── AI トップ 3 提案 (1 日 1 回) ───────────────────────────
  const fetchTop3 = useCallback(async (force = false) => {
    if (realOpen.length === 0) { setTop3(null); return; }
    const cached = loadTop3();
    if (!force && cached && cached.personaId === persona.id && cached.date === todayStr()) {
      setTop3(cached);
      return;
    }
    setTop3Loading(true);
    try {
      const items = realOpen.slice(0, 20).map(t => `- [${t.id}] ${t.title} (優先度: ${t.priority}${t.due ? ` / 期限: ${t.due}` : ''}${t.estimatedMin ? ` / ${t.estimatedMin}分` : ''})`).join('\n');
      const sys = `あなたは ${persona.name} の頼れる秘書です。今日やるべきタスクを 3 つだけ選び、理由を 1 行で添えてください。出力は厳密な JSON のみ:\n{"ids":["id1","id2","id3"],"reason":"なぜこの 3 つか (40 字)"}`;
      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5', max_tokens: 300,
          system: sys,
          messages: [{ role: 'user', content: `# 候補タスク (id 付き)\n${items}\n\n優先度 + 期限 + 依存関係を考えて 3 つ選んで。` }],
        }),
      });
      if (!r.ok) throw new Error('AI 呼び出し失敗');
      const data = await r.json();
      const text = (data.content?.[0]?.text || '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON 解析失敗');
      const parsed = JSON.parse(match[0]) as { ids: string[]; reason: string };
      const cache: Top3Cache = { personaId: persona.id, date: todayStr(), ids: parsed.ids.slice(0, 3), reason: parsed.reason };
      saveTop3(cache);
      setTop3(cache);
    } catch {
      // フォールバック: 優先度 + 期限で機械的に選ぶ
      const fb = [...realOpen].sort((a, b) => {
        const pri = { high: 0, mid: 1, low: 2 };
        const d = pri[a.priority] - pri[b.priority];
        if (d !== 0) return d;
        return (parseDue(a.due)?.getTime() ?? Infinity) - (parseDue(b.due)?.getTime() ?? Infinity);
      }).slice(0, 3);
      const cache: Top3Cache = {
        personaId: persona.id, date: todayStr(),
        ids: fb.map(t => t.id),
        reason: '優先度と期限から自動選択 (AI 接続なし)',
      };
      saveTop3(cache);
      setTop3(cache);
    } finally {
      setTop3Loading(false);
    }
  }, [realOpen, persona.id, persona.name]);

  // マウント時 / persona 変更時に 1 日 1 回チェック
  const fetchOnceRef = useRef(false);
  useEffect(() => {
    if (fetchOnceRef.current) return;
    fetchOnceRef.current = true;
    fetchTop3(false);
  }, [fetchTop3]);

  const top3Ids = top3 && top3.personaId === persona.id && top3.date === todayStr() ? top3.ids : [];

  // ─── 完了処理 (祝賀 + streak) ──────────────────────────────
  const handleToggle = useCallback((task: AggregatedTask) => {
    if (!task.taskId) return;
    const goingDone = !task.done;
    onToggleTask(persona.id, task.taskId);
    if (goingDone) {
      // streak 更新
      const today = todayStr();
      setStreak(prev => {
        let next: StreakData;
        if (prev.lastDate === today) {
          next = { count: prev.count + 1, lastDate: today };
        } else {
          const y = new Date(); y.setDate(y.getDate() - 1);
          const ystr = y.toISOString().slice(0, 10);
          const continuing = prev.lastDate === ystr;
          next = { count: continuing ? prev.count + 1 : 1, lastDate: today };
        }
        saveStreak(next);
        return next;
      });
      const msgs = ['よくできました!', 'いい調子!', 'もう 1 個いきましょう', '今日も前進!', '完璧です'];
      setBurst({ message: msgs[Math.floor(Math.random() * msgs.length)] });
    }
  }, [onToggleTask, persona.id]);

  // ─── タスク追加 ────────────────────────────────────────────
  const handleAdd = useCallback(() => {
    const title = newTitle.trim();
    if (!title) return;
    addTask(persona.id, {
      title,
      priority: newPriority,
      due: newDue.trim() || '今日',
      done: false,
      estimatedMin: Number(newEst) || undefined,
    });
    setNewTitle('');
    setNewEst('30');
    setToast('タスクを追加しました');
    setTimeout(() => setToast(null), 1800);
  }, [addTask, persona.id, newTitle, newPriority, newDue, newEst]);

  // ─── AI 会社に委任 ────────────────────────────────────────
  const handleDelegate = useCallback((task: AggregatedTask) => {
    setDelegatingId(task.id);
    try {
      const draft = buildAgentProposal(task);
      const agentTask = queue.propose(draft);
      if (task.taskId) {
        updateTask(persona.id, task.taskId, { delegatedAgentTaskId: agentTask.id });
      }
      setToast(`${CXO_META[draft.steps[0].cxo as CxoRole].name} にタスクを渡しました`);
      setTimeout(() => setToast(null), 2200);
    } catch {
      setToast('委任に失敗しました');
      setTimeout(() => setToast(null), 1800);
    } finally {
      setDelegatingId(null);
    }
  }, [queue, updateTask, persona.id]);

  // ─── レンダリング ──────────────────────────────────────────
  return (
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '1040px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>✅</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">タスクハブ</p>
              <p className="cp-meta truncate">{persona.name} · {streak.count > 0 ? `🔥 ${streak.count} 連続完了中` : 'やる事を全部ここに'}</p>
            </div>
          </div>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
        </div>

        {/* ビュー切替 (今日 / 今週 / すべて) */}
        <div className="cp-modal-tabs">
          {([
            { id: 'today' as ViewMode, label: '🌅 今日' },
            { id: 'week'  as ViewMode, label: '📅 今週' },
            { id: 'all'   as ViewMode, label: `📋 すべて (${tasks.length})` },
          ]).map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              className="cp-modal-tab" data-active={view === t.id}
              style={{ color: view === t.id ? persona.accentColor : undefined }}
            >{t.label}</button>
          ))}
        </div>

        <div className="cp-modal-body cp-stack">
          {/* サマリー (4 カード) */}
          <div className="cp-grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { label: '進行中', value: summary.openCount, color: persona.accentColor },
              { label: '高優先', value: summary.highCount, color: '#FF6B6B' },
              { label: '提案中', value: summary.proposalCount, color: '#C084FC' },
              { label: '完了', value: summary.doneCount, color: '#4ADE80' },
            ].map(s => (
              <div key={s.label} className="cp-card text-center">
                <p className="cp-tiny">{s.label}</p>
                <p style={{ fontSize: '1.6rem', fontWeight: 600, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* 時間ブロック (見積もり合計) */}
          {summary.totalEst > 0 && (
            <div className="cp-card-section">
              <div className="cp-row-between mb-2">
                <p className="cp-h3">⏱ 今日の時間予算</p>
                <p className="cp-meta">
                  {summary.hours.toFixed(1)} h / {summary.dayBudget} h
                </p>
              </div>
              <div style={{ height: 10, background: 'rgba(127,127,127,0.15)', borderRadius: 999, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${summary.fill}%` }} transition={{ duration: 0.6 }}
                  style={{
                    height: '100%',
                    background: summary.fill > 100 ? '#FF6B6B'
                      : summary.fill > 80 ? '#FACC15'
                      : persona.accentColor,
                  }}
                />
              </div>
              <p className="cp-tiny mt-2">
                {summary.fill > 100
                  ? '⚠ 1 日 8 時間に収まりません。優先度を絞るか期限を調整しましょう'
                  : `あと ${(summary.dayBudget - summary.hours).toFixed(1)} 時間で全部終わる予定`}
              </p>
            </div>
          )}

          {/* AI トップ 3 */}
          {realOpen.length > 0 && (
            <div className="cp-card-section" style={{
              background: `linear-gradient(135deg, ${persona.accentColor}11, transparent)`,
              borderLeft: `3px solid ${persona.accentColor}`,
            }}>
              <div className="cp-row-between mb-2">
                <p className="cp-h3">🎯 AI が選ぶ「次にやるべき 3 つ」</p>
                <button
                  onClick={() => fetchTop3(true)}
                  disabled={top3Loading}
                  className="cp-btn cp-btn-sm cp-btn-ghost"
                  style={{ fontSize: '0.75rem' }}
                >
                  {top3Loading ? '考え中…' : '↻ 再選定'}
                </button>
              </div>
              {top3Loading && !top3 ? (
                <p className="cp-meta">AI が今日のベスト 3 を選んでいます…</p>
              ) : top3 && top3Ids.length > 0 ? (
                <>
                  <p className="cp-meta mb-2">💭 {top3.reason}</p>
                  <div className="cp-stack-sm">
                    {top3Ids.map(id => {
                      const t = realOpen.find(x => x.id === id);
                      if (!t) return null;
                      return (
                        <TaskRow key={t.id} task={t} persona={persona}
                          highlighted
                          onToggle={() => handleToggle(t)}
                          onAccept={() => t.isProposal && onAcceptAction(t.title)}
                          onDelegate={() => handleDelegate(t)}
                          delegating={delegatingId === t.id}
                          onEstimate={(min) => t.taskId && updateTask(persona.id, t.taskId, { estimatedMin: min })}
                          onDelete={() => t.taskId && deleteTask(persona.id, t.taskId)}
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="cp-meta">タスクを追加すると、AI が朝に 3 つだけ選んでくれます</p>
              )}
            </div>
          )}

          {/* タスク追加フォーム */}
          <div className="cp-card-section">
            <p className="cp-h3 mb-2">+ 新しいタスクを追加</p>
            <div className="cp-stack-sm">
              <input
                ref={newTitleRef}
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="やること (フォーカスでマイクが出ます)"
                className="cp-input"
                style={{ width: '100%' }}
              />
              <div className="cp-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <select value={newPriority} onChange={e => setNewPriority(e.target.value as any)} className="cp-input" style={{ flex: '0 0 110px' }}>
                  <option value="high">🔥 高優先</option>
                  <option value="mid">🌟 中</option>
                  <option value="low">🌱 低</option>
                </select>
                <input type="text" value={newDue} onChange={e => setNewDue(e.target.value)} placeholder="今日 / 明日 / 2026-05-30" className="cp-input" style={{ flex: '1 1 130px' }} />
                <input type="number" value={newEst} onChange={e => setNewEst(e.target.value)} placeholder="分" className="cp-input" style={{ flex: '0 0 80px' }} min={5} step={5} />
                <button onClick={handleAdd} className="cp-btn cp-btn-sm" disabled={!newTitle.trim()}
                  style={{ background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
                  追加
                </button>
              </div>
            </div>
          </div>

          {/* ソート chip */}
          <div className="cp-row" style={{ gap: 4, flexWrap: 'wrap' }}>
            <span className="cp-tiny" style={{ alignSelf: 'center', marginRight: 6 }}>並び順:</span>
            {([
              { id: 'priority' as SortMode, label: '優先度' },
              { id: 'due'      as SortMode, label: '期限' },
              { id: 'created'  as SortMode, label: '追加順' },
            ]).map(s => (
              <button key={s.id} onClick={() => setSortMode(s.id)}
                className="cp-btn cp-btn-sm"
                style={sortMode === s.id ? { background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' } : {}}>
                {s.label}
              </button>
            ))}
            <button onClick={() => setShowDone(s => !s)} className="cp-btn cp-btn-sm" style={{ marginLeft: 'auto' }}>
              {showDone ? '✓ 完了を非表示' : `✓ 完了を表示 (${done.length})`}
            </button>
          </div>

          {/* タスク一覧 */}
          <div className="cp-card-section">
            <p className="cp-h3 mb-2">📌 タスク</p>
            {realOpen.length === 0 ? (
              persona.tasks.length === 0 ? (
                <EmptyState
                  icon="📋"
                  title="今日のやることはまだありません"
                  description={'Prism の AI が「あなたが手放したい仕事」を見つけて、ここに並べます。\n最初の 1 件を入れると、AI 会社 (CXO 9 人) に丸投げできるボタンが出ます。'}
                  ctaLabel="最初の 1 件を書く"
                  onCta={focusNewTitle}
                  accent={persona.accentColor}
                  preview="🔥 来週の提案資料を作る (60 分) → CSO に任せる"
                />
              ) : (
                <p className="cp-meta">この期間に取り組むタスクはありません</p>
              )
            ) : (
              <div className="cp-stack-sm">
                {realOpen.map(t => (
                  <TaskRow key={t.id} task={t} persona={persona}
                    onToggle={() => handleToggle(t)}
                    onAccept={() => t.isProposal && onAcceptAction(t.title)}
                    onDelegate={() => handleDelegate(t)}
                    delegating={delegatingId === t.id}
                    onEstimate={(min) => t.taskId && updateTask(persona.id, t.taskId, { estimatedMin: min })}
                    onDelete={() => t.taskId && deleteTask(persona.id, t.taskId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 提案 (ナレッジから) */}
          {proposals.length > 0 && (
            <div className="cp-card-section">
              <p className="cp-h3 mb-1">💡 ナレッジから AI の提案 ({proposals.length})</p>
              <p className="cp-meta mb-3">タップでタスクに昇格できます</p>
              <div className="cp-stack-sm">
                {proposals.slice(0, 8).map(t => (
                  <TaskRow key={t.id} task={t} persona={persona}
                    onToggle={() => {}}
                    onAccept={() => onAcceptAction(t.title)}
                    onDelegate={() => {}}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 完了済み */}
          {showDone && done.length > 0 && (
            <div className="cp-card-section">
              <p className="cp-h3 mb-2">✓ 完了済み</p>
              <div className="cp-stack-sm">
                {done.slice(0, 30).map(t => (
                  <TaskRow key={t.id} task={t} persona={persona}
                    onToggle={() => handleToggle(t)}
                    onAccept={() => {}}
                    onDelegate={() => {}}
                    onDelete={() => t.taskId && deleteTask(persona.id, t.taskId)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* 完了祝賀 */}
      <RewardBurst
        show={!!burst}
        accent={persona.accentColor}
        message={burst?.message}
        onDone={() => setBurst(null)}
      />

      {/* トースト — .cp-toast 統一スタイル (persona アクセント) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            className="cp-toast cp-toast--success"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              ['--cp-toast-accent' as any]: persona.accentColor,
              ['--cp-toast-glow' as any]: `${persona.accentColor}55`,
            }}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden style={{ color: persona.accentColor, fontWeight: 800, fontSize: 14 }}>✓</span>
            <span>{toast}</span>
            <span className="cp-toast__bar" aria-hidden />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── タスク行 (スワイプ完了対応) ─────────────────────────────
function TaskRow({
  task, persona, onToggle, onAccept, onDelegate, delegating, highlighted, onEstimate, onDelete,
}: {
  task: AggregatedTask;
  persona: Persona;
  onToggle: () => void;
  onAccept: () => void;
  onDelegate: () => void;
  delegating?: boolean;
  highlighted?: boolean;
  onEstimate?: (min: number) => void;
  onDelete?: () => void;
}) {
  const priColor = task.priority === 'high' ? '#FF6B6B' : task.priority === 'mid' ? '#FACC15' : '#9088A8';
  const [editingEst, setEditingEst] = useState(false);
  const [estVal, setEstVal] = useState(String(task.estimatedMin || 30));

  // スワイプ
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const cur = e.touches[0].clientX;
    setDx(cur - startX.current);
  };
  const onTouchEnd = () => {
    if (!task.isProposal && Math.abs(dx) > 80 && task.taskId) {
      onToggle();
    }
    setDx(0);
    startX.current = null;
  };

  return (
    <motion.div
      className="cp-card cp-card-tap cp-row"
      data-selected={highlighted ? 'true' : undefined}
      animate={{ x: dx, background: dx > 60 ? 'rgba(74,222,128,0.18)' : undefined }}
      transition={{ type: 'tween', duration: 0.15 }}
      style={{
        gap: 10,
        borderLeft: highlighted ? `3px solid ${persona.accentColor}` : undefined,
        boxShadow: highlighted ? `0 4px 18px ${persona.accentColor}33` : undefined,
        touchAction: 'pan-y',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button onClick={onToggle} disabled={task.isProposal}
        className="flex-shrink-0 rounded-md flex items-center justify-center"
        style={{
          width: 24, height: 24,
          background: task.done ? persona.accentColor : 'transparent',
          border: `1.5px solid ${task.done ? persona.accentColor : priColor}`,
          opacity: task.isProposal ? 0.4 : 1,
          cursor: task.isProposal ? 'default' : 'pointer',
        }}>
        {task.done && <span style={{ color: '#0a0a0f', fontSize: 14 }}>✓</span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className="cp-body" style={{
          textDecoration: task.done ? 'line-through' : 'none',
          color: task.done ? 'var(--fg-subtle)' : undefined,
          lineHeight: 1.5,
        }}>{task.title}</p>
        <div className="cp-row cp-meta truncate" style={{ marginTop: 2, gap: 6, flexWrap: 'wrap' }}>
          <span className="cp-pill" style={{ borderColor: priColor + '50', color: priColor }}>
            {task.priority === 'high' ? '高' : task.priority === 'mid' ? '中' : '低'}
          </span>
          <span style={{ opacity: 0.7 }}>{task.sourceLabel}</span>
          {task.due && <span className="font-mono" style={{ opacity: 0.7 }}>{task.due}</span>}
          {!task.isProposal && (
            editingEst ? (
              <input
                type="number" autoFocus value={estVal}
                onChange={e => setEstVal(e.target.value)}
                onBlur={() => {
                  setEditingEst(false);
                  const n = Number(estVal);
                  if (onEstimate && n > 0) onEstimate(n);
                }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="cp-input" style={{ width: 60, padding: '2px 6px', fontSize: '0.75rem' }}
              />
            ) : (
              <button onClick={() => setEditingEst(true)} className="cp-pill"
                style={{ borderColor: persona.accentColor + '50', color: persona.accentColor, cursor: 'pointer' }}>
                ⏱ {task.estimatedMin ? `${task.estimatedMin}分` : '時間'}
              </button>
            )
          )}
          {task.delegatedAgentTaskId && (
            <span className="cp-pill" style={{ borderColor: '#A78BFA50', color: '#A78BFA' }}>🤖 委任中</span>
          )}
        </div>
      </div>

      {task.isProposal ? (
        <button onClick={onAccept} className="cp-btn cp-btn-sm flex-shrink-0"
          style={{ background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
          + タスク化
        </button>
      ) : !task.done && (
        <div className="cp-row" style={{ gap: 4 }}>
          <button
            onClick={onDelegate}
            disabled={delegating || !!task.delegatedAgentTaskId}
            className="cp-btn cp-btn-sm flex-shrink-0"
            title={task.delegatedAgentTaskId ? '既に AI 会社へ委任済み' : `${CXO_META[pickCxo(task.title + ' ' + task.sourceLabel).primary].name} に任せる`}
            style={{
              background: task.delegatedAgentTaskId ? 'rgba(167,139,250,0.2)' : 'transparent',
              borderColor: task.delegatedAgentTaskId ? 'transparent' : '#A78BFA50',
              color: '#A78BFA',
              fontSize: '0.75rem',
              opacity: delegating ? 0.5 : 1,
            }}
          >
            {delegating ? '…' : task.delegatedAgentTaskId ? '🤖 委任済' : '🤖 AI 会社に任せる'}
          </button>
          {onDelete && (
            <button onClick={onDelete} className="cp-btn cp-btn-sm flex-shrink-0 cp-btn-ghost"
              title="削除" style={{ fontSize: '0.75rem', opacity: 0.5 }}>✕</button>
          )}
        </div>
      )}
    </motion.div>
  );
}
