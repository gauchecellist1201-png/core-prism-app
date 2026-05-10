// BillingDashboard — 請求情報モーダル
// 現在のプラン、次回更新日、解約ボタンを表示

import { useState } from 'react';
import { type BillingUser, type Brand } from '../lib/billing';
import { sendEmail } from '../lib/emailNotify';

interface Props {
  user: BillingUser;
  brand: Brand;
  onClose: () => void;
}

export default function BillingDashboard({ user, brand, onClose }: Props) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accent = brand === 'iris' ? '#E1306C' : '#0033A0';
  const accentGrad = brand === 'iris'
    ? 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)'
    : 'linear-gradient(135deg, #0033A0, #1A4FC4)';

  const periodEnd = user.currentPeriodEnd
    ? new Date(user.currentPeriodEnd * 1000).toLocaleDateString('ja-JP', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

  const handleCancel = async () => {
    if (!user.subscriptionId) {
      setError('サブスクリプション ID が見つかりません。サポートにご連絡ください。');
      return;
    }
    if (!confirm('本当に解約しますか？現在の契約期間終了まで利用可能です。')) return;

    setCancelling(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: user.subscriptionId }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || '解約に失敗しました');
      }
      sendEmail(user.email, 'cancel_save', { code: 'COMEBACK50' });
      setCancelled(true);
    } catch (e: any) {
      setError(e.message || '解約に失敗しました');
    } finally {
      setCancelling(false);
    }
  };

  const planNames: Record<string, string> = {
    free: '14日間トライアル', lite: 'Lite', standard: 'Standard',
    pro: 'Pro / Exclusive', studio: 'Studio',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,10,25,0.7)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, padding: '1.75rem',
          maxWidth: 440, width: '100%',
          fontFamily: 'Inter, -apple-system, sans-serif',
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: accent, fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              {brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} · 請求情報
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#1F1A2E' }}>プラン管理</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
              width: 32, height: 32, cursor: 'pointer', fontSize: '0.9rem',
            }}
          >✕</button>
        </div>

        {cancelled ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✓</div>
            <p style={{ fontWeight: 700, color: '#1F1A2E', marginBottom: '0.4rem' }}>解約手続きが完了しました</p>
            <p style={{ color: '#5A5562', fontSize: '0.88rem', lineHeight: 1.7 }}>
              現在の契約期間終了まで引き続きご利用いただけます。<br />
              復帰クーポン (50% OFF) をメールでお送りしました。
            </p>
          </div>
        ) : (
          <>
            <div style={{
              padding: '1.1rem', borderRadius: 14,
              background: `${accent}0d`, border: `1px solid ${accent}22`,
              marginBottom: '1rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '0.78rem', color: '#8A8593', margin: '0 0 0.2rem' }}>現在のプラン</p>
                  <p style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1F1A2E', margin: 0 }}>
                    {planNames[user.plan] || user.plan}
                  </p>
                </div>
                <div style={{
                  background: accentGrad, color: '#fff',
                  padding: '0.3rem 0.75rem', borderRadius: 999,
                  fontSize: '0.75rem', fontWeight: 700,
                }}>
                  有効
                </div>
              </div>
              {periodEnd && (
                <p style={{ fontSize: '0.82rem', color: '#5A5562', margin: '0.75rem 0 0' }}>
                  次回更新日: <strong>{periodEnd}</strong>
                </p>
              )}
              {user.isTestCheckout && (
                <p style={{ fontSize: '0.78rem', color: '#7C2D12', margin: '0.5rem 0 0' }}>
                  🧪 確認用モード (実際の課金なし)
                </p>
              )}
            </div>

            <div style={{
              padding: '0.75rem 1rem', borderRadius: 12,
              background: '#F8F7FA', border: '1px solid rgba(0,0,0,0.06)',
              fontSize: '0.88rem', color: '#5A5562', marginBottom: '1.25rem',
            }}>
              登録メール: <strong style={{ color: '#1F1A2E' }}>{user.email}</strong>
            </div>

            {error && (
              <div style={{
                background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)',
                padding: '0.6rem 0.85rem', borderRadius: 12, marginBottom: '0.75rem',
                color: '#9B1B30', fontSize: '0.85rem',
              }}>⚠ {error}</div>
            )}

            {user.subscriptionId && !user.isTestCheckout && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  width: '100%', background: 'transparent',
                  border: '1px solid rgba(200,16,46,0.3)',
                  color: '#9B1B30', borderRadius: 999,
                  padding: '0.75rem 1rem', fontSize: '0.9rem',
                  fontWeight: 600, cursor: cancelling ? 'wait' : 'pointer',
                  opacity: cancelling ? 0.6 : 1,
                }}
              >
                {cancelling ? '処理中…' : '解約する (期末解約)'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
