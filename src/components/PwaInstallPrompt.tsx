// ============================================================
// PwaInstallPrompt — 「ホーム画面に追加」を能動的に促す
// beforeinstallprompt が発火したら蓄積、3 日経過で再表示
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const KEY_DISMISSED = 'core_pwa_dismissed_at_v1';
const KEY_INSTALLED = 'core_pwa_installed_v1';
const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // 3 日

function shouldShow(): boolean {
  try {
    if (localStorage.getItem(KEY_INSTALLED) === 'true') return false;
    const dismissedAt = localStorage.getItem(KEY_DISMISSED);
    if (!dismissedAt) return true;
    const elapsed = Date.now() - Number(dismissedAt);
    return elapsed > REMIND_AFTER_MS;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}

interface Props {
  accentColor?: string;
}

export default function PwaInstallPrompt({ accentColor = '#a78bfa' }: Props) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setInstallEvent(event);
      if (shouldShow()) {
        setTimeout(() => setShow(true), 4000); // 起動から 4 秒後に表示
      }
    };

    const onInstalled = () => {
      try { localStorage.setItem(KEY_INSTALLED, 'true'); } catch { /* */ }
      setShow(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const result = await installEvent.userChoice;
      if (result.outcome === 'accepted') {
        try { localStorage.setItem(KEY_INSTALLED, 'true'); } catch { /* */ }
      } else {
        try { localStorage.setItem(KEY_DISMISSED, String(Date.now())); } catch { /* */ }
      }
    } catch { /* */ }
    setShow(false);
    setInstallEvent(null);
  };

  const handleDismiss = () => {
    try { localStorage.setItem(KEY_DISMISSED, String(Date.now())); } catch { /* */ }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          className="fixed z-[80]"
          style={{
            left: 'calc(env(safe-area-inset-left, 0px) + 16px)',
            right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            maxWidth: 380,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              background: 'rgba(15,15,25,0.92)',
              backdropFilter: 'blur(24px)',
              border: `1px solid ${accentColor}40`,
              borderRadius: 16,
              padding: '14px 16px',
              boxShadow: `0 16px 48px ${accentColor}30, 0 8px 24px rgba(0,0,0,0.4)`,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}
            >
              📱
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                ホーム画面に追加
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 8 }}>
                アプリのように起動・オフライン対応・通知も受け取れます。
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleInstall}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: `0 4px 12px ${accentColor}55`,
                  }}
                >
                  追加する
                </button>
                <button
                  onClick={handleDismiss}
                  style={{
                    padding: '7px 12px',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  あとで
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              style={{
                width: 24, height: 24,
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer',
                padding: 0, lineHeight: 1,
              }}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
