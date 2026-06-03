// ============================================================
// SampleModeBanner — 「サンプルモード」常駐 バナー
//
// オーナー指示 (2026-06-04 第 24 波 HHHH):
//   「サンプルで触ってみる」を選んだユーザーに、画面 最上部に小さな帯で
//   「これは サンプル です」を表示 + 「自分のアカウントに切替」CTA。
//
// 動作:
//   - isDemoActive() を監視 (storage event で他タブ変化にも追従)
//   - 切替ボタン: clearDemoData → setDemoActive(false) → /onboarding へ
//   - 「閉じる」では非表示にできない (誤認防止) — 代わりに切替 / 隠す (低 opacity)
// ============================================================

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, EyeOff, Eye } from 'lucide-react';
import { isDemoActive, setDemoActive, clearDemoData } from '../lib/onboarding';

const COLLAPSED_KEY = 'core_sample_banner_collapsed_v1';

export default function SampleModeBanner() {
  const [active, setActive] = useState<boolean>(() => {
    try { return isDemoActive(); } catch { return false; }
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && (e.key.includes('demo') || e.key.includes('Demo'))) {
        setActive(isDemoActive());
      }
    };
    window.addEventListener('storage', onStorage);
    // 同タブの自前 イベントも購読
    const onLocal = () => setActive(isDemoActive());
    window.addEventListener('core:demo-state-changed', onLocal as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('core:demo-state-changed', onLocal as EventListener);
    };
  }, []);

  const switchToReal = () => {
    if (!confirm('サンプルデータをすべて削除し、自分のアカウント用に切り替えます。よろしいですか?')) return;
    try { clearDemoData(); } catch { /* */ }
    setDemoActive(false);
    setActive(false);
    try { window.dispatchEvent(new CustomEvent('core:demo-state-changed')); } catch { /* */ }
    // /onboarding に戻して 初期セットアップから
    window.location.href = '/?fresh=1';
  };

  const toggleCollapse = () => {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  };

  if (!active) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: collapsed ? 0.55 : 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed',
          top: 'env(safe-area-inset-top, 0px)',
          left: 0, right: 0,
          zIndex: 80,
          background: collapsed
            ? 'rgba(15,14,27,0.85)'
            : 'linear-gradient(90deg, #FBBF24 0%, #F472B6 100%)',
          color: collapsed ? '#fde68a' : '#1a1a2e',
          fontSize: collapsed ? 11 : 12,
          fontWeight: 800,
          padding: collapsed ? '4px 12px' : '8px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: collapsed ? 'none' : '0 4px 16px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        role="status"
        aria-live="polite"
      >
        <Sparkles size={collapsed ? 11 : 14} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {collapsed
            ? 'サンプルモード'
            : 'これは サンプル モード です — 表示は架空のデモデータ'}
        </span>
        {!collapsed && (
          <button
            onClick={switchToReal}
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              background: '#1a1a2e',
              color: '#fff',
              border: 'none',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              flexShrink: 0,
            }}
          >
            自分のアカウントに切替 <ArrowRight size={11} />
          </button>
        )}
        <button
          onClick={toggleCollapse}
          title={collapsed ? '帯を広げる' : '帯を細くする'}
          aria-label={collapsed ? '帯を広げる' : '帯を細くする'}
          style={{
            width: 24, height: 24, borderRadius: 12,
            background: collapsed ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
            border: 'none',
            color: collapsed ? '#fde68a' : '#1a1a2e',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {collapsed ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
