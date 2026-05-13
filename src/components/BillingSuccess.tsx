// ============================================================
// BillingSuccess — Stripe 決済完了ページ
// /billing/success?session_id=cs_xxx&brand=iris
// syncFromStripe() でプランを確定してアプリへリダイレクト
// ============================================================
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { syncFromStripe } from '../lib/billing';

type Status = 'loading' | 'success' | 'error';

export default function BillingSuccess() {
  const [status, setStatus] = useState<Status>('loading');
  const [planLabel, setPlanLabel] = useState('');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const brand = params.get('brand') || 'prism';

    if (!sessionId) {
      setErrMsg('session_id が見つかりません。');
      setStatus('error');
      return;
    }

    let cancelled = false;

    (async () => {
      const result = await syncFromStripe(sessionId);
      if (cancelled) return;

      if (result && result.ok && result.plan) {
        setPlanLabel(result.plan);
        setStatus('success');
        // 2 秒後にアプリへリダイレクト
        setTimeout(() => {
          window.location.href = brand === 'iris' ? '/iris?app=1' : '/?app=1';
        }, 2000);
      } else {
        // セッション照会失敗でもアプリへ遷移 (エラー表示+手動リンク)
        setErrMsg('プラン情報の取得に失敗しました。しばらくしてから再度お試しください。');
        setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const brand = new URLSearchParams(window.location.search).get('brand') || 'prism';
  const accent = brand === 'iris' ? '#E1306C' : '#0033A0';
  const grad = brand === 'iris'
    ? 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)'
    : 'linear-gradient(135deg, #0033A0, #1A4FC4)';

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #0f0a1e 0%, #1a0533 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        style={{
          background: '#fff', borderRadius: 24, padding: '2.5rem',
          maxWidth: 480, width: '100%', margin: '1rem',
          textAlign: 'center',
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
        }}
      >
        {status === 'loading' && (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                border: `4px solid ${accent}22`,
                borderTop: `4px solid ${accent}`,
                margin: '0 auto 1.5rem',
              }}
            />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: '#1F1A2E' }}>
              決済を確認中…
            </h2>
            <p style={{ color: '#5A5562', fontSize: '0.92rem' }}>
              Stripe からのプラン情報を取得しています。
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              style={{
                width: 80, height: 80, borderRadius: '50%',
                background: grad,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.5rem', color: '#fff',
                boxShadow: `0 12px 32px ${accent}66`,
                marginBottom: '1.25rem',
              }}
            >
              ✓
            </motion.div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem', color: '#1F1A2E' }}>
              お支払いが完了しました
            </h2>
            <p style={{ color: '#5A5562', fontSize: '0.95rem', lineHeight: 1.8 }}>
              <strong>{planLabel}</strong> プランが有効になりました。<br />
              2 秒後にアプリへ移動します…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(200,16,46,0.1)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', marginBottom: '1.25rem',
            }}>
              ⚠
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: '#1F1A2E' }}>
              確認エラー
            </h2>
            <p style={{ color: '#5A5562', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              {errMsg}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={brand === 'iris' ? '/iris?app=1' : '/?app=1'} style={{
                display: 'inline-block',
                background: grad, color: '#fff',
                padding: '0.75rem 1.5rem', borderRadius: 999,
                fontSize: '0.9rem', fontWeight: 700, textDecoration: 'none',
              }}>
                アプリへ進む
              </a>
              <a href="mailto:support@coreprism.app" style={{
                display: 'inline-block',
                background: 'rgba(0,0,0,0.06)', color: '#5A5562',
                border: '1px solid rgba(0,0,0,0.1)',
                padding: '0.75rem 1.5rem', borderRadius: 999,
                fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none',
              }}>
                サポートに問い合わせる
              </a>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
