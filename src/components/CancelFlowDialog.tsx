// ============================================================
// CancelFlowDialog — 解約前 引き止め + Exit Survey
//
// オーナー指示 (2026-06-04 第 14 波 EEE):
//   Stripe Cancel を叩く前に「停止理由を 1 つ選んでもらう」 Exit Survey。
//   料金が高い / 使い方が分からない / 他のツールに移る / その他 を
//   ワンタップ選択 → サーバ送信 → 解約実行。
//
// 設計:
//   - スキップ可 (右上の × か「理由を選ばずに解約」)
//   - 1 つ選ぶと「もう少し詳しく? (任意)」テキストエリアが現れる
//   - 「解約する」を押すと /api/feedback (kind=exit) に reason + comment を送信
//     → 続いて onConfirmCancel() を呼んで実際の Stripe cancel に進む
//   - フィードバック送信失敗でも解約はブロックしない (fire-and-forget)
// ============================================================

import { useState } from 'react';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, ChevronRight, Heart } from 'lucide-react';

export type ExitReason = 'too_expensive' | 'too_hard' | 'switching' | 'not_useful' | 'other';

interface Props {
  open: boolean;
  brand?: 'prism' | 'iris';
  /** 停止確定 — Stripe cancel を呼ぶ。busy 中は disabled に */
  onConfirmCancel: () => void | Promise<void>;
  onClose: () => void;
  cancelBusy?: boolean;
}

const REASONS: { id: ExitReason; emoji: string; label: string; sub: string }[] = [
  { id: 'too_expensive', emoji: '💸', label: '料金が高い',           sub: '想定より使っていない / 価値を感じない' },
  { id: 'too_hard',      emoji: '😕', label: '使い方が分からない',   sub: '機能が多すぎる / どこから始めれば' },
  { id: 'switching',     emoji: '🔀', label: '他のツールに移る',     sub: 'もっと合う製品が見つかった' },
  { id: 'not_useful',    emoji: '🤷', label: 'いまの自分には不要',   sub: '使うタイミングではない' },
  { id: 'other',         emoji: '✍️', label: 'その他',               sub: '一言だけ伝えたい' },
];

async function postExitSurvey(brand: 'prism' | 'iris', reason: ExitReason, comment: string): Promise<void> {
  try {
    await fetchWithTimeout('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand,
        kind: 'exit',
        exitReason: reason,
        comment,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        ts: Date.now(),
      }),
      keepalive: true,
    });
  } catch { /* fire and forget */ }
}

export default function CancelFlowDialog({ open, brand = 'prism', onConfirmCancel, onClose, cancelBusy = false }: Props) {
  const [selected, setSelected] = useState<ExitReason | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    // フィードバック送信は並行 (失敗しても cancel は続行)
    if (selected) {
      postExitSurvey(brand, selected, comment.trim());
    }
    try {
      await onConfirmCancel();
    } finally {
      setSubmitting(false);
    }
  };

  const skipAndCancel = async () => {
    // 理由を選ばずに解約 (Survey 送信なし)
    setSubmitting(true);
    try { await onConfirmCancel(); } finally { setSubmitting(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 12px',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              maxHeight: 'calc(100vh - 48px)',
              background: '#fff',
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: '1px solid #f1f1f1',
            }}>
              <Heart size={18} color="#E84B97" />
              <div style={{ flex: 1, fontSize: '0.92rem', fontWeight: 800, color: '#1F1A2E' }}>
                解約する前に、ひとこと聞いてもいいですか?
              </div>
              <button
                onClick={onClose}
                aria-label="閉じる"
                style={{
                  width: 30, height: 30, borderRadius: 15,
                  background: '#f4f4f7', border: 'none',
                  color: '#666', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#444', lineHeight: 1.7 }}>
                停止する理由を 1 つ選んでもらえると、次のリリースで必ず改善に使います。
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {REASONS.map(r => {
                  const active = selected === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: active ? 'linear-gradient(135deg, #FFF7ED, #FFEDD5)' : '#FAFAF8',
                        border: `1.5px solid ${active ? '#FBBF24' : 'rgba(0,0,0,0.06)'}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s, border 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{r.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F1A2E' }}>
                          {r.label}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 1 }}>
                          {r.sub}
                        </div>
                      </div>
                      {active && <ChevronRight size={16} color="#E84B97" />}
                    </button>
                  );
                })}
              </div>

              {selected && (
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: '0.78rem', color: '#666', fontWeight: 600 }}>
                    もう少し詳しく? <span style={{ color: '#999', fontWeight: 400 }}>(任意 / 1〜2 行)</span>
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="例: 月額は妥当だけど、特定の機能が使い切れていない"
                    rows={2}
                    style={{
                      marginTop: 4, width: '100%',
                      background: '#fff',
                      border: '1px solid #e5e5e5',
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div style={{
                marginTop: 16, padding: '10px 12px',
                background: '#F0F9FF',
                border: '1px solid #BAE6FD',
                borderRadius: 10,
                display: 'flex', alignItems: 'flex-start', gap: 8,
                fontSize: '0.78rem', color: '#0C4A6E', lineHeight: 1.6,
              }}>
                <AlertCircle size={14} color="#0EA5E9" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  解約は <strong>期間末まで使えます</strong>。すぐに料金が止まる仕様ではないので、ご安心ください。
                </span>
              </div>
            </div>

            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #f1f1f1',
              display: 'flex', gap: 8,
              background: '#FAFAF8',
            }}>
              <button
                onClick={skipAndCancel}
                disabled={submitting || cancelBusy}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'transparent',
                  color: '#666',
                  border: '1px solid #e5e5e5',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: submitting || cancelBusy ? 'wait' : 'pointer',
                }}
              >
                理由なしで解約
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting || cancelBusy || !selected}
                style={{
                  flex: 2,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: submitting || cancelBusy || !selected
                    ? '#E5E7EB'
                    : 'linear-gradient(135deg, #6B7280, #374151)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  cursor: submitting || cancelBusy || !selected ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting || cancelBusy ? '処理中…' : selected ? '送信して解約する' : '理由を選んでね'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
