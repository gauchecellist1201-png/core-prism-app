// BillingSuccess — Stripe Checkout 完了後のランディングページ
// URL: /billing/success?session_id=cs_xxx&brand=iris|prism
// 1) session_id で /api/billing/lookup を叩いてプランを同期
// 2) ローカル user.plan を更新
// 3) ダッシュボードへリダイレクト

import { useEffect, useState } from 'react';
import { syncFromStripe, loadBillingUser } from '../lib/billing';

type Status = 'loading' | 'success' | 'error';

export default function BillingSuccess() {
  const [status, setStatus] = useState<Status>('loading');
  const [planLabel, setPlanLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id') || '';
  const brand = params.get('brand') || 'prism';

  useEffect(() => {
    if (!sessionId) {
      setErrorMsg('session_id が見つかりません');
      setStatus('error');
      return;
    }

    syncFromStripe(sessionId).then(user => {
      if (user) {
        setPlanLabel(user.plan);
        setStatus('success');
        setTimeout(() => {
          window.location.href = brand === 'iris' ? '/iris?app=1' : '/?app=1';
        }, 2000);
      } else {
        const existing = loadBillingUser();
        if (existing) {
          setPlanLabel(existing.plan);
          setStatus('success');
          setTimeout(() => {
            window.location.href = brand === 'iris' ? '/iris?app=1' : '/?app=1';
          }, 2000);
        } else {
          setErrorMsg('プラン情報の取得に失敗しました。サポートにご連絡ください。');
          setStatus('error');
        }
      }
    }).catch((e: unknown) => {
      setErrorMsg(e instanceof Error ? e.message : 'エラーが発生しました');
      setStatus('error');
    });
  }, [sessionId, brand]);

  const accent = brand === 'iris' ? '#E1306C' : '#0033A0';
  const accentGrad = brand === 'iris'
    ? 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)'
    : 'linear-gradient(135deg, #0033A0, #1A4FC4)';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0a19 0%, #1a103a 100%)',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '2.5rem',
        maxWidth: 440, width: '100%', margin: '1rem',
        boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
        textAlign: 'center',
      }}>
        {status === 'loading' && (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              border: `4px solid ${accent}33`,
              borderTopColor: accent,
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1.5rem',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#5A5562', fontSize: '1rem' }}>お支払いを確認しています…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: accentGrad,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.2rem', color: '#fff',
              boxShadow: `0 12px 32px ${accent}55`,
              marginBottom: '1.25rem',
            }}>✓</div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#1F1A2E' }}>
              お支払い完了！
            </h2>
            <p style={{ color: '#5A5562', marginBottom: '0.5rem' }}>
              <strong>{planLabel}</strong> プランが有効になりました。
            </p>
            <p style={{ color: '#8A8593', fontSize: '0.88rem' }}>まもなくアプリへ移動します…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#FEE2E2',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', marginBottom: '1.25rem',
            }}>⚠</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.75rem', color: '#1F1A2E' }}>
              確認に失敗しました
            </h2>
            <p style={{ color: '#7F1D1D', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{errorMsg}</p>
            <a
              href={`mailto:support@coreprism.app?subject=決済確認の件&body=session_id: ${sessionId}`}
              style={{
                display: 'inline-block',
                background: 'rgba(0,0,0,0.06)', color: '#1F1A2E',
                padding: '0.75rem 1.5rem', borderRadius: 999,
                textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
                marginBottom: '0.75rem',
              }}
            >
              サポートに問い合わせる
            </a>
            <br />
            <a href={brand === 'iris' ? '/iris' : '/'} style={{ color: accent, fontSize: '0.88rem' }}>
              ← トップに戻る
            </a>
          </>
        )}
      </div>
    </div>
  );
}
