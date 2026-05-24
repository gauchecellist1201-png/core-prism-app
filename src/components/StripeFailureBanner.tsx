// ============================================================
// StripeFailureBanner — 課金失敗時の救済バナー
//
// Stripe webhook で `delinquent: true` (= past_due / unpaid / incomplete)
// になった場合、ダッシュボード上部に赤バナーを表示し、
// Stripe Customer Portal へ誘導してカード情報の更新を促す。
//
// Day 2: 「ただ止まる」のではなく「3 日の猶予 + 1 クリックで復旧」の体験へ。
// ============================================================
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBillingUser, getCustomerPortalUrl, isBillingDelinquent } from '../lib/billing';

interface Props {
  /** ブランドカラー切替用 (任意) */
  brand?: 'iris' | 'prism';
}

export default function StripeFailureBanner({ brand: _brand = 'prism' }: Props) {
  const { user } = useBillingUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number>(() => {
    try {
      const v = localStorage.getItem('core_stripe_failure_dismissed_v1');
      return v ? parseInt(v, 10) : 0;
    } catch { return 0; }
  });

  const delinquent = isBillingDelinquent(user);

  // 1 時間に 1 回だけ閉じれる (再表示で気づかせる)
  const HIDE_FOR_MS = 60 * 60 * 1000;
  const hidden = Date.now() - dismissedAt < HIDE_FOR_MS;

  const openPortal = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const url = await getCustomerPortalUrl();
      if (!url) {
        setError('ポータルを開けませんでした。サポートにご連絡ください。');
        return;
      }
      window.location.href = url;
    } catch (e: any) {
      setError(e?.message || 'ポータルを開けませんでした');
    } finally {
      setBusy(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    const now = Date.now();
    setDismissedAt(now);
    try { localStorage.setItem('core_stripe_failure_dismissed_v1', String(now)); } catch { /* */ }
  }, []);

  if (!delinquent || hidden) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        role="alert"
        aria-live="assertive"
        style={{
          position: 'sticky',
          top: 'env(safe-area-inset-top, 0px)',
          zIndex: 90,
          margin: '0.5rem 0.75rem',
          padding: '0.85rem 1rem',
          borderRadius: 14,
          background: 'linear-gradient(135deg, #FEE2E2, #FECACA)',
          border: '1.5px solid #DC2626',
          boxShadow: '0 8px 24px rgba(220,38,38,0.22)',
          color: '#7F1D1D',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          fontFamily: 'Inter, -apple-system, sans-serif',
        }}
      >
        <div style={{
          fontSize: '1.4rem',
          lineHeight: 1,
          flexShrink: 0,
        }} aria-hidden>⚠</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: 2 }}>
            カードの請求が失敗しました
          </div>
          <div style={{ fontSize: '0.78rem', lineHeight: 1.55, color: '#991B1B' }}>
            <strong>3 日以内</strong>にカード情報を更新しないと、AI 機能が一時停止します。
            {error && (
              <div style={{ marginTop: 4, color: '#7F1D1D', fontWeight: 700 }}>
                {error}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              onClick={openPortal}
              disabled={busy}
              style={{
                background: '#DC2626',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '0.5rem 1rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(220,38,38,0.35)',
              }}
            >
              {busy ? '開いています…' : 'カード情報を更新する →'}
            </button>
            <button
              onClick={dismiss}
              style={{
                background: 'transparent',
                color: '#7F1D1D',
                border: '1px solid rgba(127,29,29,0.3)',
                borderRadius: 999,
                padding: '0.5rem 0.9rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              あとで
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
