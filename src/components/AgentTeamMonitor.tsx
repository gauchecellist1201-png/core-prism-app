// ============================================================
// AgentTeamMonitor — AI 会社 (CEO + CXO 軍団) の「作戦本部」表示
//
// ユーザーは画面のどこかに常にこれが見えていて、
// 「いま CXO 何人が動いているか」「誰がどの段階にいるか」が一目で分かる。
// まるで会社の管制塔のように、AI エージェントが並列で働く様子を可視化する。
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Check, Loader2 } from 'lucide-react';
import { useAgentTaskQueue, CXO_META, type CxoRole, type AgentTask } from '../hooks/useAgentTaskQueue';

interface Props {
  /** Iris か Prism — Iris は dock 上、Prism は別位置 */
  brand?: 'prism' | 'iris';
  /** 折りたたみ状態の初期値 */
  initialOpen?: boolean;
}

export default function AgentTeamMonitor({ brand = 'prism', initialOpen = false }: Props) {
  const { activeTask, recentDone, counts } = useAgentTaskQueue();
  const [open, setOpen] = useState<boolean>(initialOpen || !!activeTask);

  // 動いている CXO を抽出 (最新の working ステップから)
  const workingCxo: CxoRole | null = activeTask?.steps.find(s => s.status === 'working')?.cxo || null;
  const accent = brand === 'iris' ? '#E1306C' : '#A78BFA';

  // 何も動いていないとき: 静かなアイドル表示
  const hasActivity = !!activeTask || counts.proposed > 0 || counts.running > 0;

  return (
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
            ) : '🏛'}
          </div>
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', color: accent }}>
              {activeTask ? 'IN PROGRESS' : counts.proposed > 0 ? 'AWAITING APPROVAL' : 'STANDBY'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeTask?.title || (counts.proposed > 0 ? `${counts.proposed} 件の提案待ち` : 'AI 軍団は待機中')}
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
            {/* CXO アバター 13 個並び — 動いてる人が光る */}
            <div style={{
              padding: '10px 12px',
              display: 'flex', flexWrap: 'wrap', gap: 6,
              background: 'rgba(255,255,255,0.02)',
            }}>
              {(Object.keys(CXO_META) as CxoRole[]).map((cxo) => {
                const isWorking = workingCxo === cxo;
                const isDoneOnActive = !!activeTask?.steps.find(s => s.cxo === cxo && s.status === 'done');
                const meta = CXO_META[cxo];
                return (
                  <motion.div
                    key={cxo}
                    animate={isWorking ? {
                      scale: [1, 1.12, 1],
                      boxShadow: [
                        `0 0 0 ${meta.color}66`,
                        `0 0 12px ${meta.color}`,
                        `0 0 0 ${meta.color}66`,
                      ],
                    } : { scale: 1 }}
                    transition={isWorking ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                    title={`${meta.name} — ${meta.tagline}`}
                    style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: isWorking
                        ? `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`
                        : isDoneOnActive
                          ? `${meta.color}33`
                          : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isWorking ? meta.color : isDoneOnActive ? meta.color + '55' : 'rgba(255,255,255,0.08)'}`,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13,
                      cursor: 'help',
                      transition: 'background 0.2s, border 0.2s',
                      position: 'relative',
                    }}
                    aria-label={`${meta.name}: ${isWorking ? '実行中' : isDoneOnActive ? '完了' : '待機'}`}
                  >
                    <span style={{
                      filter: !isWorking && !isDoneOnActive ? 'grayscale(0.8) opacity(0.55)' : 'none',
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
                );
              })}
            </div>

            {/* アクティブ タスクの詳細ログ */}
            {activeTask && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginBottom: 6, letterSpacing: '0.06em' }}>
                  実行ログ
                </div>
                <TaskLogList task={activeTask} />
              </div>
            )}

            {/* 完了履歴 (最大 3 件、コンパクト) */}
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

            {/* 待機中の控えめ表示 */}
            {!activeTask && counts.proposed === 0 && recentDone.length === 0 && (
              <div style={{
                padding: '14px', textAlign: 'center',
                color: 'rgba(255,255,255,0.5)', fontSize: 11.5, lineHeight: 1.6,
              }}>
                提案を承認すると、ここで AI 軍団が並列に動き出します
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
