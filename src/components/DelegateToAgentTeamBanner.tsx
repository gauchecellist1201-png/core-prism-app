// ============================================================
// DelegateToAgentTeamBanner — 全 Studio モーダルに常設する「AI 会社に任せる」バナー
//
// 設計指針 (2026-05-25 オーナー指示):
//  - 「楽できるビジョン」「ユーザーは承認するだけ、AI 会社が動く」を全機能で一貫表示
//  - 全 Studio のヘッダ直下に同じ見た目で並ぶ
//  - 「任せる」を押すと propose() + 200ms 後に approve() → AgentTeamMonitor が膨らんで動く
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Users, Check } from 'lucide-react';
import { useAgentTaskQueue, CXO_META, type CxoRole } from '../hooks/useAgentTaskQueue';

interface Props {
  /** AI 会社に依頼するタスクの 1 行タイトル */
  taskTitle: string;
  /** どの CXO に動いてもらうか (1 〜 3 名推奨) */
  suggestedCxos: CxoRole[];
  /** なぜこのタスクが必要か (proposal の why に入る) */
  why?: string;
  /** タスクの概要 (proposal の summary に入る。未指定なら CXO 名から自動生成) */
  summary?: string;
  /** 期待される成果 / KPI */
  expected?: string;
  /** ブランド (color hint) — Prism は紫、Iris はピンク */
  brand?: 'prism' | 'iris';
}

export default function DelegateToAgentTeamBanner({
  taskTitle,
  suggestedCxos,
  why,
  summary,
  expected,
  brand = 'prism',
}: Props) {
  const { propose, approve } = useAgentTaskQueue();
  const [proposed, setProposed] = useState(false);

  const accent = brand === 'iris' ? '#E1306C' : '#A78BFA';
  const safeCxos = suggestedCxos.length > 0 ? suggestedCxos : (['COO'] as CxoRole[]);

  const handleDelegate = () => {
    if (proposed) return;
    // 重複承認防止のためまず UI を確定
    setProposed(true);

    const cxoNames = safeCxos.map(c => CXO_META[c]?.shortLabel || c).join(' + ');
    const autoSummary = summary || `${cxoNames} が即実行します`;

    const steps = safeCxos.map(cxo => ({
      cxo,
      label: `${CXO_META[cxo]?.shortLabel || cxo} が「${taskTitle}」を進める`,
    }));
    // QAE で最後に点検 (重複しない場合のみ)
    if (!safeCxos.includes('QAE')) {
      steps.push({ cxo: 'QAE' as CxoRole, label: '結果を点検して報告' });
    }

    const proposal = propose({
      title: taskTitle,
      summary: autoSummary,
      why: why || `あなたが Studio から AI 会社に任せたタスクです`,
      expected,
      steps,
    });

    // AgentTeamMonitor を開く合図 + 自動承認で即実行
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('core:agent-monitor-open', { detail: { taskId: proposal.id } }));
      approve(proposal.id);
    }, 200);

    // 5 秒後にバナー自体は再度押せる状態に戻す (連投したい人向け)
    setTimeout(() => setProposed(false), 5000);
  };

  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 14px',
        background: `linear-gradient(90deg, ${accent}14 0%, ${accent}06 60%, transparent 100%)`,
        borderBottom: '1px solid var(--border)',
        minHeight: 56,
      }}
      role="region"
      aria-label="AI 会社に任せる"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: 34, height: 34, borderRadius: 10,
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0,
            boxShadow: `0 0 16px ${accent}55`,
          }}
          aria-hidden
        >
          <Users size={16} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em',
              color: accent, textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Sparkles size={11} /> 13 名の AI 役員が代わりに動けます
          </div>
          <div
            style={{
              fontSize: 12.5, fontWeight: 600, color: 'var(--fg)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginTop: 2,
            }}
            title={taskTitle}
          >
            {taskTitle}
          </div>
        </div>
      </div>

      <motion.button
        type="button"
        onClick={handleDelegate}
        disabled={proposed}
        whileTap={proposed ? {} : { scale: 0.97 }}
        whileHover={proposed ? {} : { scale: 1.02 }}
        style={{
          flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px',
          minHeight: 40,
          borderRadius: 999,
          border: 'none',
          background: proposed
            ? '#10B981'
            : `linear-gradient(135deg, ${accent}, ${accent}dd)`,
          color: '#fff',
          fontSize: 12.5, fontWeight: 800, letterSpacing: '0.02em',
          cursor: proposed ? 'default' : 'pointer',
          boxShadow: proposed
            ? '0 4px 12px rgba(16,185,129,0.35)'
            : `0 4px 14px ${accent}66`,
          transition: 'background 0.25s, box-shadow 0.25s',
        }}
        aria-label="AI 会社にこのタスクを任せる"
      >
        {proposed ? (
          <>
            <Check size={13} strokeWidth={3} /> 任せた
          </>
        ) : (
          <>
            任せる <span aria-hidden>→</span>
          </>
        )}
      </motion.button>
    </motion.div>
  );
}
