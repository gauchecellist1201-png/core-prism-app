import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AgentProposalCardProps {
  icon: string;
  title: string;
  reason: string;
  draft: string;
  accentColor?: string;
  meta?: string;
  approveLabel?: string;
  onApprove: () => void;
  onRefine: (instruction: string) => void;
  onDismiss: () => void;
  busy?: boolean;
}

/**
 * 13 全エージェント共通の提案カード。
 *
 * 設計思想 (オーナー指示 2026-05-16):
 * - AI が先回りで提案・下書きを完成形まで渡す
 * - ユーザーの操作は 3 つだけ: 「✓ 承認」「✏️ 直す」「✗ 却下」
 * - 入力フォームは置かない (= Google 検索と同じになるから)
 */
export default function AgentProposalCard({
  icon,
  title,
  reason,
  draft,
  accentColor = '#A78BFA',
  meta,
  approveLabel = '✓ 承認して実行',
  onApprove,
  onRefine,
  onDismiss,
  busy,
}: AgentProposalCardProps) {
  const [editing, setEditing] = useState(false);
  const [instruction, setInstruction] = useState('');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, x: -16 }}
      className="cp-card-section cp-stack-sm"
      style={{ borderColor: accentColor + '30' }}
    >
      <div className="cp-row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <div
          className="rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            width: 44,
            height: 44,
            background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}11)`,
            color: accentColor,
            fontWeight: 700,
            fontSize: '1.3rem',
            border: `1px solid ${accentColor}44`,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0" style={{ flex: 1 }}>
          <p className="cp-h3" style={{ marginBottom: 2 }}>{title}</p>
          <p className="cp-meta" style={{ marginBottom: 0 }}>{reason}</p>
          {meta && <p className="cp-tiny" style={{ marginTop: 4 }}>{meta}</p>}
        </div>
      </div>

      <div
        className="rounded-md"
        style={{
          padding: '10px 12px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          fontSize: '0.85rem',
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
          color: 'var(--fg)',
          maxHeight: 240,
          overflowY: 'auto',
        }}
      >
        {draft}
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="cp-stack-sm"
            style={{ overflow: 'hidden' }}
          >
            <p className="cp-meta">どこを直してほしい？ 1 行で書いてください (AI が直して再生成します)</p>
            <textarea
              className="cp-textarea"
              placeholder="例: もう少し柔らかい言葉に / 数字を強調 / 別の切り口で"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              style={{ minHeight: 56 }}
            />
            <div className="cp-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setEditing(false); setInstruction(''); }}
                className="cp-btn cp-btn-ghost cp-btn-sm"
              >
                やめる
              </button>
              <button
                disabled={!instruction.trim() || busy}
                onClick={() => { onRefine(instruction.trim()); setEditing(false); setInstruction(''); }}
                className="cp-btn cp-btn-primary cp-btn-sm"
                style={{ background: accentColor, color: '#0a0a0f' }}
              >
                {busy ? '🧠 直してる…' : '✏️ これで直す'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!editing && (
        <div className="cp-row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            onClick={onDismiss}
            disabled={busy}
            className="cp-btn cp-btn-ghost cp-btn-sm"
            title="この提案を消す"
          >
            ✗ 却下
          </button>
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="cp-btn cp-btn-sm"
          >
            ✏️ 直す
          </button>
          <button
            onClick={onApprove}
            disabled={busy}
            className="cp-btn cp-btn-primary cp-btn-sm"
            style={{ background: accentColor, color: '#0a0a0f' }}
          >
            {approveLabel}
          </button>
        </div>
      )}
    </motion.div>
  );
}
