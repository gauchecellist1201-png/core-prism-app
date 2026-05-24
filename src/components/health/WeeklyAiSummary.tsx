// ============================================================
// WeeklyAiSummary — 開いた瞬間 1日1回、直近7日 PHR を AI に投げ
// 「体調トレンド / 注意指標 / 今日の1アクション」を表示し、
// 「来週の運動計画を作って」「ストレス対策メモを作って」を
// AgentTaskQueue (CDS + UXE 他) に propose できる。
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle2, Dumbbell, Brain, ArrowRight } from 'lucide-react';
import AILoadingState from '../AILoadingState';
import {
  generateWeeklySummary,
  loadCachedSummary,
  isCacheFresh,
  type WeeklyHealthSummary,
} from '../../lib/weeklyHealthSummary';
import type { DailyHealth } from '../../types/health';
import { useAgentTaskQueue } from '../../hooks/useAgentTaskQueue';

interface Props {
  days: DailyHealth[];
  /** 開いた瞬間に自動生成するか (1日1回キャッシュ判定込み) */
  autoGenerate?: boolean;
}

export default function WeeklyAiSummary({ days, autoGenerate = true }: Props) {
  const [summary, setSummary] = useState<WeeklyHealthSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposedKind, setProposedKind] = useState<'workout' | 'stress' | 'sleep' | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const triedRef = useRef(false);

  const queue = useAgentTaskQueue();

  const run = useCallback(async (force = false) => {
    if (days.length === 0) {
      setError('まずは健康データを取り込んでください');
      return;
    }
    if (!force) {
      const cached = loadCachedSummary();
      if (isCacheFresh(cached, days)) {
        setSummary(cached);
        return;
      }
    }
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setError(null);
    try {
      const next = await generateWeeklySummary({ days, signal: ac.signal });
      setSummary(next);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || 'AI 要約に失敗しました');
    } finally {
      setBusy(false);
    }
  }, [days]);

  useEffect(() => {
    // キャッシュをまず即時表示
    const cached = loadCachedSummary();
    if (cached) setSummary(cached);
    if (!autoGenerate || triedRef.current) return;
    triedRef.current = true;
    // 1 日 1 回まで自動生成
    if (!isCacheFresh(cached, days) && days.length > 0) {
      run(false);
    }
  }, [autoGenerate, days, run]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
  }, []);

  // ─── AgentTaskQueue propose ───
  const proposeWorkout = useCallback(() => {
    setProposedKind('workout');
    queue.propose({
      title: '[健康] 来週の運動プランを作る',
      summary: '直近 7 日の歩数 / アクティブ時間 / リカバリーをもとに、来週の運動計画 (曜日別) を CDS が分析、UXE が読みやすく整形します。',
      why: '運動を「気が向いたら」から「予定」に変えるだけで、続く確率が約 3 倍になります。',
      expected: '来週 7 日分のメニュー (時間帯 + 内容 + 強度)',
      dueDays: 1,
      steps: [
        { cxo: 'CDS', label: '直近 7 日のリカバリー / 歩数を分析' },
        { cxo: 'CPO', label: '生活リズムに合う運動枠を 7 日分設計' },
        { cxo: 'UXE', label: '実行しやすい 1 枚プランに整形' },
      ],
    });
    setTimeout(() => setProposedKind(null), 1600);
  }, [queue]);

  const proposeStress = useCallback(() => {
    setProposedKind('stress');
    queue.propose({
      title: '[健康] ストレス対策メモを作る',
      summary: '直近のストレス指標 / HRV / 睡眠から、今のあなたに効くストレス対策を 5 つに絞ってメモ化します (仕事を止めない前提)。',
      why: 'ストレスは「対策を知っていれば下がる」のではなく「メモを見て即実行」で初めて下がります。',
      expected: '5 分以内で読めるストレス対策メモ',
      dueDays: 1,
      steps: [
        { cxo: 'CDS', label: 'ストレス傾向と原因仮説を抽出' },
        { cxo: 'UXE', label: '即実行できる 5 つの行動に翻訳' },
      ],
    });
    setTimeout(() => setProposedKind(null), 1600);
  }, [queue]);

  const proposeSleep = useCallback(() => {
    setProposedKind('sleep');
    queue.propose({
      title: '[健康] 睡眠リズム改善プラン',
      summary: '睡眠時間 / 深睡眠 / レム の直近データから、今夜から始める睡眠改善ステップを CDS + UXE が作成します。',
      why: '睡眠は健康の土台。1 週間で実感できる小さな改善に絞ります。',
      expected: '今夜 / 明日 / 1 週間後の 3 ステップ',
      dueDays: 1,
      steps: [
        { cxo: 'CDS', label: '深睡眠 / レム / 入眠時刻を分析' },
        { cxo: 'UXE', label: '無理なく続く 3 ステップに翻訳' },
      ],
    });
    setTimeout(() => setProposedKind(null), 1600);
  }, [queue]);

  // データなし
  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-surface-2 p-4 text-center">
        <Sparkles className="mx-auto h-5 w-5 text-fg-muted" />
        <div className="mt-2 text-[13px] text-fg-muted">
          まずは「ソース → 健康データ取込」で 1 日分でも入れると、週次サマリが出ます。
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(167,139,250,0.10), rgba(167,139,250,0.03))',
        borderColor: 'rgba(167,139,250,0.30)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg,#A78BFA,#A78BFAcc)' }}
          >
            <Sparkles size={14} color="#fff" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] tracking-[0.3em] text-fg-muted">WEEKLY AI SUMMARY</div>
            <div className="text-[14px] font-semibold text-fg">今週のあなたの体調</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => run(true)}
          disabled={busy}
          aria-label="再生成"
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-fg hover:bg-white/10 disabled:opacity-60"
          style={{ minHeight: 36 }}
        >
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
          {summary ? '再生成' : '生成する'}
        </button>
      </div>

      <AILoadingState
        active={busy}
        label="今週の体調を要約しています"
        stages={[
          '直近 7 日の数値を集計',
          '注意指標を検出',
          '今日のおすすめ行動を選定',
          '読みやすく整形',
        ]}
        onAbort={handleAbort}
        brand="prism"
        skeletonLines={3}
      />

      {error && !busy && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      )}

      <AnimatePresence>
        {summary && !busy && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 grid gap-3"
          >
            {/* トレンド */}
            <div className="rounded-xl bg-white/4 p-3">
              <div className="text-[10px] tracking-[0.25em] text-fg-subtle">TREND</div>
              <p className="mt-1 text-[14px] leading-relaxed text-fg">{summary.trend}</p>
            </div>

            {/* 注意指標 */}
            {summary.watch.length > 0 && (
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3">
                <div className="flex items-center gap-1.5 text-[10px] tracking-[0.25em] text-amber-200">
                  <AlertTriangle size={11} />
                  注意したい指標
                </div>
                <ul className="mt-1.5 grid gap-1.5">
                  {summary.watch.map((w, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[13.5px] leading-relaxed text-fg"
                    >
                      <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-300" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 今日のアクション */}
            <div
              className="rounded-xl border p-3"
              style={{
                background: 'linear-gradient(135deg,rgba(16,185,129,0.10),rgba(16,185,129,0.02))',
                borderColor: 'rgba(16,185,129,0.30)',
              }}
            >
              <div className="flex items-center gap-1.5 text-[10px] tracking-[0.25em] text-emerald-200">
                <CheckCircle2 size={11} />
                今日のたった 1 つのアクション
              </div>
              <p className="mt-1 text-[14.5px] font-medium leading-relaxed text-fg">
                {summary.todayAction}
              </p>
            </div>

            <p className="text-right text-[11px] text-fg-subtle">
              {new Date(summary.generatedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {' · 1 日 1 回まで自動更新 · これは医療アドバイスではありません'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AgentTaskQueue 連携ボタン */}
      <div className="mt-3 border-t border-white/5 pt-3">
        <div className="text-[10px] tracking-[0.25em] text-fg-subtle mb-2">
          AI 会社に任せる
        </div>
        <div className="grid gap-1.5 sm:grid-cols-3">
          <ProposeBtn
            label="来週の運動計画"
            icon={<Dumbbell size={13} />}
            onClick={proposeWorkout}
            busy={proposedKind === 'workout'}
          />
          <ProposeBtn
            label="ストレス対策メモ"
            icon={<Brain size={13} />}
            onClick={proposeStress}
            busy={proposedKind === 'stress'}
          />
          <ProposeBtn
            label="睡眠リズム改善"
            icon={<ArrowRight size={13} />}
            onClick={proposeSleep}
            busy={proposedKind === 'sleep'}
          />
        </div>
      </div>
    </div>
  );
}

function ProposeBtn({
  label, icon, onClick, busy,
}: { label: string; icon: React.ReactNode; onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 text-[13px] text-fg hover:bg-white/8 disabled:opacity-70"
      style={{ minHeight: 44 }}
    >
      {icon}
      {busy ? '依頼を登録中…' : label}
    </button>
  );
}
