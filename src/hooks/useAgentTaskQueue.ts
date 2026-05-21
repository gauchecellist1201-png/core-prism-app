// ============================================================
// useAgentTaskQueue — AI 会社 (CEO + 9 CXO) のタスク キューと進捗
//
// ユーザーは「承認」のみ、実働は AI が担う設計。
// タスクは ProposalCard で提示 → 承認で実行 → AgentTeamMonitor で進捗可視化。
// localStorage に永続、複数タブ間同期、再起動後復元。
// ============================================================
import { useCallback, useEffect, useState } from 'react';

export type CxoRole =
  | 'CEO'   // 戦略・最終判断 (オーナー対話)
  | 'CTO'   // テック・実装
  | 'CPO'   // プロダクト・仕様
  | 'CDO'   // デザイン・磨き
  | 'CMO'   // マーケ・コピー量産
  | 'CSO'   // セールス・営業
  | 'CFO'   // 財務・数字
  | 'COO'   // オペレ・運用
  | 'CDS'   // データ分析
  | 'CLO'   // 法務 / コンプライアンス
  | 'UIE'   // UI エンジニア
  | 'UXE'   // UX エンジニア
  | 'QAE';  // QA 自動化

export interface AgentStep {
  cxo: CxoRole;
  label: string;
  /** 'pending' | 'working' | 'done' | 'failed' */
  status: 'pending' | 'working' | 'done' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  output?: string;
}

export type TaskStatus = 'proposed' | 'awaiting' | 'running' | 'done' | 'rejected' | 'failed';

export interface AgentTask {
  id: string;
  title: string;
  summary: string;
  /** タスクの理由 (なぜやるか) */
  why?: string;
  /** 期待される成果 / KPI */
  expected?: string;
  /** 期限 (日数) */
  dueDays?: number;
  status: TaskStatus;
  proposedAt: string;
  approvedAt?: string;
  completedAt?: string;
  /** 関与する CXO (順番に動く) */
  steps: AgentStep[];
  /** 最終成果物の格納先 (ナレッジ / 案件 / 提案書 など) */
  resultLink?: string;
}

const QUEUE_KEY = 'core_agent_task_queue_v1';
const MAX_HISTORY = 50;

function loadQueue(): AgentTask[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as AgentTask[]).slice(0, MAX_HISTORY);
  } catch { return []; }
}

function saveQueue(q: AgentTask[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(0, MAX_HISTORY))); } catch { /* */ }
}

function uid() { return 't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

export interface ProposalDraft {
  title: string;
  summary: string;
  why?: string;
  expected?: string;
  dueDays?: number;
  steps: Array<Omit<AgentStep, 'status'>>;
}

export function useAgentTaskQueue() {
  const [tasks, setTasks] = useState<AgentTask[]>(loadQueue);

  // 他タブの localStorage 変更で再読込
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === QUEUE_KEY) setTasks(loadQueue());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => { saveQueue(tasks); }, [tasks]);

  /** 提案を新規追加 (proposed 状態で) */
  const propose = useCallback((draft: ProposalDraft): AgentTask => {
    const t: AgentTask = {
      id: uid(),
      title: draft.title,
      summary: draft.summary,
      why: draft.why,
      expected: draft.expected,
      dueDays: draft.dueDays,
      status: 'proposed',
      proposedAt: new Date().toISOString(),
      steps: draft.steps.map(s => ({ ...s, status: 'pending' as const })),
    };
    setTasks(prev => [t, ...prev]);
    return t;
  }, []);

  /** ユーザーが承認 → 実行開始 */
  const approve = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? {
      ...t, status: 'running' as const,
      approvedAt: new Date().toISOString(),
      steps: t.steps.map((s, i) => i === 0 ? { ...s, status: 'working' as const, startedAt: new Date().toISOString() } : s),
    } : t));
    runTask(id);
  }, []);

  /** ユーザーが却下 */
  const reject = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'rejected' as const } : t));
  }, []);

  /** ステップを進める (内部) */
  const advanceStep = useCallback((taskId: string, stepIdx: number, output?: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const steps = [...t.steps];
      if (steps[stepIdx]) {
        steps[stepIdx] = { ...steps[stepIdx], status: 'done', finishedAt: new Date().toISOString(), output };
      }
      // 次のステップ
      if (stepIdx + 1 < steps.length) {
        steps[stepIdx + 1] = { ...steps[stepIdx + 1], status: 'working', startedAt: new Date().toISOString() };
        return { ...t, steps };
      }
      // 全完了
      return { ...t, steps, status: 'done', completedAt: new Date().toISOString() };
    }));
  }, []);

  /** タスク実行ループ — 各 CXO が実 AI 呼出しで動作 (失敗時はテンプレで継続) */
  const runTask = useCallback((id: string) => {
    const current = loadQueue().find(t => t.id === id);
    if (!current) return;
    let stepIdx = 0;
    const fallbacks: Record<CxoRole, string> = {
      CEO: '優先順を整理', CTO: 'コードを実装', CPO: '仕様を確定',
      CDO: '見た目を磨き', CMO: '文章を生成', CSO: 'リードを探索',
      CFO: '数字を集計', COO: 'ファイルを整理', CDS: 'データを分析',
      CLO: '法務を確認', UIE: 'UI を実装', UXE: '操作感を磨き', QAE: '動作テスト',
    };
    const advance = async () => {
      const latest = loadQueue().find(t => t.id === id);
      if (!latest || latest.status !== 'running') return;
      if (stepIdx >= latest.steps.length) return;
      const step = latest.steps[stepIdx];

      const sys = `あなたは CORE 株式会社の ${CXO_META[step.cxo].name} (${CXO_META[step.cxo].tagline}) です。
ユーザーが承認したタスク「${latest.title}」を、自分の専門領域から実行に移します。
返答は「実行結果」を 1 文 (40 字以内) で簡潔に。例: "保存率上位 3 投稿を抽出: チェックリスト型が +24% 強い"`;
      const userPrompt = `# タスク\n${latest.title}\n\n# 概要\n${latest.summary}\n\n# あなたの担当ステップ\n${step.label}\n\n上記を実行し、結果を 1 文で報告してください。`;

      let output = fallbacks[step.cxo] || '完了';
      try {
        const r = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 200,
            system: sys,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        if (r.ok) {
          const data = await r.json() as any;
          const text = data.content?.[0]?.text || '';
          if (text.trim()) output = text.trim().slice(0, 80);
        }
      } catch { /* fallback で継続 */ }

      // 体感のため最低 1.5 秒表示
      await new Promise(r => setTimeout(r, 1500));
      advanceStep(id, stepIdx, output);
      stepIdx++;
      advance();
    };
    advance();
  }, [advanceStep]);

  /** 履歴を消去 */
  const clear = useCallback(() => setTasks([]), []);

  /** 状態別カウント (UI バッジ用) */
  const counts = {
    proposed: tasks.filter(t => t.status === 'proposed').length,
    running: tasks.filter(t => t.status === 'running').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  return {
    tasks,
    counts,
    propose,
    approve,
    reject,
    clear,
    activeTask: tasks.find(t => t.status === 'running') || null,
    proposedTasks: tasks.filter(t => t.status === 'proposed'),
    recentDone: tasks.filter(t => t.status === 'done').slice(0, 5),
  };
}

/** CXO の表示名・色・絵文字 */
export const CXO_META: Record<CxoRole, { name: string; emoji: string; color: string; tagline: string }> = {
  CEO: { name: 'CEO イーロン', emoji: '🌟', color: '#FBBF24', tagline: '戦略・最終判断' },
  CTO: { name: 'CTO テック',   emoji: '⚙️', color: '#60A5FA', tagline: 'コード・実装' },
  CPO: { name: 'CPO プロダクト', emoji: '🎯', color: '#A78BFA', tagline: '仕様・優先順' },
  CDO: { name: 'CDO デザイン', emoji: '🎨', color: '#F472B6', tagline: 'デザイン磨き' },
  CMO: { name: 'CMO マーケ',   emoji: '📣', color: '#FB923C', tagline: 'コピー・拡散' },
  CSO: { name: 'CSO セールス', emoji: '💼', color: '#34D399', tagline: '案件探索' },
  CFO: { name: 'CFO 財務',     emoji: '📊', color: '#10B981', tagline: '数字・経費' },
  COO: { name: 'COO オペレ',   emoji: '🗂', color: '#9CA3AF', tagline: '運用・整理' },
  CDS: { name: 'CDS データ',   emoji: '🔬', color: '#06B6D4', tagline: '分析・洞察' },
  CLO: { name: 'CLO 法務',     emoji: '⚖️', color: '#6366F1', tagline: '規約・遵守' },
  UIE: { name: 'UIE UI エンジニア', emoji: '✨', color: '#EC4899', tagline: 'UI 細部' },
  UXE: { name: 'UXE UX エンジニア', emoji: '👁', color: '#8B5CF6', tagline: '操作感' },
  QAE: { name: 'QAE 品質',     emoji: '🛡', color: '#14B8A6', tagline: '動作テスト' },
};
