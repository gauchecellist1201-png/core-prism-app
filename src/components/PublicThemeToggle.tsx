// ============================================================
// PublicThemeToggle — LP / Pricing / Billing / Contact 等で常駐する
//                     小さなテーマ切替ボタン
//
// オーナー指示 (2026-06-04 第 21 波 YYY):
//   既存 ThemeToggle は dashboard のサイドバーに表示。
//   ダッシュボード以外の公開画面でも切替できるよう、画面右上 (QuickAskFab
//   は右下 / SuggestionFab は左下 と被らない) に小さなボタン。
// ============================================================

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { currentTheme, subscribeTheme, toggleTheme, type Theme } from '../lib/themeManager';

function isDashboardOrIris(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  // dashboard (SPA 内 view) と /iris 系は専用 ThemeToggle が出るので隠す
  return p === '/dashboard' || p.startsWith('/iris') || p.startsWith('/master');
}

export default function PublicThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const [hide, setHide] = useState<boolean>(isDashboardOrIris());

  useEffect(() => {
    const unsub = subscribeTheme((t) => setTheme(t));
    const onNav = () => setHide(isDashboardOrIris());
    window.addEventListener('popstate', onNav);
    window.addEventListener('pushstate', onNav);
    return () => {
      unsub();
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('pushstate', onNav);
    };
  }, []);

  if (hide) return null;

  const isLight = theme === 'light';
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      onClick={() => toggleTheme()}
      aria-label={isLight ? 'ダークモードに切替' : 'ライトモードに切替'}
      title={isLight ? 'ダークモードに切替' : 'ライトモードに切替'}
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
        zIndex: 70,
        width: 36, height: 36, borderRadius: 18,
        background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(15,14,27,0.85)',
        color: isLight ? '#1F1A2E' : '#fff',
        border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)'}`,
        boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {isLight ? <Moon size={15} /> : <Sun size={15} />}
    </motion.button>
  );
}
