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
import { ChevronUp, ChevronDown, Check, Loader2, Sparkles, X } from 'lucide-react';
import { useAgentTaskQueue, CXO_META, type CxoRole, type AgentTask } from '../hooks/useAgentTaskQueue';
import { useCelebrate } from '../hooks/useCelebrate';

interface Props {
  /** Iris か Prism — Iris は dock 上、Prism は別位置 */
  brand?: 'prism' | 'iris';
  /** 折りたたみ状態の初期値 */
  initialOpen?: boolean;
}

const WATCH_ROTATE_MS = 4500;

export default function AgentTeamMonitor({ brand = 'prism', initialOpen = false }: Props) {
  const { activeTask, recentDone, counts, propose, approve } = useAgentTaskQueue();
  const { celebrate, CelebratePortal } = useCelebrate();
  const [open, setOpen] = useState<boolean>(initialOpen || !!activeTask);
  const [openCxo, setOpenCxo] = useState<CxoRole | null>(null);
  const [watchTick, setWatchTick] = useState(0);

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
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('core:agent-monitor-open', onOpen as EventListener);
    return () => window.removeEventListener('core:agent-monitor-open', onOpen as EventListener);
  }, []);

  const accent = brand === 'iris' ? '#E1306C' : '#A78BFA';
  const workingCxo: CxoRole | null = activeTask?.steps.find(s => s.status === 'working')?.cxo || null;
  const hasActivity = !!activeTask || counts.proposed > 0 || counts.running > 0;

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

  // CXO クリックで「任せること」を選んで承認 → propose + auto-approve
  const assignToCxo = (role: CxoRole, task: string) => {
    const meta = CXO_META[role];
    const proposal = propose({
      title: task,
      summary: `${meta.name} が即実行します`,
      why: `あなたが ${meta.shortLabel} に直接依頼したタスクです`,
      steps: [
        { cxo: role, label: task },
        ...(role !== 'QAE' ? [{ cxo: 'QAE' as CxoRole, label: '結果を点検' }] : []),
      ],
    });
    setTimeout(() => approve(proposal.id), 200);
    setOpenCxo(null);
    if (!open) setOpen(true);
  };

  return (
    <>
    {CelebratePortal}
    <motion.div
      initial={false}
      animate={{ height: open ? 'auto' : 56 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        right: 'max(14px, env(safe-area-inset-right, 0px))',
        width: 'min(380px, calc(100vw - 28px))',
        zIndex: 60,
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
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#fff',
            boxShadow: hasActivity ? `0 0 16px ${accent}88` : 'none',
            flexShrink: 0,
          }}>
            {activeTask ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-flex' }}
              ><Loader2 size={16} /></motion.span>
            ) : watchInfo ? (
              <span style={{ fontSize: 14 }}>{watchInfo.meta.emoji}</span>
            ) : '🏛'}
          </div>
          <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: accent }}>
              {activeTask ? 'IN PROGRESS'
                : counts.proposed > 0 ? 'AWAITING APPROVAL'
                : 'AI 会社 稼働中'}
            </div>
            <div style={{
              fontSize: 12.5, fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {activeTask?.title
                ? activeTask.title
                : counts.proposed > 0
                  ? `${counts.proposed} 件の提案待ち`
                  : watchInfo
                    ? <RotatingWatchPhrase phrase={`${watchInfo.meta.shortLabel} が ${watchInfo.phrase}`} tick={watchTick} />
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
          {open ? <ChevronDown size={16} color="rgba(255,255,255,0.5)" /> : <ChevronUp size={16} color="rgba(255,255,255,0.5)" />}
        </div>
      </button>

      {/* 展開時: CXO 列 + 詳細ログ */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
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
                          {CXO_META[openCxo].name}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>
                          {CXO_META[openCxo].tagline}
                        </div>
                      </div>
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

            {/* 完了履歴 */}
            {!activeTask && recentDone.length > 0 && (
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
            {!activeTask && counts.proposed === 0 && recentDone.length === 0 && (
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

function TaskLogList({ task }: { task: AgentTask }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {task.steps.map((s, i) => {
        const meta = CXO_META[s.cxo];
        const isWorking = s.status === 'working';
        const isDone = s.status === 'done';
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 6px', borderRadius: 8,
            background: isWorking ? `${meta.color}10` : 'transparent',
            fontSize: 12, lineHeight: 1.4,
          }}>
            <span style={{ fontSize: 11, color: meta.color, fontWeight: 800, minWidth: 30 }}>
              {meta.emoji}
            </span>
            <span style={{ flex: 1, minWidth: 0, color: isDone ? 'rgba(255,255,255,0.55)' : '#fff' }}>
              {s.label}
              {isDone && s.output && (
                <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 6, fontSize: 11 }}>
                  → {s.output}
                </span>
              )}
            </span>
            {isWorking && (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-flex' }}
              ><Loader2 size={12} color={meta.color} /></motion.span>
            )}
            {isDone && <Check size={12} color="#10B981" />}
          </div>
        );
      })}
    </div>
  );
}
