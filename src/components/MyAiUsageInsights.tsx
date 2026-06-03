// ============================================================
// MyAiUsageInsights — ユーザー自身向け「あなたの AI 利用状況」カード
//
// オーナー指示 (2026-06-04 第 20 波 XXX):
//   Master 専用ではなく、一般ユーザーが「今月 何度 AI に頼んだか」
//   「何が一番多いタスクか」を見られる小さなカード。
//
// データ源:
//   - settings.usageStats (既存 — 累計トークン / コスト見積)
//   - core_agent_task_queue_v1 (タスク履歴) を CXO 別 集計
//   - core_mobile_gemini_v1:<personaId> 件数 (会話数)
// ============================================================

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Brain, MessageSquare, TrendingUp, Sparkles } from 'lucide-react';
import type { AppSettings } from '../types/identity';
import { CXO_META, cxoDisplayName, type CxoRole, type AgentTask } from '../hooks/useAgentTaskQueue';

interface Props {
  settings: AppSettings;
}

function startOfMonth(): number {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function loadTasks(): AgentTask[] {
  try {
    const raw = localStorage.getItem('core_agent_task_queue_v1');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function countChatMessages(): number {
  // 全ペルソナの会話履歴件数を合算
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('core_mobile_gemini_v1:')) continue;
      try {
        const arr = JSON.parse(localStorage.getItem(k) || '[]');
        if (Array.isArray(arr)) total += arr.length;
      } catch { /* */ }
    }
  } catch { /* */ }
  return total;
}

export default function MyAiUsageInsights({ settings }: Props) {
  const { calls, tokensIn, costYen, monthlyTasksDone, topCxos, chatMsgs } = useMemo(() => {
    const stats = settings?.usageStats || ({ totalMessages: 0, totalTokensUsed: 0, estimatedCostUsd: 0, lastReset: '' } as AppSettings['usageStats']);
    const totalReq = Number(stats.totalMessages) || 0;
    const totalTok = Number(stats.totalTokensUsed) || 0;
    const cost = Math.round((Number(stats.estimatedCostUsd) || 0) * 150);

    const startMs = startOfMonth();
    const tasks = loadTasks();
    const monthly = tasks.filter(t => {
      const proposed = Date.parse(t.proposedAt);
      const completed = t.completedAt ? Date.parse(t.completedAt) : 0;
      return (Number.isFinite(proposed) && proposed >= startMs)
          || (Number.isFinite(completed) && completed >= startMs);
    });
    const done = monthly.filter(t => t.status === 'done');

    // CXO 別 完了集計
    const byCxo: Record<string, number> = {};
    for (const t of done) {
      for (const s of t.steps) {
        if (s.status === 'done') byCxo[s.cxo] = (byCxo[s.cxo] || 0) + 1;
      }
    }
    const top = Object.entries(byCxo)
      .map(([cxo, count]) => ({ cxo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      calls: totalReq,
      tokensIn: totalTok,
      costYen: cost,
      monthlyTasksDone: done.length,
      topCxos: top,
      chatMsgs: countChatMessages(),
    };
  }, [settings]);

  // 月初リセットされていない可能性を考えると累計表示。表記には「累計」と明示。
  const accent = '#A78BFA';
  const maxCount = topCxos[0]?.count || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        padding: '1rem 1.15rem',
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(167,139,250,0.10), rgba(244,114,182,0.08))',
        border: `1px solid ${accent}33`,
        color: 'var(--fg)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div aria-hidden style={{
        position: 'absolute', top: -36, right: -36, width: 160, height: 160,
        borderRadius: '50%', filter: 'blur(36px)',
        background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${accent}, #F472B6)`,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Brain size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.65rem', letterSpacing: '0.25em', fontWeight: 800, color: accent, textTransform: 'uppercase' }}>
            MY AI USAGE
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--fg)' }}>
            あなたの AI 利用状況 (累計)
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6,
        marginBottom: 12,
      }}>
        <Cell
          icon={<MessageSquare size={11} />}
          label="呼び出し"
          value={calls.toLocaleString()}
          color={accent}
        />
        <Cell
          icon={<Sparkles size={11} />}
          label="トークン"
          value={tokensIn.toLocaleString()}
          color="#F472B6"
        />
        <Cell
          icon={<Brain size={11} />}
          label="会話メッセージ"
          value={chatMsgs.toLocaleString()}
          color="#34D399"
        />
        <Cell
          icon={<TrendingUp size={11} />}
          label="今月の完了"
          value={String(monthlyTasksDone)}
          color="#FBBF24"
        />
      </div>

      {topCxos.length > 0 && (
        <div>
          <div style={{
            fontSize: 11, letterSpacing: '0.15em',
            fontWeight: 700, color: 'var(--fg-muted)',
            marginBottom: 8,
          }}>
            今月 一番頼った 4 役員
          </div>
          {topCxos.map((c) => {
            const meta = CXO_META[c.cxo as CxoRole];
            const w = Math.round((c.count / maxCount) * 100);
            return (
              <div key={c.cxo} style={{ marginBottom: 6 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontWeight: 700, marginBottom: 3,
                }}>
                  <span style={{ fontSize: 14 }}>{meta.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cxoDisplayName(c.cxo as CxoRole)}
                  </span>
                  <span style={{ color: meta.color, fontWeight: 800 }}>×{c.count}</span>
                </div>
                <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${w}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{
                      height: 4, borderRadius: 999,
                      background: `linear-gradient(90deg, ${meta.color}, #F472B6)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        marginTop: 12,
        padding: '8px 12px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        fontSize: '0.72rem',
        color: 'var(--fg-muted)',
        lineHeight: 1.7,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      }}>
        <span>今月の AI 利用 推定コスト</span>
        <strong style={{ color: 'var(--fg)', fontVariantNumeric: 'tabular-nums', fontSize: '0.85rem' }}>
          ¥{costYen.toLocaleString()}
        </strong>
      </div>
    </motion.div>
  );
}

function Cell({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '8px 10px',
      borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}22`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 10, color: 'var(--fg-muted)', fontWeight: 700, marginBottom: 2,
      }}>
        {icon} {label}
      </div>
      <div style={{
        fontSize: '1.1rem', fontWeight: 900, color,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
      }}>{value}</div>
    </div>
  );
}
