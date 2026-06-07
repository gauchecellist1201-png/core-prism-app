// ============================================================
// AgentTeamMonitor — AI 会社 (CEO + CXO 軍団) の「作戦本部」表示
//
// 設計指針 (2026-05-23 大改造):
//  - 「STANDBY / お飾りマーク」感を完全排除
//  - 待機中でも 13 人の CXO がそれぞれ「いま何を見ているか」を回転表示
//  - 各アバターは emoji + 役職短ラベル (CEO/CFO/CMO 等) で意味を持つ
//  - クリックすると「いま任せられる 3 件」のポップオーバー
//  - 1 件選んで「任せる」 → propose + auto-approve → 軍団が即動き出す
//  - 「今日 N 件 / 今週 N 件 完了」のミニ統計
// ============================================================
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Check, Loader2, Sparkles, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAgentTaskQueue, CXO_META, cxoDisplayName, type CxoRole, type AgentTask } from '../hooks/useAgentTaskQueue';
import { useCelebrate } from '../hooks/useCelebrate';
import { usePersonas } from '../hooks/usePersonas';
import { useSettings } from '../hooks/useSettings';
import InlineActionExecutor from './InlineActionExecutor';
import CxoProfileModal from './CxoProfileModal';
import { logSuggestion, setStatus as setSuggestionStatus } from '../lib/aiSuggestionLog';
import { logDeliverable } from '../lib/cxoDeliverables';

interface Props {
  /** Iris か Prism — Iris は dock 上、Prism は別位置 */
  brand?: 'prism' | 'iris';
  /** 折りたたみ状態の初期値 */
  initialOpen?: boolean;
}

const WATCH_ROTATE_MS = 4500;

export default function AgentTeamMonitor({ brand = 'prism', initialOpen = false }: Props) {
  const { activeTask, recentDone, counts, propose, approve, retry, reject, failedTasks } = useAgentTaskQueue();
  const failedTask = failedTasks[0] || null;
  const { celebrate, CelebratePortal } = useCelebrate();
  // ユーザーが明示的に閉じた状態は localStorage に保存し、active task が来ても
  // 勝手に開かないようにする (2026-05-26: オーナー報告でリール画面で widget が
  // 開きっぱなしになりスクロールできなくなる問題を修正)
  const OPEN_PREF_KEY = 'core_agent_monitor_open_v1';
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(OPEN_PREF_KEY);
      if (saved === '0') return false;
      if (saved === '1') return true;
    } catch { /* */ }
    return initialOpen || !!activeTask;
  });
  useEffect(() => {
    try { localStorage.setItem(OPEN_PREF_KEY, open ? '1' : '0'); } catch { /* */ }
  }, [open]);
  const [openCxo, setOpenCxo] = useState<CxoRole | null>(null);
  const [watchTick, setWatchTick] = useState(0);
  // HH (2026-06-03): タスクボタン → InlineActionExecutor で AI 実行 → 成果物表示
  const [inlineExec, setInlineExec] = useState<{ action: string; cxo: CxoRole; suggestionId?: string | null } | null>(null);
  // JJJJ (2026-06-04): CXO 人格 詳細 モーダル
  const [profileRole, setProfileRole] = useState<CxoRole | null>(null);
  const { activePersona } = usePersonas();
  const { settings } = useSettings();

  // 完了タスクが増えた瞬間に祝う (初回マウントは祝わない)
  const seenDoneIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (seenDoneIdsRef.current === null) {
      // 初回: 既存の完了済みをスキップ集合に投入
      seenDoneIdsRef.current = new Set(recentDone.map(t => t.id));
      return;
    }
    const seen = seenDoneIdsRef.current;
    const fresh = recentDone.filter(t => !seen.has(t.id));
    if (fresh.length > 0) {
      // 最新 1 件だけ祝う (バースト対策)
      celebrate({ message: 'AI 軍団が完了しました' });
      fresh.forEach(t => seen.add(t.id));
    }
  }, [recentDone, celebrate]);

  // 待機中の rotation tick (13 人 × 3 フレーズで巡回)
  useEffect(() => {
    if (activeTask) return;
    const t = window.setInterval(() => setWatchTick(x => x + 1), WATCH_ROTATE_MS);
    return () => window.clearInterval(t);
  }, [activeTask]);

  // Studio バナー等から「開いて見せて」と言われたら膨らむ
  // ただしユーザーが明示的に閉じた直後 (10 秒以内) は尊重 — 自動再展開で
  // スクロールが阻害される問題を防ぐ
  useEffect(() => {
    const onOpen = () => {
      try {
        const saved = localStorage.getItem(OPEN_PREF_KEY);
        const closedAt = localStorage.getItem(OPEN_PREF_KEY + '_closed_at');
        if (saved === '0' && closedAt) {
          const since = Date.now() - parseInt(closedAt, 10);
          if (since < 10 * 60 * 1000) return; // 直近 10 分以内に閉じられた → 尊重
        }
      } catch { /* */ }
      setOpen(true);
    };
    window.addEventListener('core:agent-monitor-open', onOpen as EventListener);
    return () => window.removeEventListener('core:agent-monitor-open', onOpen as EventListener);
  }, []);

  const accent = brand === 'iris' ? '#E1306C' : '#A78BFA';
  const workingCxo: CxoRole | null = activeTask?.steps.find(s => s.status === 'working')?.cxo || null;
  const hasActivity = !!activeTask || !!failedTask || counts.proposed > 0 || counts.running > 0;

  // 今日 / 今週の完了件数
  const stats = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400_000;
    const tsOf = (t: AgentTask) => t.completedAt ? new Date(t.completedAt).getTime()
      : t.approvedAt ? new Date(t.approvedAt).getTime()
      : new Date(t.proposedAt).getTime();
    const today = recentDone.filter(t => now - tsOf(t) < dayMs).length;
    const week = recentDone.filter(t => now - tsOf(t) < dayMs * 7).length;
    return { today, week };
  }, [recentDone]);

  // 待機中の「いま誰が何を見てるか」rotation
  const watchInfo = useMemo(() => {
    if (activeTask) return null;
    const roles = Object.keys(CXO_META) as CxoRole[];
    const role = roles[watchTick % roles.length];
    const meta = CXO_META[role];
    const phrase = meta.watching[Math.floor(watchTick / roles.length) % meta.watching.length];
    return { role, meta, phrase };
  }, [watchTick, activeTask]);

  // CXO クリックで「任せること」を選んだら InlineActionExecutor で
  // AI が考え → 成果物を表示する流れに統一 (HH: 2026-06-03 オーナー指示)
  // persona/settings が揃わない場合は従来の queue 経由 propose + auto-approve に倒す
  // GGGGG (2026-06-04): pending 提案 として記録 → 履歴モーダルで採否 が見える
  const recordSuggestion = (role: CxoRole, task: string) => {
    const meta = CXO_META[role];
    try {
      return logSuggestion({
        cxoKey: role,
        cxoName: cxoDisplayName(role),
        cxoEmoji: meta.emoji,
        title: task,
        detail: `${meta.shortLabel || meta.name} に依頼 — ${task}`,
        source: 'agent-monitor',
      });
    } catch { return null; }
  };
  const assignToCxo = (role: CxoRole, task: string) => {
    const meta = CXO_META[role];
    if (activePersona && settings) {
      const entry = recordSuggestion(role, task);
      setInlineExec({ action: `${cxoDisplayName(role)} に「${task}」をやらせる`, cxo: role, suggestionId: entry?.id });
      if (!open) setOpen(true);
      return;
    }
    // fallback: 古い task queue 経由
    const proposal = propose({
      title: task,
      summary: `${meta.name} が即実行します`,
      why: `あなたが ${cxoDisplayName(role)} に直接依頼したタスクです`,
      steps: [
        { cxo: role, label: task },
        ...(role !== 'QAE' ? [{ cxo: 'QAE' as CxoRole, label: '結果を点検' }] : []),
      ],
    });
    setTimeout(() => approve(proposal.id), 200);
    // GGGGG: queue 経由でも 「採用済 提案」 として履歴に記録
    const entry = recordSuggestion(role, task);
    if (entry) {
      try { setSuggestionStatus(entry.id, 'adopted'); } catch { /* */ }
    }
    setOpenCxo(null);
    if (!open) setOpen(true);
  };

  return (
    <>
    {CelebratePortal}
    {/* JJJJ (2026-06-04): CXO 人格 詳細 モーダル */}
    <CxoProfileModal
      role={profileRole}
      onClose={() => setProfileRole(null)}
      onAssign={(r) => {
        // 「いま頼む」を押された時は popover に戻して 3 件を選んでもらう
        setOpenCxo(r);
      }}
    />
    <motion.div
      initial={false}
      animate={{ height: open ? 'auto' : 56 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        right: 'max(14px, env(safe-area-inset-right, 0px))',
        width: 'min(380px, calc(100vw - 28px))',
        // 展開時でも画面の 60% 以上を覆わない (スクロール阻害防止)
        maxHeight: open ? 'min(60vh, 600px)' : 56,
        display: 'flex',
        flexDirection: 'column',
        // モーダル (z=50) より下に置く — 開いてる時は背景に隠れる ('請求書を発行' 等の footer ボタン が押せなくならないように)
        zIndex: 40,
        background: 'linear-gradient(180deg, rgba(18,18,30,0.92) 0%, rgba(10,10,20,0.95) 100%)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: `1px solid ${accent}33`,
        borderRadius: 16,
        boxShadow: `0 12px 36px rgba(0,0,0,0.4), 0 0 0 1px ${accent}11, 0 0 32px ${accent}22`,
        overflow: 'hidden',
        color: '#fff',
      }}
      role="region"
      aria-label="AI 会社 作戦本部"
      data-tour-id="agent-team-monitor"
    >
      {/* ヘッダ */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', height: 56,
          padding: '0 14px',
          background: 'transparent', border: 'none', color: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: (failedTask && !activeTask)
              ? 'linear-gradient(135deg, #F59E0B, #DC2626)'
              : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#fff',
            boxShadow: (failedTask && !activeTask)
              ? '0 0 16px rgba(220,38,38,0.6)'
              : hasActivity ? `0 0 16px ${accent}88` : 'none',
            flexShrink: 0,
          }}>
            {activeTask ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-flex' }}
              ><Loader2 size={16} /></motion.span>
            ) : failedTask ? (
              <AlertTriangle size={16} />
            ) : watchInfo ? (
              <span style={{ fontSize: 14 }}>{watchInfo.meta.emoji}</span>
            ) : '🏛'}
          </div>
          <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.14em',
              color: (failedTask && !activeTask) ? '#FBBF24' : accent,
            }}>
              {activeTask ? 'IN PROGRESS'
                : failedTask ? '要・やり直し'
                : counts.proposed > 0 ? 'AWAITING APPROVAL'
                : 'AI 会社 稼働中'}
            </div>
            <div style={{
              fontSize: 12.5, fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {activeTask?.title
                ? activeTask.title
                : failedTask
                  ? failedTask.title
                  : counts.proposed > 0
                    ? `${counts.proposed} 件の提案待ち`
                    : watchInfo
                      ? <RotatingWatchPhrase phrase={`${cxoDisplayName(watchInfo.role)} が ${watchInfo.phrase}`} tick={watchTick} />
                      : '13 名 待機中'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {workingCxo && (
            <span style={{
              fontSize: 10.5, fontWeight: 800,
              padding: '3px 8px', borderRadius: 999,
              background: `${CXO_META[workingCxo].color}22`,
              color: CXO_META[workingCxo].color,
              border: `1px solid ${CXO_META[workingCxo].color}44`,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {CXO_META[workingCxo].emoji} {workingCxo}
            </span>
          )}
          {/* ヘッダのチェブロンを明示的なアイコンボタンに見せ、押せると分かるよう塗る */}
          <span
            aria-hidden
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
            title={open ? '最小化' : '展開'}
          >
            {open ? <ChevronDown size={14} color="#fff" /> : <ChevronUp size={14} color="#fff" />}
          </span>
        </div>
      </button>
      {open && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
            try {
              localStorage.setItem(OPEN_PREF_KEY, '0');
              localStorage.setItem(OPEN_PREF_KEY + '_closed_at', String(Date.now()));
            } catch { /* */ }
          }}
          aria-label="作戦本部を閉じる"
          title="閉じる"
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 2,
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.16)',
            color: '#fff', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      )}

      {/* 展開時: CXO 列 + 詳細ログ (内部スクロール可能、最大高さは外側の maxHeight で制御) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              flex: '1 1 auto',
              minHeight: 0,
            }}
          >
            {/* 13 CXO アバター + 役職ラベル + クリックで「任せる」 */}
            <div style={{ padding: '12px 12px 8px 12px', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
                marginBottom: 8, paddingLeft: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>13 名の役員 — タップして任せる</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', textTransform: 'none', letterSpacing: 0 }}>
                  今日 <span style={{ color: '#10B981', fontWeight: 800 }}>{stats.today}</span> 件 / 今週 <span style={{ color: accent, fontWeight: 800 }}>{stats.week}</span> 件
                </span>
              </div>
              <div className="atm-cxo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {(Object.keys(CXO_META) as CxoRole[]).map((cxo) => {
                  const isWorking = workingCxo === cxo;
                  const isDoneOnActive = !!activeTask?.steps.find(s => s.cxo === cxo && s.status === 'done');
                  const isWatching = watchInfo?.role === cxo && !activeTask;
                  const meta = CXO_META[cxo];
                  const isPopoverOpen = openCxo === cxo;
                  return (
                    <button
                      key={cxo}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenCxo(p => p === cxo ? null : cxo);
                      }}
                      title={`${meta.name} — ${meta.tagline}`}
                      style={{
                        position: 'relative',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        padding: '6px 2px',
                        background: isPopoverOpen ? `${meta.color}22` : 'transparent',
                        border: 'none', borderRadius: 8,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      aria-label={`${meta.name} に頼む`}
                    >
                      <motion.div
                        animate={isWorking ? {
                          scale: [1, 1.14, 1],
                          boxShadow: [
                            `0 0 0 ${meta.color}66`,
                            `0 0 14px ${meta.color}`,
                            `0 0 0 ${meta.color}66`,
                          ],
                        } : isWatching ? {
                          scale: [1, 1.06, 1],
                          opacity: [0.85, 1, 0.85],
                        } : { scale: 1, opacity: 1 }}
                        transition={isWorking
                          ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                          : isWatching
                            ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                            : { duration: 0.3 }
                        }
                        style={{
                          width: 30, height: 30, borderRadius: 9,
                          background: isWorking
                            ? `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`
                            : isWatching
                              ? `${meta.color}25`
                              : isDoneOnActive
                                ? `${meta.color}33`
                                : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${
                            isWorking ? meta.color
                            : isWatching ? meta.color + '99'
                            : isDoneOnActive ? meta.color + '55'
                            : 'rgba(255,255,255,0.08)'
                          }`,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14,
                          position: 'relative',
                        }}
                      >
                        <span style={{
                          filter: !isWorking && !isDoneOnActive && !isWatching ? 'grayscale(0.5) opacity(0.7)' : 'none',
                        }}>{meta.emoji}</span>
                        {isDoneOnActive && !isWorking && (
                          <span style={{
                            position: 'absolute', bottom: -2, right: -2,
                            width: 12, height: 12, borderRadius: '50%',
                            background: '#10B981', color: '#fff',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            border: '2px solid #12121E',
                          }}><Check size={6} strokeWidth={4} /></span>
                        )}
                      </motion.div>
                      <span style={{
                        fontSize: 8.5, fontWeight: 800, letterSpacing: '0.02em',
                        color: isWorking || isWatching ? meta.color : 'rgba(255,255,255,0.55)',
                      }}>
                        {meta.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* HH: InlineActionExecutor — AI が考える → 成果物表示 を統一 */}
            <AnimatePresence>
              {inlineExec && activePersona && settings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                      fontSize: 11, color: CXO_META[inlineExec.cxo].color, fontWeight: 800,
                      letterSpacing: '0.08em',
                    }}>
                      <span style={{ fontSize: 14 }}>{CXO_META[inlineExec.cxo].emoji}</span>
                      <span>{cxoDisplayName(inlineExec.cxo)} が実行中</span>
                    </div>
                    <InlineActionExecutor
                      action={inlineExec.action}
                      persona={activePersona}
                      settings={settings}
                      onClose={() => setInlineExec(null)}
                      onComplete={(deliverable, act) => {
                        // 役員 日報 へ 自動 記録 (2026-06-05 オーナー指示)
                        try {
                          const meta = CXO_META[inlineExec.cxo];
                          const kindToCategory: Record<string, 'plan' | 'copy' | 'analysis' | 'outreach' | 'design' | 'finance' | 'product' | 'ops' | 'other'> = {
                            text: 'copy', checklist: 'plan', email: 'outreach', table: 'analysis', memo: 'copy',
                          };
                          logDeliverable({
                            personaId: activePersona.id,
                            cxoRole: inlineExec.cxo,
                            cxoName: cxoDisplayName(inlineExec.cxo),
                            cxoEmoji: meta.emoji,
                            title: deliverable.title || act,
                            summary: act,
                            content: deliverable.content,
                            category: kindToCategory[deliverable.kind] || 'other',
                            source: 'agent-monitor',
                          });
                        } catch { /* */ }
                      }}
                      onAddAsTask={(act) => {
                        // 完了した成果物をタスクキューにも残したい場合の保険
                        const proposal = propose({
                          title: act,
                          summary: `${cxoDisplayName(inlineExec.cxo)} の成果物`,
                          why: `インライン実行から保存しました`,
                          steps: [{ cxo: inlineExec.cxo, label: act }],
                        });
                        setTimeout(() => approve(proposal.id), 100);
                        // GGGGG: タスクに採用 = 採用 (adopted) として履歴 を更新
                        if (inlineExec.suggestionId) {
                          try { setSuggestionStatus(inlineExec.suggestionId, 'adopted'); } catch { /* */ }
                        }
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CXO クリック時のポップオーバー — 任せること 3 件 */}
            <AnimatePresence>
              {openCxo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{
                    padding: '12px 14px',
                    background: `linear-gradient(180deg, ${CXO_META[openCxo].color}11 0%, transparent 100%)`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: `linear-gradient(135deg, ${CXO_META[openCxo].color}, ${CXO_META[openCxo].color}cc)`,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, color: '#fff',
                      }}>{CXO_META[openCxo].emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
                          {cxoDisplayName(openCxo)}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>
                          {CXO_META[openCxo].tagline}
                        </div>
                      </div>
                      {/* JJJJ (2026-06-04): 人格 詳細 を開く */}
                      <button
                        type="button"
                        onClick={() => setProfileRole(openCxo)}
                        aria-label="この役員の詳細"
                        title="経歴 / 得意 / 苦手 / 名言 を見る"
                        style={{
                          padding: '4px 10px', borderRadius: 999,
                          background: `${CXO_META[openCxo].color}25`,
                          border: `1px solid ${CXO_META[openCxo].color}55`,
                          color: CXO_META[openCxo].color,
                          fontSize: 10, fontWeight: 800, cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >👤 人格</button>
                      <button
                        type="button"
                        onClick={() => setOpenCxo(null)}
                        aria-label="閉じる"
                        style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: 'rgba(255,255,255,0.06)', border: 'none',
                          color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      ><X size={12} /></button>
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                      color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
                      marginBottom: 6,
                    }}>
                      いま任せられる 3 件
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {CXO_META[openCxo].canDo.map((task, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => assignToCxo(openCxo, task)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 8, padding: '8px 10px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 8,
                            color: '#fff', fontSize: 12, fontWeight: 600,
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'background 0.15s, border 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = `${CXO_META[openCxo].color}1a`;
                            (e.currentTarget as HTMLElement).style.borderColor = `${CXO_META[openCxo].color}55`;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                          }}
                        >
                          <span style={{ flex: 1, minWidth: 0 }}>{task}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 800, color: CXO_META[openCxo].color,
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            flexShrink: 0,
                          }}>
                            <Sparkles size={10} />任せる
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* アクティブ タスクの詳細ログ */}
            {activeTask && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginBottom: 6, letterSpacing: '0.06em' }}>
                  実行ログ
                </div>
                <TaskLogList task={activeTask} />
              </div>
            )}

            {/* つまずいたタスク — 黙って消さず「やり直す」で救済 */}
            {!activeTask && failedTask && (
              <div style={{
                padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.04)',
                background: 'linear-gradient(180deg, rgba(220,38,38,0.10) 0%, transparent 100%)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
                  fontSize: 10.5, color: '#FCA5A5', letterSpacing: '0.06em', fontWeight: 700,
                }}>
                  <AlertTriangle size={12} /> つまずいたタスク
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  {failedTask.title}
                </div>
                {(() => {
                  const fs = failedTask.steps.find(s => s.status === 'failed');
                  return fs?.error ? (
                    <div style={{
                      fontSize: 11.5, color: '#FCA5A5', lineHeight: 1.5, marginBottom: 8,
                      padding: '5px 8px', borderRadius: 6,
                      background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)',
                    }}>
                      {cxoDisplayName(fs.cxo)} のところで止まりました — {fs.error}
                    </div>
                  ) : null;
                })()}
                <TaskLogList task={failedTask} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => retry(failedTask.id)}
                    style={{
                      flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                      background: 'linear-gradient(135deg, #F59E0B, #DC2626)',
                      border: 'none', color: '#fff', fontSize: 13, fontWeight: 800,
                      boxShadow: '0 4px 14px rgba(220,38,38,0.35)',
                    }}
                  >
                    <RotateCcw size={14} /> やり直す
                  </button>
                  <button
                    type="button"
                    onClick={() => reject(failedTask.id)}
                    style={{
                      padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    取り消す
                  </button>
                </div>
              </div>
            )}

            {/* 完了履歴 */}
            {!activeTask && !failedTask && recentDone.length > 0 && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginBottom: 6, letterSpacing: '0.06em' }}>
                  最近完了したタスク
                </div>
                {recentDone.slice(0, 3).map(t => (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 0',
                    fontSize: 12, color: 'rgba(255,255,255,0.8)',
                  }}>
                    <Check size={12} color="#10B981" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {t.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                      {t.steps.filter(s => s.status === 'done').length} 名稼働
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 待機中の補助 — 完了がまだ 0 件の人向け */}
            {!activeTask && !failedTask && counts.proposed === 0 && recentDone.length === 0 && (
              <div style={{
                padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.6,
                background: `linear-gradient(180deg, ${accent}05 0%, transparent 100%)`,
              }}>
                👆 上の役員アイコンを<strong style={{ color: accent }}>タップ</strong>すると、すぐ仕事を渡せます。
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </>
  );
}

/** ヘッダ内の rotation テキスト (fade) */
function RotatingWatchPhrase({ phrase, tick }: { phrase: string; tick: number }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={tick}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'inline-block' }}
      >
        {phrase}
      </motion.span>
    </AnimatePresence>
  );
}

// 各 CXO の作業を「ツール呼出し風」に見せるアクション辞書
// (Claude Code が "Read", "Edit", "Bash" を見せるように、CXO ごとに動詞を割り当て)
const CXO_TOOL_VERBS: Record<CxoRole, string[]> = {
  CEO: ['戦略を整理', '優先順を決定', '判断軸を確認'],
  CTO: ['コードを読む', 'ファイルを編集', 'ビルドを確認'],
  CPO: ['仕様を整理', 'UI 案を比較', 'ユーザー導線を検証'],
  CDO: ['カラーを選定', 'コンポーネントを磨き', 'ブランド統一を確認'],
  CMO: ['コピーを生成', 'チャネルを選定', 'A/B 案を比較'],
  CSO: ['案件をスコアリング', 'リードリストを参照', '提案文を作成'],
  CFO: ['数字を集計', '利益率を計算', '予測モデルを構築'],
  COO: ['ファイルを整理', 'タスクを並べ替え', '進捗を集計'],
  CDS: ['データを読込', 'パターンを発見', '統計を計算'],
  CLO: ['規約を確認', 'リスクを評価', '条文を生成'],
  UIE: ['CSS を整える', 'アニメを微調整', 'アクセシビリティを点検'],
  UXE: ['動線を試行', '操作感を測定', '改善案を発想'],
  QAE: ['ケースを実行', 'バグを再現', 'リグレッションを点検'],
  CHR: ['求人票を最適化', '応募率を試算', '採用相場を調査'],
};

function formatElapsed(startIso?: string, endIso?: string): string {
  if (!startIso) return '';
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const sec = Math.max(0, Math.round((end - start) / 1000));
  // 5 分以上「実行中」のものは stuck と判断 (オーナー報告 2026-06-03: 9555 分 21 秒)
  // 数字を見せず「再開待ち」と表示
  if (!endIso && sec > 300) return '再開待ち';
  if (sec < 60) return `${sec} 秒`;
  const min = Math.floor(sec / 60);
  return `${min}分${sec % 60}秒`;
}

function ThinkingStream({ cxo }: { cxo: CxoRole }) {
  const [idx, setIdx] = useState(0);
  const verbs = CXO_TOOL_VERBS[cxo] || ['作業中'];
  useEffect(() => {
    const t = window.setInterval(() => setIdx(i => i + 1), 1800);
    return () => window.clearInterval(t);
  }, []);
  const verb = verbs[idx % verbs.length];
  const meta = CXO_META[cxo];
  return (
    <motion.div
      key={verb}
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        marginTop: 4,
        fontSize: 10.5,
        color: meta.color,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
        background: meta.color,
        animation: 'atm-pulse 1.2s ease-in-out infinite',
      }} />
      <span>$ {verb}…</span>
    </motion.div>
  );
}

function TaskLogList({ task }: { task: AgentTask }) {
  // 1 秒ごとに再描画して「実行中 X 秒」を更新
  const [, force] = useState(0);
  useEffect(() => {
    if (task.status !== 'running') return;
    const t = window.setInterval(() => force(x => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [task.status]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {task.steps.map((s, i) => {
        const meta = CXO_META[s.cxo];
        const isWorking = s.status === 'working';
        const isDone = s.status === 'done';
        const isFailed = s.status === 'failed';
        const elapsed = formatElapsed(s.startedAt, s.finishedAt);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '6px 8px', borderRadius: 10,
              background: isWorking
                ? `linear-gradient(90deg, ${meta.color}18, ${meta.color}05)`
                : isDone
                  ? 'rgba(16,185,129,0.05)'
                  : isFailed
                    ? 'rgba(220,38,38,0.08)'
                    : 'transparent',
              border: isWorking
                ? `1px solid ${meta.color}44`
                : isDone
                  ? '1px solid rgba(16,185,129,0.15)'
                  : isFailed
                    ? '1px solid rgba(220,38,38,0.30)'
                    : '1px solid transparent',
              fontSize: 12, lineHeight: 1.45,
            }}
          >
            <span style={{
              fontSize: 13, color: meta.color, fontWeight: 800,
              width: 24, textAlign: 'center',
              filter: !isWorking && !isDone && !isFailed ? 'grayscale(0.7) opacity(0.5)' : 'none',
            }}>
              {meta.emoji}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: isFailed ? '#FCA5A5' : isDone ? 'rgba(255,255,255,0.7)' : isWorking ? '#fff' : 'rgba(255,255,255,0.45)',
                fontWeight: isWorking ? 700 : 500,
                display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em',
                  padding: '1px 5px', borderRadius: 4,
                  background: `${meta.color}22`, color: meta.color,
                }}>
                  {meta.shortLabel}
                </span>
                <span>{s.label}</span>
                {isFailed ? (
                  <span style={{ fontSize: 10, color: '#FCA5A5', fontWeight: 700 }}>失敗</span>
                ) : elapsed && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    {isDone ? `✓ ${elapsed}` : `実行中 ${elapsed}`}
                  </span>
                )}
              </div>
              {isWorking && <ThinkingStream cxo={s.cxo} />}
              {isDone && s.output && (
                <div style={{
                  marginTop: 4,
                  padding: '5px 8px',
                  background: 'rgba(0,0,0,0.25)',
                  borderLeft: `2px solid ${meta.color}`,
                  borderRadius: 4,
                  fontSize: 11.5,
                  color: 'rgba(255,255,255,0.82)',
                  fontFamily: 'inherit',
                }}>
                  → {s.output}
                </div>
              )}
              {isFailed && s.error && (
                <div style={{
                  marginTop: 4,
                  padding: '5px 8px',
                  background: 'rgba(220,38,38,0.12)',
                  borderLeft: '2px solid #DC2626',
                  borderRadius: 4,
                  fontSize: 11.5,
                  color: '#FCA5A5',
                  fontFamily: 'inherit',
                }}>
                  ⚠ {s.error}
                </div>
              )}
            </div>
            {isWorking && (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-flex', flexShrink: 0, marginTop: 2 }}
              ><Loader2 size={13} color={meta.color} /></motion.span>
            )}
            {isDone && <Check size={13} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />}
            {isFailed && <AlertTriangle size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />}
          </motion.div>
        );
      })}
      <style>{`
        @keyframes atm-pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
