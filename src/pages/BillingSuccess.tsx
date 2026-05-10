// src/pages/BillingSuccess.tsx — Stripe Checkout 完了後の着地ページ
// URL: /billing/success?session_id=cs_xxx&brand=prism|iris
import { useEffect, useState } from 'react';
import { syncFromStripe, type StripeLookupResult } from '../lib/billing';

type Status = 'loading' | 'ok' | 'error';

export default function BillingSuccess() {
  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<StripeLookupResult | null>(null);

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id') ?? '';
  const brand = (params.get('brand') ?? 'prism') as 'iris' | 'prism';

  const accent = brand === 'iris' ? '#E1306C' : '#0033A0';
  const accentGrad = brand === 'iris'
    ? 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)'
    : 'linear-gradient(135deg, #0033A0, #1A4FC4)';
  const brandLabel = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }
    syncFromStripe(sessionId).then(r => {
      if (r) {
        setResult(r);
        setStatus('ok');
        setTimeout(() => {
          window.location.href = brand === 'iris' ? '/iris?app=1' : '/?app=1';
        }, 3000);
      } else {
        setStatus('ok');
        setTimeout(() => {
          window.location.href = brand === 'iris' ? '/iris?app=1' : '/?app=1';
        }, 3000);
      }
    });
  }, [sessionId, brand]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F4F5F7', fontFamily: 'Inter, -apple-system, sans-serif', padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '2.5rem',
        maxWidth: 480, width: '100%', textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.1)',
      }}>
        {status === 'loading' && (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              border: `4px solid ${accent}22`,
              borderTop: `4px solid ${accent}`,
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1.5rem',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ color: '#5A5562', fontSize: '1rem' }}>決済情報を確認中…</p>
          </>
        )}

        {status === 'ok' && (
          <>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: accentGrad,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', color: '#fff',
              boxShadow: `0 12px 32px ${accent}55`,
              marginBottom: '1.5rem',
            }}>✓</div>

            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1F1A2E', marginBottom: '0.5rem' }}>
              決済完了！
            </h1>
            <p style={{ color: '#5A5562', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>
              {brandLabel} へようこそ。
              {result?.plan && result.plan !== 'free' && (
                <><br /><strong style={{ color: accent }}>{result.plan.toUpperCase()}</strong> プランが有効になりました。</>
              )}
            </p>

            <div style={{
              padding: '0.75rem 1rem', borderRadius: 12,
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              fontSize: '0.85rem', color: '#166534', marginBottom: '1.5rem',
            }}>
              3 秒後に自動的にアプリへ移動します…
            </div>

            <button
              onClick={() => { window.location.href = brand === 'iris' ? '/iris?app=1' : '/?app=1'; }}
              style={{
                background: accentGrad, color: '#fff', border: 'none',
                borderRadius: 999, padding: '0.9rem 2rem',
                fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                width: '100%',
              }}
            >
              {brand === 'iris' ? '🌹 Iris を始める' : '✨ CORE Prism を始める'}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg,#EF4444,#DC2626)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', color: '#fff', marginBottom: '1.5rem',
            }}>!</div>

            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1F1A2E', marginBottom: '0.5rem' }}>
              セッション情報が見つかりません
            </h1>
            <p style={{ color: '#5A5562', fontSize: '0.92rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>
              決済は完了している可能性があります。<br />
              問題が続く場合はサポートへご連絡ください。
            </p>
            <a
              href="mailto:support@coreprism.app"
              style={{
                display: 'inline-block', color: accent,
                textDecoration: 'none', fontWeight: 600,
                marginBottom: '1rem',
              }}
            >
              support@coreprism.app
            </a>
            <br />
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                background: '#F4F5F7', color: '#1F1A2E', border: 'none',
                borderRadius: 999, padding: '0.75rem 1.5rem',
                fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem',
              }}
            >
              トップに戻る
            </button>
          </>
        )}
      </div>
    </div>
  );
}
