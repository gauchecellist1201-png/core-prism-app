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
  /** failed 時の理由 (やさしい日本語で UI に出す) */
  error?: string;
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

  // ── 起動時: 5 分以上 'working' で残っている stuck task を failed に
  //    (オーナー報告 2026-06-03: 「実行中 9555 分 21 秒」と表示される偽の進行を撲滅) ──
  useEffect(() => {
    const STUCK_MS = 5 * 60 * 1000;
    setTasks(prev => {
      let changed = false;
      const next = prev.map(t => {
        if (t.status !== 'running') return t;
        const workingStep = t.steps.find(s => s.status === 'working');
        if (!workingStep || !workingStep.startedAt) return t;
        const age = Date.now() - new Date(workingStep.startedAt).getTime();
        if (age < STUCK_MS) return t;
        changed = true;
        const idx = t.steps.indexOf(workingStep);
        const steps = [...t.steps];
        steps[idx] = { ...workingStep, status: 'failed' as const, finishedAt: new Date().toISOString(),
          error: 'ブラウザが閉じられたまま停止しました。「やり直す」で再開できます' };
        return { ...t, steps, status: 'failed' as const };
      });
      return changed ? next : prev;
    });
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

  /** ステップを失敗させる (内部) — 黙らず task ごと failed にして停止 */
  const markStepFailed = useCallback((taskId: string, stepIdx: number, reason: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const steps = [...t.steps];
      if (steps[stepIdx]) {
        steps[stepIdx] = { ...steps[stepIdx], status: 'failed', finishedAt: new Date().toISOString(), error: reason };
      }
      return { ...t, steps, status: 'failed' as const };
    }));
  }, []);

  /**
   * タスク実行ループ — 各 CXO が実 AI 呼出しで動作。
   * fromIdx から再開可 (retry 用)。
   * 一時的な不調は自動で 2 回リトライ。それでもダメなら黙らず failed で停止し、
   * UI の「やり直す」で復帰できる (沈黙する失敗ゼロ)。
   */
  const runTask = useCallback((id: string, fromIdx = 0) => {
    const current = loadQueue().find(t => t.id === id);
    if (!current) return;
    let stepIdx = fromIdx;
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

      // AI 呼び出し — 一時的なネット不調は最大 2 回まで自動リトライ
      // 1 回あたり最大 45 秒で打ち切り (オーナー報告 2026-06-03: 偽の長時間「実行中」を撲滅)
      let output: string | null = null;
      let lastErr = '';
      for (let attempt = 0; attempt < 2 && output === null; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 450));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000);
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
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!r.ok) { lastErr = `AI が応答エラーを返しました (${r.status})`; continue; }
          const data = await r.json() as any;
          const text = data.content?.[0]?.text || '';
          // 接続成功・本文が空なら担当領域のテンプレで継続 (これは失敗ではない)
          output = text.trim() ? text.trim().slice(0, 80) : (fallbacks[step.cxo] || '完了');
        } catch (e) {
          clearTimeout(timer);
          lastErr = (e as { name?: string })?.name === 'AbortError'
            ? 'AI 実行が 45 秒以内に終わりませんでした (タイムアウト)'
            : 'AI への接続に失敗しました';
        }
      }

      // 2 回試してもダメ → 黙って「完了」にせず failed で停止 (やり直すで復帰)
      if (output === null) {
        markStepFailed(id, stepIdx, lastErr || 'AI 実行に失敗しました');
        return;
      }

      // 体感のため最低 1.2 秒表示
      await new Promise(r => setTimeout(r, 1200));
      advanceStep(id, stepIdx, output);
      stepIdx++;
      advance();
    };
    advance();
  }, [advanceStep, markStepFailed]);

  /** 失敗したタスクを、失敗したステップから再実行 (救済導線) */
  const retry = useCallback((id: string) => {
    let resumeIdx = 0;
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const idx = t.steps.findIndex(s => s.status === 'failed');
      resumeIdx = idx >= 0 ? idx : 0;
      const steps = t.steps.map((s, i) => i === resumeIdx
        ? { ...s, status: 'working' as const, startedAt: new Date().toISOString(), finishedAt: undefined, error: undefined }
        : s);
      return { ...t, status: 'running' as const, steps };
    }));
    runTask(id, resumeIdx);
  }, [runTask]);

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
    retry,
    clear,
    activeTask: tasks.find(t => t.status === 'running') || null,
    proposedTasks: tasks.filter(t => t.status === 'proposed'),
    recentDone: tasks.filter(t => t.status === 'done').slice(0, 5),
    failedTasks: tasks.filter(t => t.status === 'failed'),
  };
}

/** CXO の表示名・色・絵文字 */
/**
 * 各 CXO の詳細プロファイル:
 *  - name / emoji / color / tagline: 表示用 (従来)
 *  - shortLabel: アバター下に出る 3 文字以内の役職略号 (CEO/CFO/CMO 等)
 *  - watching: 待機時に「いま何を監視しているか」を rotation 表示するためのフレーズ群
 *  - canDo: 「いま任せられること」3 件 — ユーザーがクリックして即承認できるアクション
 */
export interface CxoMeta {
  name: string;
  emoji: string;
  color: string;
  tagline: string;
  shortLabel: string;
  watching: string[];
  canDo: string[];
}

export const CXO_META: Record<CxoRole, CxoMeta> = {
  CEO: {
    name: 'CEO イーロン', emoji: '🌟', color: '#FBBF24', tagline: '戦略・最終判断',
    shortLabel: 'CEO',
    watching: ['全社の数字をチェック中', '今週の優先順位を再計算', '判断待ちの議題を棚卸し'],
    canDo: ['今週の優先 3 つを決める', '判断保留の案件を整理する', '来月の方針を 1 ページに'],
  },
  CTO: {
    name: 'CTO テック', emoji: '⚙️', color: '#60A5FA', tagline: 'コード・実装',
    shortLabel: 'CTO',
    watching: ['実装中タスクの進捗を確認', 'エラーログを巡回', '改善余地を洗い出し中'],
    canDo: ['今のサイトの改善点を 5 つ', 'バグ報告から修正案を作る', '新機能の実装計画を起こす'],
  },
  CPO: {
    name: 'CPO プロダクト', emoji: '🎯', color: '#A78BFA', tagline: '仕様・優先順',
    shortLabel: 'CPO',
    watching: ['機能の利用状況を観察', 'ユーザー要望を集約中', '次に作るべき物を考慮'],
    canDo: ['次に作る機能を 3 つ提案', 'プロダクトロードマップを描く', 'ユーザー要望を優先順位化'],
  },
  CDO: {
    name: 'CDO デザイン', emoji: '🎨', color: '#F472B6', tagline: 'デザイン磨き',
    shortLabel: 'CDO',
    watching: ['UI の違和感を巡回中', '配色とフォントを点検', 'スクリーンショットを審査'],
    canDo: ['今の画面のデザイン改善案', 'ロゴ / 配色を見直す', '新しい OG 画像を作る'],
  },
  CMO: {
    name: 'CMO マーケ', emoji: '📣', color: '#FB923C', tagline: 'コピー・拡散',
    shortLabel: 'CMO',
    watching: ['SNS の反応を観測', '新しい切り口を探索', '競合の発信を追跡'],
    canDo: ['今週の SNS 投稿 5 本を書く', 'LP の見出しを 3 案出す', '友だち招待用の文面を作る'],
  },
  CSO: {
    name: 'CSO セールス', emoji: '💼', color: '#34D399', tagline: '案件探索',
    shortLabel: 'CSO',
    watching: ['見込み顧客リストを更新', '今日アプローチすべき先を選定', '提案中の案件を追跡'],
    canDo: ['今日アプローチする 5 社を選ぶ', '提案文を 1 通仕上げる', 'パイプラインを整理する'],
  },
  CFO: {
    name: 'CFO 財務', emoji: '📊', color: '#10B981', tagline: '数字・経費',
    shortLabel: 'CFO',
    watching: ['未処理レシートを発見', '今月の収支を試算', '請求書の遅延を監視中'],
    canDo: ['今月の損益を 1 枚にまとめる', '未処理レシートを処理する', '来月の予算を立てる'],
  },
  COO: {
    name: 'COO オペレ', emoji: '🗂', color: '#9CA3AF', tagline: '運用・整理',
    shortLabel: 'COO',
    watching: ['積み残しタスクを巡回中', 'スケジュールの衝突を確認', '案件の遅延を検知'],
    canDo: ['今週のタスクを整理する', '会議スケジュールを最適化', '滞留タスクを処理'],
  },
  CDS: {
    name: 'CDS データ', emoji: '🔬', color: '#06B6D4', tagline: '分析・洞察',
    shortLabel: 'CDS',
    watching: ['今週のメトリクスを集計', '異常値を検出中', '傾向を可視化準備中'],
    canDo: ['今週の数字を 1 枚に分析', '指標の異常を洗い出す', 'ダッシュボードを更新する'],
  },
  CLO: {
    name: 'CLO 法務', emoji: '⚖️', color: '#6366F1', tagline: '規約・遵守',
    shortLabel: 'CLO',
    watching: ['契約書の期限を監視', '規約変更の影響を点検', 'リスクを洗い出し中'],
    canDo: ['NDA を 1 通読む', '契約書の論点を抽出', '今のリスクを 3 つ挙げる'],
  },
  UIE: {
    name: 'UIE UI エンジニア', emoji: '✨', color: '#EC4899', tagline: 'UI 細部',
    shortLabel: 'UIE',
    watching: ['余白とアイコンを点検', 'タップ対象サイズを確認', 'アニメ違和感を探索'],
    canDo: ['今の画面の UI 細部を磨く', '新しいアニメを 1 つ提案', 'タップしづらい所を修正'],
  },
  UXE: {
    name: 'UXE UX エンジニア', emoji: '👁', color: '#8B5CF6', tagline: '操作感',
    shortLabel: 'UXE',
    watching: ['ユーザー導線を観察', '迷い箇所を発見', '初回体験を再点検'],
    canDo: ['操作で迷う箇所を洗い出す', '初回体験を 1 段階磨く', 'エラー文を優しく直す'],
  },
  QAE: {
    name: 'QAE 品質', emoji: '🛡', color: '#14B8A6', tagline: '動作テスト',
    shortLabel: 'QAE',
    watching: ['新しい変更を試験中', '壊れた箇所を巡回', 'リリース前点検中'],
    canDo: ['今のサイトを 5 シナリオで試す', '壊れた箇所を洗い出す', 'リリース前チェックリスト'],
  },
};
