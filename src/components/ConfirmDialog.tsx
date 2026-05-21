// ============================================================
// ConfirmDialog — confirmAction() を受けてカードを表示するルート
// window.confirm（OSのグレー箱）の代替。ESC でキャンセル、
// 背景クリックでキャンセル、Enter で OK 確定。
// ============================================================
import { useEffect, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { CONFIRM_EVENT, notifyConfirmDialogMount, type ConfirmInternalDetail } from '../lib/confirmDialog';
import { triggerHaptic } from '../lib/haptic';

export default function ConfirmDialog() {
  const [current, setCurrent] = useState<ConfirmInternalDetail | null>(null);
  const okBtnRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback((ok: boolean) => {
    if (!current) return;
    current.__resolve(ok);
    setCurrent(null);
  }, [current]);

  useEffect(() => {
    const onConfirm = (ev: Event) => {
      const detail = (ev as CustomEvent<ConfirmInternalDetail>).detail;
      if (!detail) return;
      setCurrent(detail);
    };
    window.addEventListener(CONFIRM_EVENT, onConfirm as EventListener);
    notifyConfirmDialogMount(1);
    return () => {
      window.removeEventListener(CONFIRM_EVENT, onConfirm as EventListener);
      notifyConfirmDialogMount(-1);
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); close(true); }
    };
    window.addEventListener('keydown', onKey);
    // フォーカスを OK ボタンに当てる（破壊的でない場合のみ）
    if (current.tone !== 'danger') {
      requestAnimationFrame(() => okBtnRef.current?.focus());
    }
    return () => window.removeEventListener('keydown', onKey);
  }, [current, close]);

  const danger = current?.tone === 'danger';
  const okLabel = current?.okLabel ?? (danger ? '削除する' : 'OK');
  const cancelLabel = current?.cancelLabel ?? 'キャンセル';

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => close(false)}
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 6, 20, 0.55)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            paddingTop: 'max(16px, env(safe-area-inset-top))',
          }}
        >
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 6 }}
            transition={{ type: 'spring', damping: 24, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            style={{
              background: 'var(--bg)',
              color: 'var(--fg-strong)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              maxWidth: 'min(420px, calc(100vw - 32px))',
              width: '100%',
              boxShadow: 'var(--shadow), 0 30px 80px rgba(10, 6, 30, 0.45)',
              padding: '22px 22px 18px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: danger ? '#FEF2F2' : '#EEF2FF',
                  color: danger ? '#DC2626' : '#4338CA',
                  flexShrink: 0,
                }}
              >
                {danger ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  id="confirm-dialog-title"
                  style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.4 }}
                >
                  {current.title}
                </div>
                {current.body && (
                  <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--fg-muted)', marginTop: 6 }}>
                    {current.body}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                onClick={() => { triggerHaptic('light'); close(false); }}
                style={{
                  background: 'var(--surface-3)',
                  color: 'var(--fg)',
                  border: '1px solid var(--border-2)',
                  borderRadius: 12,
                  padding: '11px 18px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  minHeight: 44,
                  minWidth: 88,
                }}
              >
                {cancelLabel}
              </button>
              <button
                ref={okBtnRef}
                onClick={() => { triggerHaptic(danger ? 'warning' : 'medium'); close(true); }}
                style={{
                  background: danger
                    ? 'linear-gradient(135deg, #DC2626, #B91C1C)'
                    : 'linear-gradient(135deg, #6366F1, #4F46E5)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 12,
                  padding: '11px 18px',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  minHeight: 44,
                  minWidth: 96,
                  boxShadow: danger
                    ? '0 8px 20px rgba(220, 38, 38, 0.35)'
                    : '0 8px 20px rgba(79, 70, 229, 0.35)',
                }}
              >
                {okLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
