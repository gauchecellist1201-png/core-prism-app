// ============================================================
// PwaInstallNudge — LP 訪問 3 回目以降に PWA インストール促進
//
// オーナー指示 (2026-06-03 第 11 波 WW):
//   ホーム画面に追加すると Push 通知 + オフライン使えます
//
// 動作:
//   - LP マウントごとに `core_lp_visit_count_v1` をインクリメント
//   - 3 回目以降 + 未インストール + 1 日に 1 回だけ表示
//   - Chrome / Edge は `beforeinstallprompt` を捕捉して deferredPrompt を保持
//   - iOS Safari は `beforeinstallprompt` が無いため手動案内に倒す
//   - 「あとで」を押したら 3 日間スヌーズ
// ============================================================

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Bell, WifiOff } from 'lucide-react';

const VISIT_KEY = 'core_lp_visit_count_v1';
const LAST_SHOWN_KEY = 'core_pwa_nudge_last_shown_v1';
const SNOOZE_UNTIL_KEY = 'core_pwa_nudge_snooze_until_v1';
const INSTALLED_KEY = 'core_pwa_installed_v1';

const ONE_DAY = 86_400_000;
const SNOOZE_DURATION = 7 * ONE_DAY;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
}

function bumpVisitCount(): number {
  try {
    const n = Number(localStorage.getItem(VISIT_KEY) || '0') + 1;
    localStorage.setItem(VISIT_KEY, String(n));
    return n;
  } catch { return 0; }
}

function shouldShow(visitCount: number): boolean {
  if (visitCount < 3) return false;
  if (isStandalone()) return false;
  try {
    if (localStorage.getItem(INSTALLED_KEY) === '1') return false;
    const snooze = Number(localStorage.getItem(SNOOZE_UNTIL_KEY) || '0');
    if (snooze > Date.now()) return false;
    const last = Number(localStorage.getItem(LAST_SHOWN_KEY) || '0');
    if (Date.now() - last < ONE_DAY) return false;
  } catch { /* */ }
  return true;
}

export default function PwaInstallNudge() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHelp, setIosHelp] = useState(false);
  const isIos = detectIos();

  useEffect(() => {
    const count = bumpVisitCount();
    if (!shouldShow(count)) return;

    // Android Chrome 等は beforeinstallprompt が飛ぶまで少し待つ
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
      try { localStorage.setItem(LAST_SHOWN_KEY, String(Date.now())); } catch { /* */ }
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari は prompt が来ないため、3 秒 待っても来なければ手動案内に倒す
    let iosFallbackTimer: number | undefined;
    if (isIos) {
      iosFallbackTimer = window.setTimeout(() => {
        setVisible(true);
        try { localStorage.setItem(LAST_SHOWN_KEY, String(Date.now())); } catch { /* */ }
      }, 2500);
    }

    // インストール完了イベント
    const installed = () => {
      try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* */ }
      setVisible(false);
    };
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
      if (iosFallbackTimer) window.clearTimeout(iosFallbackTimer);
    };
  }, [isIos]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* */ }
        }
      } catch { /* */ }
      setDeferredPrompt(null);
      setVisible(false);
    } else if (isIos) {
      setIosHelp(true);
    }
  };

  const handleSnooze = () => {
    try { localStorage.setItem(SNOOZE_UNTIL_KEY, String(Date.now() + SNOOZE_DURATION)); } catch { /* */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed',
          left: 'env(safe-area-inset-left, 12px)',
          right: 'env(safe-area-inset-right, 12px)',
          bottom: 'calc(env(safe-area-inset-bottom, 12px) + 12px)',
          zIndex: 80,
          maxWidth: 480,
          margin: '0 auto',
          background: 'rgba(15, 14, 27, 0.96)',
          border: '1px solid rgba(167,139,250,0.35)',
          borderRadius: 18,
          padding: '1rem 1rem',
          color: '#fff',
          boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <button
          aria-label="閉じる"
          onClick={handleSnooze}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 30, height: 30, borderRadius: 15,
            background: 'rgba(255,255,255,0.08)', border: 'none',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>

        {!iosHelp ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Smartphone size={20} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.3 }}>
                  ホーム画面に追加しませんか?
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                  毎日 1 タップで AI 役員 13 名にアクセス
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10, fontSize: '0.7rem', color: 'rgba(255,255,255,0.78)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Bell size={12} /> Push 通知
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <WifiOff size={12} /> オフライン対応
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                ⚡ 起動が速い
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={handleSnooze}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 12,
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                あとで (7 日)
              </button>
              <button
                onClick={handleInstall}
                style={{
                  flex: 2,
                  padding: '10px 0',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(167,139,250,0.35)',
                }}
              >
                {isIos && !deferredPrompt ? '追加手順を見る →' : 'ホームに追加 →'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 8 }}>iPhone での追加手順</div>
            <ol style={{ paddingLeft: 18, margin: 0, fontSize: '0.82rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.85)' }}>
              <li>下部の <strong>共有</strong> ボタン (□ + ↑) をタップ</li>
              <li>「<strong>ホーム画面に追加</strong>」を選択</li>
              <li>「追加」をタップして完了</li>
            </ol>
            <button
              onClick={() => setVisible(false)}
              style={{
                marginTop: 12, width: '100%',
                padding: '10px 0', borderRadius: 12,
                background: 'rgba(255,255,255,0.08)',
                color: '#fff', border: 'none',
                fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              わかりました
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
