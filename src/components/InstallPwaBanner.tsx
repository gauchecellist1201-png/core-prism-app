// ============================================================
// InstallPwaBanner — PWA インストール導線
// Android/Chrome: beforeinstallprompt を捕捉 → タイミングよくバナー
// iOS Safari: 「共有 → ホーム画面に追加」のガイド
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DISMISS_KEY = 'core_pwa_dismiss_v1';
const VISIT_COUNT_KEY = 'core_pwa_visit_count_v1';
const LATER_KEY = 'core_pwa_later_v1'; // セッション「あとで」記憶

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

interface Props {
  brand: 'prism' | 'iris';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS
  if ((window.navigator as any).standalone === true) return true;
  // Android / desktop
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {}
  return false;
}

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  // Safari (Chrome on iOS は CriOS、Firefox は FxiOS なので除外)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

export default function InstallPwaBanner({ brand }: Props) {
  const [bipEvent, setBipEvent] = useState<BIPEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const brandLabel = brand === 'prism' ? 'CORE Prism' : 'CORE Iris';
  const brandColor = brand === 'prism' ? '#9333EA' : '#FF6B9D';
  const brandGradient = brand === 'prism'
    ? 'linear-gradient(135deg, #9333EA 0%, #4F46E5 100%)'
    : 'linear-gradient(135deg, #FF6B9D 0%, #FF8FB1 100%)';

  // 初期化: 永続的に「もう表示しない」されてないか確認
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) {
      setDismissed(true);
      return;
    }
    try {
      if (localStorage.getItem(DISMISS_KEY) === 'true') {
        setDismissed(true);
        return;
      }
      // セッション内の「あとで」
      if (sessionStorage.getItem(LATER_KEY) === 'true') {
        setDismissed(true);
        return;
      }
      // 訪問回数カウント
      const cur = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) || 0;
      localStorage.setItem(VISIT_COUNT_KEY, String(cur + 1));
    } catch {}
  }, []);

  // Android/PC Chrome: beforeinstallprompt
  useEffect(() => {
    if (dismissed) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setBipEvent(e as BIPEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed]);

  // 表示タイミング判定: 初回訪問から数秒で案内（Resonance と同じく“すぐ気づける”ように）。
  useEffect(() => {
    if (dismissed) return;
    const timer = window.setTimeout(() => {
      if (isStandalone()) return;
      if (bipEvent) {
        setShowAndroid(true);
      } else if (isIOSSafari()) {
        setShowIOS(true);
      }
    }, 6_000);
    return () => window.clearTimeout(timer);
  }, [bipEvent, dismissed]);

  // インストール完了で消す
  useEffect(() => {
    const onInstalled = () => {
      setShowAndroid(false);
      setShowIOS(false);
      setDismissed(true);
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  const dismissForever = () => {
    try { localStorage.setItem(DISMISS_KEY, 'true'); } catch {}
    setShowAndroid(false);
    setShowIOS(false);
    setDismissed(true);
  };

  const dismissForNow = () => {
    try { sessionStorage.setItem(LATER_KEY, 'true'); } catch {}
    setShowAndroid(false);
    setShowIOS(false);
  };

  const handleInstall = async () => {
    if (!bipEvent) return;
    try {
      await bipEvent.prompt();
      const choice = await bipEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setShowAndroid(false);
        setDismissed(true);
      } else {
        dismissForNow();
      }
    } catch {
      dismissForNow();
    }
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {showAndroid && (
        <motion.div
          key="android-banner"
          className="install-pwa-banner"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            zIndex: 70,
            maxWidth: 480,
            margin: '0 auto',
            background: 'rgba(15,15,25,0.94)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 18,
            padding: 16,
            color: '#fff',
            boxShadow: '0 18px 60px rgba(0,0,0,0.5)',
          }}
          role="dialog"
          aria-label={`${brandLabel} をアプリとして追加`}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 48, height: 48, borderRadius: 12,
                background: brandGradient,
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 700,
              }}
              aria-hidden
            >
              {brand === 'prism' ? 'P' : 'I'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
                {brandLabel} をアプリに追加
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                ホーム画面から 1 タップで起動。オフラインでも動きます。
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={handleInstall}
              style={{
                flex: 1,
                minHeight: 44,
                background: brandGradient,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              追加する
            </button>
            <button
              onClick={dismissForNow}
              style={{
                minHeight: 44,
                padding: '0 14px',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              あとで
            </button>
          </div>
          <button
            onClick={dismissForever}
            style={{
              marginTop: 10,
              width: '100%',
              minHeight: 32,
              background: 'transparent',
              color: 'rgba(255,255,255,0.4)',
              border: 'none',
              fontSize: 11,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            もう表示しない
          </button>
        </motion.div>
      )}

      {showIOS && (
        <motion.div
          key="ios-banner"
          className="install-pwa-banner"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            zIndex: 70,
            maxWidth: 480,
            margin: '0 auto',
            background: 'rgba(15,15,25,0.96)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 18,
            padding: 18,
            color: '#fff',
            boxShadow: '0 18px 60px rgba(0,0,0,0.5)',
          }}
          role="dialog"
          aria-label={`${brandLabel} をホーム画面に追加`}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: 11,
                background: brandGradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700,
                flexShrink: 0,
              }}
              aria-hidden
            >
              {brand === 'prism' ? 'P' : 'I'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700 }}>
                ホーム画面に追加すれば PWA として使えます
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                iPhone / iPad の Safari からの追加手順
              </p>
            </div>
          </div>

          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            <li style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              fontSize: 12,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: brandColor, color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>1</span>
              <span>下のメニューバーの <strong>共有ボタン</strong>（□と↑のアイコン）を押す</span>
            </li>
            <li style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              fontSize: 12,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: brandColor, color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>2</span>
              <span>スクロールして <strong>「ホーム画面に追加」</strong> を選ぶ</span>
            </li>
            <li style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              fontSize: 12,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: brandColor, color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>3</span>
              <span>右上の <strong>「追加」</strong> をタップして完了</span>
            </li>
          </ol>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={dismissForNow}
              style={{
                flex: 1,
                minHeight: 44,
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              あとで
            </button>
            <button
              onClick={dismissForever}
              style={{
                flex: 1,
                minHeight: 44,
                background: 'transparent',
                color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              もう表示しない
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
