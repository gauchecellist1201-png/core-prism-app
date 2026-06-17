// ============================================================
// ProposalCard — AI 会社が「次にやるべきこと」を提案するカード
// ユーザーは [承認] [却下] [指示変更] の 3 ボタンで応答する
// 承認した瞬間に AgentTeamMonitor に投入され、CXO 軍団が動き出す
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, MessageSquare, Sparkles, Clock, Target } from 'lucide-react';
import { useAgentTaskQueue, CXO_META, type ProposalDraft } from '../hooks/useAgentTaskQueue';

interface Props {
  proposal: ProposalDraft;
  /** Iris / Prism — テーマカラー */
  brand?: 'prism' | 'iris';
  /** 承認したあとに親で何かする (任意) */
  onApproved?: () => void;
  /** 「指示変更」(自然文で再生成依頼) ボタンの動作 (任意) */
  onCustomize?: () => void;
  /** 既に承認・実行中なら同じ提案を再投入しない */
  dedupeKey?: string;
}

export default function ProposalCard({ proposal, brand = 'prism', onApproved, onCustomize, dedupeKey }: Props) {
  const { propose, approve, reject, tasks } = useAgentTaskQueue();
  const [state, setState] = useState<'idle' | 'approving' | 'rejected'>('idle');

  const accent = brand === 'iris' ? '#E1306C' : '#A78BFA';
  // Iris は淡色テーマ → 濃文字。Prism はダーク → 白文字。(白地に白文字を防ぐ恒久ルール)
  const isLight = brand === 'iris';
  const ink = isLight ? '#1A0A26' : '#fff';
  const body = isLight ? '#3A2A4A' : 'rgba(255,255,255,0.85)';
  const muted = isLight ? '#8A7AA0' : 'rgba(255,255,255,0.5)';
  const hair = isLight ? 'rgba(42,26,58,0.10)' : 'rgba(255,255,255,0.06)';
  const ghostBg = isLight ? 'rgba(42,26,58,0.05)' : 'rgba(255,255,255,0.06)';
  const ghostBorder = isLight ? 'rgba(42,26,58,0.12)' : 'rgba(255,255,255,0.10)';
  const ghostInk = isLight ? '#5A4570' : 'rgba(255,255,255,0.65)';

  // 同じ提案が既にキューに入っているか
  const existing = dedupeKey ? tasks.find(t => t.id.endsWith(dedupeKey)) : null;
  const alreadyApproved: boolean = !!(existing && (existing.status === 'running' || existing.status === 'done'));

  const handleApprove = () => {
    if (alreadyApproved || state !== 'idle') return;
    setState('approving');
    const t = propose(proposal);
    // すぐ承認 → 実行
    window.setTimeout(() => {
      approve(t.id);
      onApproved?.();
    }, 300);
  };

  const handleReject = () => {
    setState('rejected');
    if (existing) reject(existing.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: `linear-gradient(135deg, ${accent}1A 0%, ${accent}08 100%)`,
        border: `1px solid ${accent}44`,
        borderRadius: 16,
        padding: '14px 16px',
        color: ink,
      }}
      role="region"
      aria-label="AI 会社からの提案"
    >
      {/* eyebrow */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 10, letterSpacing: '0.22em', fontWeight: 800,
        color: accent, marginBottom: 6, textTransform: 'uppercase',
      }}>
        <Sparkles size={11} /> AI 会社からの提案
      </div>

      {/* タイトル + 期限 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <h3 style={{
          flex: 1, fontSize: 16, fontWeight: 900,
          color: ink, margin: 0, lineHeight: 1.4,
          letterSpacing: '-0.01em',
        }}>{proposal.title}</h3>
        {proposal.dueDays && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10.5, fontWeight: 800,
            background: `${accent}22`, color: accent,
            padding: '3px 8px', borderRadius: 999, flexShrink: 0,
          }}>
            <Clock size={10} /> {proposal.dueDays}日以内
          </span>
        )}
      </div>

      {/* 概要 */}
      <p style={{ fontSize: 12.5, color: body, margin: '0 0 8px', lineHeight: 1.65 }}>
        {proposal.summary}
      </p>

      {/* なぜ */}
      {proposal.why && (
        <div style={{
          fontSize: 11.5, color: body, lineHeight: 1.6,
          marginBottom: 6,
        }}>
          <strong style={{ color: accent }}>なぜ:</strong> {proposal.why}
        </div>
      )}

      {/* 期待効果 */}
      {proposal.expected && (
        <div style={{
          fontSize: 11.5, color: '#10B981', lineHeight: 1.6,
          marginBottom: 10, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <Target size={11} /> {proposal.expected}
        </div>
      )}

      {/* 関与 CXO のチップ列 — 「誰が動くか」を見せる */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4,
        marginBottom: 12,
        padding: '6px 0',
        borderTop: `1px solid ${hair}`,
        borderBottom: `1px solid ${hair}`,
      }}>
        <span style={{ fontSize: 10, color: muted, marginRight: 4, alignSelf: 'center' }}>
          動く CXO ({proposal.steps.length} 名):
        </span>
        {proposal.steps.map((step, i) => {
          const meta = CXO_META[step.cxo];
          return (
            <span key={i} title={`${meta.name} — ${step.label}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 700,
                background: `${meta.color}18`,
                color: meta.color,
                border: `1px solid ${meta.color}33`,
                padding: '2px 7px', borderRadius: 999,
              }}>
              {meta.emoji} {step.cxo}
            </span>
          );
        })}
      </div>

      {/* アクションボタン */}
      <div style={{ display: 'flex', gap: 6 }}>
        <motion.button
          type="button"
          onClick={handleApprove}
          disabled={state !== 'idle' || alreadyApproved}
          whileTap={{ scale: 0.97 }}
          style={{
            flex: 2,
            background: alreadyApproved
              ? 'rgba(16,185,129,0.18)'
              : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            color: alreadyApproved ? '#10B981' : '#fff',
            border: alreadyApproved ? '1px solid #10B98155' : 'none',
            borderRadius: 12,
            padding: '12px 14px', fontSize: 13, fontWeight: 800,
            cursor: state === 'idle' && !alreadyApproved ? 'pointer' : 'not-allowed',
            minHeight: 44,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: alreadyApproved ? 'none' : `0 8px 22px ${accent}55`,
          }}
        >
          {alreadyApproved ? <><Check size={14} /> 承認済み — CXO 軍団が動いています</>
            : state === 'approving' ? <><Check size={14} /> 承認しました</>
            : <><Check size={14} /> 承認して実行</>}
        </motion.button>
        <motion.button
          type="button"
          onClick={handleReject}
          disabled={state !== 'idle'}
          whileTap={{ scale: 0.95 }}
          aria-label="却下"
          title="却下"
          style={{
            background: ghostBg,
            border: `1px solid ${ghostBorder}`,
            color: ghostInk,
            borderRadius: 12,
            padding: '0 14px',
            cursor: state === 'idle' ? 'pointer' : 'not-allowed',
            minHeight: 44, minWidth: 44,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><X size={16} /></motion.button>
        {onCustomize && (
          <motion.button
            type="button"
            onClick={onCustomize}
            whileTap={{ scale: 0.95 }}
            aria-label="指示変更"
            title="指示変更"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.65)',
              borderRadius: 12,
              padding: '0 14px',
              cursor: 'pointer',
              minHeight: 44, minWidth: 44,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><MessageSquare size={15} /></motion.button>
        )}
      </div>
    </motion.div>
  );
}
