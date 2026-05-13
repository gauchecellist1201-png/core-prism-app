// ============================================================
// BillingDashboard — 請求情報モーダル
// 現在のプラン / 次回更新日 / 解約ボタン
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useBillingUser, findPlan, getPlans,
  updateSubscriptionPlan, openBillingPortal,
  type PlanId,
} from '../lib/billing';
import { sendEmail } from '../lib/emailNotify';

interface Props {
  onClose: () => void;
}

export default function BillingDashboard({ onClose }: Props) {
  const { user, changePlan } = useBillingUser();
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showPlanSwitcher, setShowPlanSwitcher] = useState(false);
  const [switchBusy, setSwitchBusy] = useState<PlanId | null>(null);
  const [switchMsg, setSwitchMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  if (!user) return null;

  const handleSwitchPlan = async (newPlan: PlanId) => {
    setSwitchMsg(null);
    if (newPlan === user.plan) return;
    if (!user.subscriptionId) {
      // テスト/ローカルモード: その場でプランだけ書き換え
      changePlan(newPlan);
      setSwitchMsg({ kind: 'ok', text: `${newPlan} に切り替えました (テスト)` });
      return;
    }
    if (!confirm(`プランを「${newPlan}」に変更します。次回請求から反映されます。よろしいですか?`)) return;
    setSwitchBusy(newPlan);
    const r = await updateSubscriptionPlan({
      subscriptionId: user.subscriptionId,
      brand: user.brand,
      plan: newPlan,
    });
    setSwitchBusy(null);
    setSwitchMsg({ kind: r.ok ? 'ok' : 'err', text: r.message });
    if (r.ok) {
      changePlan(newPlan);
      setShowPlanSwitcher(false);
    }
  };

  const handleOpenPortal = async () => {
    if (!user.stripeCustomerId) {
      setSwitchMsg({ kind: 'err', text: 'カスタマー ID 未連携 — まず一度サブスクを開始してください' });
      return;
    }
    setPortalBusy(true);
    const r = await openBillingPortal(user.stripeCustomerId);
    setPortalBusy(false);
    if (r.ok && r.url) {
      window.location.href = r.url;
    } else {
      setSwitchMsg({ kind: 'err', text: r.message || 'ポータルを開けません' });
    }
  };

  const plan = findPlan(user.brand, user.plan);
  const accent = user.brand === 'iris' ? '#E1306C' : '#0033A0';
  const grad = user.brand === 'iris'
    ? 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)'
    : 'linear-gradient(135deg, #0033A0, #1A4FC4)';

  const periodEnd = user.currentPeriodEnd
    ? new Date(user.currentPeriodEnd * 1000).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const handleCancel = async () => {
    if (!user.subscriptionId) {
      // テストモード: ローカルでプランをフリーに戻す
      changePlan('free');
      sendEmail(user.email, 'cancel_save', { name: user.email.split('@')[0], code: 'COMEBACK50' });
      setCancelDone(true);
      return;
    }

    setCancelBusy(true);
    setCancelError(null);
    try {
      const resp = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: user.subscriptionId }),
      });
      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        throw new Error(err.error || '解約処理に失敗しました');
      }
      // キャンセルセーブメール (非同期)
      sendEmail(user.email, 'cancel_save', { name: user.email.split('@')[0], code: 'COMEBACK50' });
      setCancelDone(true);
    } catch (e: any) {
      setCancelError(e.message);
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,10,25,0.7)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 24, padding: '2rem',
          maxWidth: 480, width: '100%',
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#1F1A2E',
          boxShadow: '0 30px 80px rgba(15,10,25,0.4)',
        }}
      >
        {/* ヘッダ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: accent, fontWeight: 700, textTransform: 'uppercase' }}>
              {user.brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} · 請求情報
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.2rem 0 0' }}>プラン管理</h2>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
            width: 44, height: 44, cursor: 'pointer', fontSize: '1rem',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }} aria-label="閉じる">✕</button>
        </div>

        {/* 現在のプラン */}
        <div style={{
          padding: '1.25rem', borderRadius: 16,
          background: `${accent}0d`,
          border: `1px solid ${accent}33`,
          marginBottom: '1.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.78rem', color: '#8A8593', marginBottom: '0.25rem' }}>現在のプラン</p>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: accent }}>
                {plan?.name || user.plan}
              </div>
              {plan && plan.priceJpy > 0 && (
                <div style={{ fontSize: '0.88rem', color: '#5A5562', marginTop: '0.2rem' }}>
                  ¥{plan.priceJpy.toLocaleString()} / 月
                </div>
              )}
            </div>
            <span style={{
              background: grad, color: '#fff',
              padding: '0.25rem 0.7rem', borderRadius: 999,
              fontSize: '0.7rem', fontWeight: 700,
            }}>
              {cancelDone ? '解約予約済' : '有効'}
            </span>
          </div>

          {periodEnd && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <p style={{ fontSize: '0.78rem', color: '#8A8593', marginBottom: '0.15rem' }}>
                {cancelDone ? '利用終了日' : '次回更新日'}
              </p>
              <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{periodEnd}</p>
            </div>
          )}
        </div>

        {/* アカウント情報 */}
        <div style={{
          padding: '1rem 1.25rem', borderRadius: 12,
          background: '#F8F7FA', border: '1px solid rgba(0,0,0,0.06)',
          marginBottom: '1.25rem',
        }}>
          <p style={{ fontSize: '0.78rem', color: '#8A8593', marginBottom: '0.3rem' }}>登録メールアドレス</p>
          <p style={{ fontFamily: 'monospace', fontSize: '0.92rem', fontWeight: 600 }}>{user.email}</p>
        </div>

        {/* プラン切替 / Stripe ポータル */}
        {!cancelDone && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <button
                onClick={() => { setShowPlanSwitcher(s => !s); setSwitchMsg(null); }}
                style={{
                  flex: 1, background: showPlanSwitcher ? '#1F1A2E' : accent, color: '#fff',
                  border: 'none', borderRadius: 999, padding: '0.7rem',
                  fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {showPlanSwitcher ? '閉じる' : 'プランを変更'}
              </button>
              <button
                onClick={handleOpenPortal}
                disabled={portalBusy || !user.stripeCustomerId}
                title={!user.stripeCustomerId ? 'サブスク開始後に利用可能' : 'Stripe で詳細管理'}
                style={{
                  flex: 1, background: '#fff', color: accent,
                  border: `1px solid ${accent}`, borderRadius: 999, padding: '0.7rem',
                  fontSize: '0.88rem', fontWeight: 700,
                  cursor: portalBusy ? 'wait' : 'pointer',
                  opacity: !user.stripeCustomerId ? 0.5 : 1,
                }}
              >
                {portalBusy ? '読み込み中…' : 'Stripe ポータル'}
              </button>
            </div>

            <AnimatePresence>
              {switchMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    padding: '0.65rem 0.9rem', borderRadius: 10, marginBottom: '0.6rem',
                    fontSize: '0.83rem',
                    background: switchMsg.kind === 'ok' ? '#F0FDF4' : '#FEF2F2',
                    border: switchMsg.kind === 'ok' ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                    color: switchMsg.kind === 'ok' ? '#166534' : '#9B1B30',
                  }}
                >
                  {switchMsg.text}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showPlanSwitcher && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.3rem' }}>
                    {getPlans(user.brand)
                      .filter(p => p.id !== 'free')
                      .map(p => {
                        const isCurrent = p.id === user.plan;
                        const busy = switchBusy === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleSwitchPlan(p.id)}
                            disabled={isCurrent || busy}
                            style={{
                              textAlign: 'left', padding: '0.7rem 0.95rem', borderRadius: 12,
                              background: isCurrent ? `${accent}1a` : '#F8F7FA',
                              border: isCurrent ? `1px solid ${accent}` : '1px solid rgba(0,0,0,0.08)',
                              cursor: isCurrent || busy ? 'default' : 'pointer',
                              opacity: busy ? 0.6 : 1,
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: isCurrent ? accent : '#1F1A2E' }}>
                                {p.name}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#8A8593' }}>{p.tagline}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: isCurrent ? accent : '#1F1A2E' }}>
                                ¥{p.priceJpy.toLocaleString()}
                                <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#8A8593' }}>/月</span>
                              </div>
                              {isCurrent && (
                                <div style={{ fontSize: '0.65rem', color: accent, fontWeight: 700, letterSpacing: '0.1em' }}>現在</div>
                              )}
                              {busy && <div style={{ fontSize: '0.7rem', color: '#8A8593' }}>変更中…</div>}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 解約フロー */}
        <AnimatePresence mode="wait">
          {cancelDone ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '1rem', borderRadius: 12,
                background: '#F0FDF4', border: '1px solid #86EFAC',
                fontSize: '0.88rem', color: '#166534', lineHeight: 1.7,
              }}
            >
              ✅ 解約のお手続きが完了しました。<br />
              ご利用期間終了まで引き続きご利用いただけます。<br />
              <strong>復帰クーポン (COMEBACK50)</strong> をメールでお送りしました。
            </motion.div>
          ) : confirmCancel ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '1rem', borderRadius: 12,
                background: 'rgba(200,16,46,0.06)', border: '1px solid rgba(200,16,46,0.2)',
                marginBottom: '0.75rem',
              }}
            >
              <p style={{ fontSize: '0.88rem', color: '#7C2D12', marginBottom: '1rem', lineHeight: 1.7 }}>
                ⚠ 本当に解約しますか？<br />
                現在の請求期間が終了するまでご利用いただけます。
              </p>
              {cancelError && (
                <p style={{ fontSize: '0.83rem', color: '#9B1B30', marginBottom: '0.75rem' }}>
                  エラー: {cancelError}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setConfirmCancel(false)}
                  style={{
                    flex: 1, background: 'rgba(0,0,0,0.05)', color: '#5A5562',
                    border: '1px solid rgba(0,0,0,0.1)', borderRadius: 999,
                    padding: '0.65rem', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelBusy}
                  style={{
                    flex: 1, background: '#DC2626', color: '#fff',
                    border: 'none', borderRadius: 999,
                    padding: '0.65rem', fontSize: '0.88rem', fontWeight: 700,
                    cursor: cancelBusy ? 'wait' : 'pointer',
                    opacity: cancelBusy ? 0.6 : 1,
                  }}
                >
                  {cancelBusy ? '処理中…' : '解約する'}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button
                onClick={() => setConfirmCancel(true)}
                style={{
                  width: '100%', background: 'transparent', color: '#8A8593',
                  border: '1px solid rgba(0,0,0,0.12)', borderRadius: 999,
                  padding: '0.75rem', fontSize: '0.88rem', cursor: 'pointer',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
              >
                サブスクリプションを解約する
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
