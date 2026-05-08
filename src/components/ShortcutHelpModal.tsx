// ============================================================
// ShortcutHelpModal — `?` キーで開くショートカット一覧
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: '横断検索を開く', desc: 'タスク・ナレッジ・人格・案件を全文検索' },
  { keys: ['⌘', '/'], label: 'AIサポートを開閉', desc: 'グローバルAIアシスタント (プリズム / アイリス)' },
  { keys: ['?'], label: 'ショートカット一覧 (このモーダル)' },
  { keys: ['Esc'], label: 'モーダル/ドロワーを閉じる' },
  { keys: ['Enter'], label: '送信 (チャット入力時)' },
  { keys: ['Shift', 'Enter'], label: '改行 (チャット入力時)' },
  { keys: ['⌘', '.'], label: 'マスターモード切替 (オーナー専用)' },
];

interface Props {
  open?: boolean;
  onClose?: () => void;
}

export default function ShortcutHelpModal({ open: openProp, onClose }: Props = {}) {
  const [open, setOpen] = useState<boolean>(!!openProp);

  useEffect(() => {
    if (openProp !== undefined) setOpen(openProp);
  }, [openProp]);

  // `?` キーで開閉 (input/textarea 内では発火させない)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const isInput = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (isInput) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        onClose?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
            onClick={() => { setOpen(false); onClose?.(); }}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[91] flex items-center justify-center pointer-events-none"
          >
            <div
              className="pointer-events-auto"
              style={{
                width: '92%',
                maxWidth: 540,
                maxHeight: '85vh',
                overflowY: 'auto',
                background: 'rgba(15,15,25,0.92)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 18,
                padding: '22px 24px',
                color: '#fff',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <p style={{ fontSize: 11, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                    KEYBOARD SHORTCUTS
                  </p>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>ショートカット一覧</h2>
                </div>
                <button
                  onClick={() => { setOpen(false); onClose?.(); }}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer',
                  }}
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                {SHORTCUTS.map((s, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {s.keys.map((k, j) => (
                        <span
                          key={j}
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            minWidth: 28,
                            textAlign: 'center',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.18)',
                            borderRadius: 6,
                            fontSize: 12,
                            fontFamily: 'ui-monospace, "SF Mono", monospace',
                            fontWeight: 600,
                          }}
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</p>
                      {s.desc && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{s.desc}</p>}
                    </div>
                  </li>
                ))}
              </ul>

              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
                <strong>?</strong> キー = ショートカット一覧の開閉
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
