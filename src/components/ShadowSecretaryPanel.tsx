// ============================================================
// シャドー秘書パネル — AI 事前生成した返信下書き一覧
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona } from '../types/identity';
import type { ShadowDraft } from '../hooks/useShadowSecretary';

interface Props {
  persona: Persona;
  drafts: ShadowDraft[];
  isPolling: boolean;
  lastPolledAt: Date | null;
  onRefresh: () => void;
  onDismiss: (messageId: string) => void;
  onSend: (messageId: string, overrideText?: string) => Promise<void>;
  onClose: () => void;
}

const IMPORTANCE: Record<string, { label: string; color: string }> = {
  high: { label: '🔴 重要', color: '#f87171' },
  mid:  { label: '🟡 通常', color: '#c9a96e' },
  low:  { label: '⚪ 低',   color: '#6b7280' },
  spam: { label: '🚫 迷惑', color: '#4b5563' },
};

export default function ShadowSecretaryPanel({
  persona,
  drafts,
  isPolling,
  lastPolledAt,
  onRefresh,
  onDismiss,
  onSend,
  onClose,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editText,   setEditText]   = useState('');
  const [sendingId,  setSendingId]  = useState<string | null>(null);
  const [sentIds,    setSentIds]    = useState<Set<string>>(new Set());

  const handleSend = async (draft: ShadowDraft) => {
    setSendingId(draft.messageId);
    try {
      const text =
        editingId === draft.messageId ? editText : undefined;
      await onSend(draft.messageId, text);
      setSentIds(prev => new Set([...prev, draft.messageId]));
      setEditingId(null);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '520px' }}
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="cp-modal-header">
          <div className="flex items-center gap-2">
            <span className="text-xl">📬</span>
            <div>
              <p className="text-fg font-semibold text-sm">シャドー秘書</p>
              <p className="text-fg-muted text-xs">
                {isPolling
                  ? '📡 受信トレイ確認中…'
                  : lastPolledAt
                    ? `最終確認 ${lastPolledAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Gmail 取込待機中'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isPolling}
              className="text-xs px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
              style={{
                background: 'var(--surface-3)',
                border: '1px solid var(--border)',
                color: 'var(--fg-muted)',
              }}
            >
              🔄 更新
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-fg text-lg leading-none transition-colors"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="cp-modal-body" style={{ padding: '12px' }}>
          {drafts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">✉️</p>
              <p className="text-fg-muted text-sm">返信が必要なメールがありません</p>
              <p className="text-fg-subtle text-xs mt-1">
                Gmail 接続済みの場合、30 分ごとに自動確認します
              </p>
              <button
                onClick={onRefresh}
                disabled={isPolling}
                className="mt-4 text-sm px-4 py-2 rounded-lg disabled:opacity-40"
                style={{
                  background: persona.accentColorLight,
                  color: persona.accentColor,
                  border: `1px solid ${persona.accentColor}40`,
                }}
              >
                {isPolling ? '確認中…' : '今すぐ確認'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map(draft => {
                const imp       = IMPORTANCE[draft.importance] ?? IMPORTANCE.mid;
                const isExp     = expandedId === draft.messageId;
                const isEditing = editingId  === draft.messageId;
                const isSending = sendingId  === draft.messageId;
                const isSent    = sentIds.has(draft.messageId);
                const senderName = draft.from.replace(/<[^>]+>/, '').trim() || draft.from;

                return (
                  <motion.div
                    key={draft.messageId}
                    layout
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: 'var(--surface-3)',
                      border: `1px solid ${persona.accentColor}20`,
                    }}
                  >
                    {/* Card header row */}
                    <button
                      className="w-full text-left px-3.5 py-3 flex items-start gap-2"
                      onClick={() =>
                        setExpandedId(isExp ? null : draft.messageId)
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs" style={{ color: imp.color }}>
                            {imp.label}
                          </span>
                          <span className="text-fg-muted text-xs truncate max-w-[140px]">
                            {senderName}
                          </span>
                        </div>
                        <p className="text-fg text-sm font-medium truncate">
                          {draft.subject}
                        </p>
                        <p className="text-fg-muted text-xs truncate mt-0.5">
                          {draft.summary}
                        </p>
                      </div>
                      <span className="text-fg-muted text-xs mt-1 flex-shrink-0">
                        {isExp ? '▲' : '▼'}
                      </span>
                    </button>

                    {/* Expanded draft */}
                    <AnimatePresence>
                      {isExp && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3.5 pb-3.5 space-y-3">
                            {/* Progress bar */}
                            <div
                              className="w-full h-1 rounded-full"
                              style={{ background: 'var(--border)' }}
                            >
                              <div
                                className="h-1 rounded-full transition-all duration-500"
                                style={{
                                  width: isSent ? '100%' : '60%',
                                  background: persona.accentColor,
                                }}
                              />
                            </div>

                            {/* Draft text / edit textarea */}
                            {isEditing ? (
                              <textarea
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                className="w-full text-sm text-fg rounded-lg p-2.5 resize-none focus:outline-none"
                                style={{
                                  background: 'var(--bg)',
                                  border: `1px solid ${persona.accentColor}50`,
                                  minHeight: '120px',
                                }}
                              />
                            ) : (
                              <div
                                className="text-sm text-fg-muted rounded-lg p-2.5 whitespace-pre-wrap"
                                style={{
                                  background: 'var(--bg)',
                                  border: '1px solid var(--border)',
                                  maxHeight: '160px',
                                  overflowY: 'auto',
                                }}
                              >
                                {draft.draftText || '(下書きなし)'}
                              </div>
                            )}

                            {/* Action buttons */}
                            {isSent ? (
                              <p
                                className="text-center text-xs font-medium py-1"
                                style={{ color: persona.accentColor }}
                              >
                                ✅ 送信済み
                              </p>
                            ) : (
                              <div className="flex gap-2 flex-wrap">
                                <button
                                  onClick={() => handleSend(draft)}
                                  disabled={isSending}
                                  className="text-xs px-3 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 flex-1 min-w-[80px]"
                                  style={{
                                    background: persona.accentColor,
                                    color: '#0a0a0f',
                                  }}
                                >
                                  {isSending ? '送信中…' : '✉️ 送信'}
                                </button>
                                {isEditing ? (
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="text-xs px-3 py-2 rounded-lg transition-all"
                                    style={{
                                      background: 'var(--surface-3)',
                                      border: '1px solid var(--border)',
                                      color: 'var(--fg-muted)',
                                    }}
                                  >
                                    ✓ 完了
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingId(draft.messageId);
                                      setEditText(draft.draftText);
                                    }}
                                    className="text-xs px-3 py-2 rounded-lg transition-all"
                                    style={{
                                      background: 'var(--surface-3)',
                                      border: '1px solid var(--border)',
                                      color: 'var(--fg-muted)',
                                    }}
                                  >
                                    ✎ 修正
                                  </button>
                                )}
                                <button
                                  onClick={() => onDismiss(draft.messageId)}
                                  className="text-xs px-3 py-2 rounded-lg transition-all"
                                  style={{
                                    background: 'rgba(248,113,113,0.1)',
                                    border: '1px solid rgba(248,113,113,0.3)',
                                    color: '#f87171',
                                  }}
                                >
                                  無視
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="px-4 py-2.5 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p className="text-fg-subtle text-[10px] text-center">
            📬 返信下書きはデバイス内のみ保存 · Gmail トークンは CORE 外に送信されません
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
