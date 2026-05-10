// src/components/BillingDashboard.tsx — 請求情報モーダル
// 現在のプラン・次回更新日・解約ボタンを表示
import { useState } from 'react';
import { loadBillingUser, saveBillingUser } from '../lib/billing';
import { sendEmail } from '../lib/emailNotify';

interface Props {
  onClose: () => void;
}

type CancelStatus = 'idle' | 'confirming' | 'cancelling' | 'cancelled' | 'error';

export default function BillingDashboard({ onClose }: Props) {
  const user = loadBillingUser();
  const [cancelStatus, setCancelStatus] = useState<CancelStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCancel = async () => {
    if (cancelStatus === 'idle') {
      setCancelStatus('confirming');
      return;
    }
    if (cancelStatus !== 'confirming') return;

    setCancelStatus('cancelling');
    setErrorMsg(null);

    const subscriptionId = user?.stripeCustomerId;
    if (!subscriptionId) {
      if (user) {
        saveBillingUser({ ...user, plan: 'free' });
      }
      if (user?.email) {
        sendEmail(user.email, 'cancel_save', {
          name: user.email.split('@')[0],
          brand: user.brand,
          couponCode: 'COMEBACK50',
        });
      }
      setCancelStatus('cancelled');
      return;
    }

    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: subscriptionId }),
      });

      if (res.status === 503) {
        if (user) saveBillingUser({ ...user, plan: 'free' });
        setCancelStatus('cancelled');
      } else if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setErrorMsg(err.error ?? '解約処理でエラーが発生しました');
        setCancelStatus('error');
        return;
      } else {
        setCancelStatus('cancelled');
      }

      if (user?.email) {
        sendEmail(user.email, 'cancel_save', {
          name: user.email.split('@')[0],
          brand: user.brand,
          couponCode: 'COMEBACK50',
        });
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : '解約処理でエラーが発生しました');
      setCancelStatus('error');
    }
  };

  const planLabel = (plan: string) => {
    const map: Record<string, string> = {
      free: '無料トライアル', lite: 'Lite / Starter', standard: 'Standard',
      pro: 'Pro / Exclusive', studio: 'Studio',
    };
    return map[plan] ?? plan;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,10,25,0.7)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, padding: '2rem',
          maxWidth: 440, width: '100%', color: '#1F1A2E',
          boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>請求情報</h2>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
            width: 30, height: 30, cursor: 'pointer', fontSize: '0.85rem',
          }}>✕</button>
        </div>

        {!user ? (
          <p style={{ color: '#5A5562' }}>ユーザー情報が見つかりません。</p>
        ) : (
          <>
            <div style={{
              padding: '1rem', borderRadius: 14,
              background: '#F4F5F7', marginBottom: '1rem',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#8A8593', marginBottom: '0.25rem' }}>現在のプラン</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1F1A2E' }}>
                {planLabel(user.plan)}
              </div>
              {user.email && (
                <div style={{ fontSize: '0.82rem', color: '#5A5562', marginTop: '0.25rem' }}>{user.email}</div>
              )}
            </div>

            <div style={{
              padding: '1rem', borderRadius: 14,
              background: '#F4F5F7', marginBottom: '1.5rem',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#8A8593', marginBottom: '0.25rem' }}>開始日</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1F1A2E' }}>
                {new Date(user.startedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              {user.trialEndsAt && user.plan === 'free' && (
                <>
                  <div style={{ fontSize: '0.75rem', color: '#8A8593', marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                    トライアル終了日
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#D97706' }}>
                    {new Date(user.trialEndsAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </>
              )}
            </div>

            {cancelStatus === 'cancelled' ? (
              <div style={{
                padding: '1rem', borderRadius: 14,
                background: '#F0FDF4', border: '1px solid #BBF7D0',
                fontSize: '0.88rem', color: '#166534', textAlign: 'center',
              }}>
                ✓ 解約手続きが完了しました。期間終了まで引き続きご利用いただけます。
              </div>
            ) : (
              <>
                {cancelStatus === 'error' && errorMsg && (
                  <div style={{
                    padding: '0.75rem 1rem', borderRadius: 12,
                    background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)',
                    color: '#9B1B30', fontSize: '0.85rem', marginBottom: '1rem',
                  }}>⚠ {errorMsg}</div>
                )}

                {cancelStatus === 'confirming' && (
                  <div style={{
                    padding: '0.75rem 1rem', borderRadius: 12,
                    background: '#FEF3C7', border: '1px solid #FCD34D',
                    fontSize: '0.85rem', color: '#7C2D12', marginBottom: '1rem', lineHeight: 1.7,
                  }}>
                    本当に解約しますか？解約後も期間終了まではご利用いただけます。
                  </div>
                )}

                <button
                  onClick={handleCancel}
                  disabled={cancelStatus === 'cancelling'}
                  style={{
                    width: '100%', padding: '0.75rem',
                    background: cancelStatus === 'confirming'
                      ? 'linear-gradient(135deg,#EF4444,#DC2626)'
                      : 'rgba(0,0,0,0.04)',
                    color: cancelStatus === 'confirming' ? '#fff' : '#5A5562',
                    border: cancelStatus === 'confirming' ? 'none' : '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 999, fontSize: '0.9rem',
                    fontWeight: 600, cursor: cancelStatus === 'cancelling' ? 'wait' : 'pointer',
                    opacity: cancelStatus === 'cancelling' ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {cancelStatus === 'cancelling'
                    ? '処理中…'
                    : cancelStatus === 'confirming'
                      ? '解約を確定する'
                      : 'サブスクリプションを解約'}
                </button>

                {cancelStatus === 'confirming' && (
                  <button
                    onClick={() => setCancelStatus('idle')}
                    style={{
                      width: '100%', marginTop: '0.5rem', padding: '0.75rem',
                      background: 'transparent', border: 'none',
                      color: '#8A8593', fontSize: '0.85rem', cursor: 'pointer',
                    }}
                  >
                    キャンセル
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
