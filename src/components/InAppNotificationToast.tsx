// ============================================================
// InAppNotificationToast — 画面右下にスタックする 5 秒トースト
// メール送信が全部失敗したときの最後の伝達手段
// window への 'core:notify' イベントを受信して並べる
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { NOTIFY_EVENT, type NotifyDetail, type NotifyKind } from '../lib/inAppNotify';

interface Toast extends NotifyDetail {
  id: number;
}

const DEFAULT_DURATION = 5000;

const KIND_COLORS: Record<NotifyKind, { bg: string; ink: string; accent: string }> = {
  success: { bg: '#ECFDF5', ink: '#065F46', accent: '#10B981' },
  info:    { bg: '#EFF6FF', ink: '#1E3A8A', accent: '#3B82F6' },
  warn:    { bg: '#FFFBEB', ink: '#92400E', accent: '#F59E0B' },
};

function KindIcon({ kind, color }: { kind: NotifyKind; color: string }) {
  const size = 18;
  if (kind === 'success') return <CheckCircle2 size={size} color={color} />;
  if (kind === 'warn') return <AlertTriangle size={size} color={color} />;
  return <Info size={size} color={color} />;
}

export default function InAppNotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(ts => ts.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const onNotify = (ev: Event) => {
      const detail = (ev as CustomEvent<NotifyDetail>).detail;
      if (!detail || !detail.title) return;
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const t: Toast = { ...detail, id };
      setToasts(ts => [...ts, t].slice(-4)); // 同時最大 4 個
      const duration = detail.duration ?? DEFAULT_DURATION;
      window.setTimeout(() => dismiss(id), duration);
    };
    window.addEventListener(NOTIFY_EVENT, onNotify as EventListener);
    return () => window.removeEventListener(NOTIFY_EVENT, onNotify as EventListener);
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 'max(16px, env(safe-area-inset-right))',
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
        maxWidth: 'min(360px, calc(100vw - 32px))',
      }}
    >
      <AnimatePresence initial={false}>
        {toasts.map(t => {
          const c = KIND_COLORS[t.kind];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              style={{
                pointerEvents: 'auto',
                background: c.bg,
                color: c.ink,
                borderLeft: `4px solid ${c.accent}`,
                borderRadius: 14,
                padding: '12px 14px 12px 14px',
                boxShadow: '0 14px 36px rgba(15,10,25,0.18)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
              }}
            >
              <KindIcon kind={t.kind} color={c.accent} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.35 }}>{t.title}</div>
                {t.body && (
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 4, opacity: 0.86 }}>
                    {t.body}
                  </div>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="閉じる"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  color: c.ink,
                  opacity: 0.55,
                  display: 'inline-flex',
                }}
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
