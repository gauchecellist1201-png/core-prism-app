// ============================================================
// CheckoutModal — 4ステップ決済フロー
//
// Step 1: プラン選択 (ブランドタブ × 月額/年額トグル × プランカード)
// Step 2: アカウント作成
// Step 3: 決済 (Stripe Checkout or テストモード)
// Step 4: 完了
//
// env 設定済み: /api/stripe/checkout を叩き Stripe Checkout へリダイレクト
// env 未設定 (503): テストモード (¥0) にフォールバック
// ============================================================
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type Plan, type Brand, type BillingCycle,
  useBillingUser, getPlans, getPlanPrice, findPlan, isMasterAuth,
} from '../lib/billing';
import { getPendingReferral, REFERRAL_BONUS_DAYS } from '../lib/referral';
import { sendEmail } from '../lib/emailNotify';
import { isBiometricAvailable, registerBiometric } from '../lib/biometricAuth';

interface Props {
  brand: Brand;
  plan: Plan;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'plan' | 'account' | 'payment' | 'success';

export default function CheckoutModal({ brand: initialBrand, plan: initialPlan, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('plan');
  // ブランドは入った経路で固定 (Iris リンク→Iris、Prism リンク→Prism)
  const brand: Brand = initialBrand;
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [planId, setPlanId] = useState<string>(initialPlan.id);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const { signup } = useBillingUser();

  // 招待リンク経由かどうか (?ref=XXX が sessionStorage に保留されている)
  const pendingReferral = useMemo(() => getPendingReferral(), []);
  const hasReferralBonus = !!pendingReferral;

  // 現在選択中の Plan
  const plan = findPlan(brand, planId as any) || getPlans(brand)[0];
  const isFree = plan.priceJpy === 0;
  const displayPrice = getPlanPrice(plan, cycle);
  const monthlyEquivalent = cycle === 'yearly' && plan.priceJpy_yearly
    ? Math.round(plan.priceJpy_yearly / 12)
    : plan.priceJpy;

  const proceedToAccount = () => setStep('account');

  const proceedToPayment = () => {
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('正しいメールアドレスを入れてください');
      return;
    }
    if (password.length < 6) {
      setError('パスワードは 6 文字以上で設定してください');
      return;
    }
    if (password !== passwordConfirm) {
      setError('パスワードが一致しません');
      return;
    }
    setStep('payment');
  };

  const completePayment = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!isFree) {
        let stripeUrl: string | null = null;
        try {
          const resp = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: plan.id, brand, email, cycle }),
          });
          if (resp.status === 503) {
            setIsTestMode(true);
          } else if (resp.ok) {
            const data = await resp.json() as { url?: string };
            stripeUrl = data.url ?? null;
          } else {
            const err = await resp.json() as { error?: string };
            throw new Error(err.error || 'Stripe エラーが発生しました');
          }
        } catch (fetchErr: any) {
          if (fetchErr.message?.includes('STRIPE_NOT_CONFIGURED') || fetchErr.message?.includes('503')) {
            setIsTestMode(true);
          } else {
            throw fetchErr;
          }
        }

        if (stripeUrl) {
          await signup({ email, password, brand, plan: plan.id });
          sendEmail(email, 'welcome', { name: email.split('@')[0], brand });
          window.location.href = stripeUrl;
          return;
        }
      }

      await signup({ email, password, brand, plan: plan.id });
      sendEmail(email, 'welcome', { name: email.split('@')[0], brand });
      if (await isBiometricAvailable()) {
        registerBiometric({ email, displayName: email.split('@')[0] }).catch(() => { /* */ });
      }
      setStep('success');
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました');
    } finally {
      setBusy(false);
    }
  };

  const goToApp = () => {
    onSuccess?.();
    onClose();
    window.location.href = brand === 'iris' ? '/iris?app=1' : '/?app=1';
  };

  const accent = brand === 'iris' ? '#E1306C' : '#0033A0';
  const accentGrad = brand === 'iris'
    ? 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)'
    : 'linear-gradient(135deg, #0033A0, #1A4FC4)';

  const showingTestMode = isTestMode || isFree;
  const plans = getPlans(brand);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
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
          background: '#FFFFFF', borderRadius: 24, padding: '1.5rem',
          maxWidth: step === 'plan' ? 920 : 540, width: '100%',
          maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto',
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#1F1A2E',
          boxShadow: '0 30px 80px rgba(15,10,25,0.4)',
        }}
      >
        {/* ヘッダ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: accent, fontWeight: 700, textTransform: 'uppercase' }}>
              {brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} · {step === 'plan' ? 'プラン選択' : step === 'account' ? 'アカウント作成' : step === 'payment' ? 'お支払い' : '完了'}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.3rem 0 0', lineHeight: 1.3 }}>
              {step === 'plan' ? 'あなたに合うプランは？' : plan.name}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
            width: 44, height: 44, cursor: 'pointer', fontSize: '1rem',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }} aria-label="閉じる">✕</button>
        </div>

        {/* ステッパー */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
          {(['plan', 'account', 'payment', 'success'] as Step[]).map((s, i) => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: (['plan', 'account', 'payment', 'success'] as Step[]).indexOf(step) >= i
                ? accentGrad
                : 'rgba(0,0,0,0.08)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 'plan' && (
            <motion.div key="plan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {/* 招待リンク経由ボーナス バナー */}
              {hasReferralBonus && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.85rem 1rem',
                  background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                  border: '1.5px solid #F59E0B',
                  borderRadius: 14,
                  display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: '0 4px 14px rgba(245,158,11,0.18)',
                }}>
                  <div style={{ fontSize: '1.5rem' }}>🎁</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#78350F' }}>
                      友達招待ボーナス +{REFERRAL_BONUS_DAYS} 日
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#92400E', lineHeight: 1.45 }}>
                      招待コード <strong style={{ letterSpacing: '0.08em' }}>{pendingReferral}</strong> が適用されます。
                      通常 7 日 + 招待 {REFERRAL_BONUS_DAYS} 日 = <strong>合計 {7 + REFERRAL_BONUS_DAYS} 日 無料</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* ブランド表示 (タブは廃止、入った経路のブランドで固定) */}
              <div style={{
                marginBottom: '1rem',
                padding: '0.7rem 1rem',
                background: brand === 'iris'
                  ? 'linear-gradient(135deg, rgba(225,48,108,0.10), rgba(247,119,55,0.06))'
                  : 'linear-gradient(135deg, rgba(0,51,160,0.10), rgba(46,111,255,0.06))',
                border: `1px solid ${brand === 'iris' ? 'rgba(225,48,108,0.30)' : 'rgba(0,51,160,0.25)'}`,
                borderRadius: 14,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: brand === 'iris'
                    ? 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)'
                    : 'linear-gradient(135deg, #0033A0, #1A4FC4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 16,
                  flexShrink: 0,
                }}>
                  {brand === 'iris' ? 'I' : 'P'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1F1A2E' }}>
                    {brand === 'iris' ? 'CORE Iris' : 'CORE Prism'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#5A5562' }}>
                    {brand === 'iris' ? 'クリエイター / インフルエンサー向け' : '経営者 / 事業家向け'}
                  </div>
                </div>
              </div>

              {/* 月額 / 年額トグル */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', marginBottom: '1.25rem',
              }}>
                <button type="button" onClick={() => setCycle('monthly')} style={{
                  background: cycle === 'monthly' ? '#1F1A2E' : 'transparent',
                  color: cycle === 'monthly' ? '#fff' : '#5A5562',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 999, padding: '0.45rem 1rem',
                  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                }}>月額</button>
                <button type="button" onClick={() => setCycle('yearly')} style={{
                  background: cycle === 'yearly' ? '#1F1A2E' : 'transparent',
                  color: cycle === 'yearly' ? '#fff' : '#5A5562',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 999, padding: '0.45rem 1rem',
                  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}>
                  年額
                  <span style={{
                    background: '#10B981', color: '#fff',
                    fontSize: '0.65rem', padding: '0.1rem 0.4rem',
                    borderRadius: 999, fontWeight: 700,
                  }}>2ヶ月分お得</span>
                </button>
              </div>

              {/* 7 日間 無料スタートの大きな帯 (全プラン共通) */}
              <div style={{
                marginBottom: '1.1rem',
                padding: '0.85rem 1.1rem',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #ECFDF5, #F0FDF4)',
                border: '1.5px solid #10B981',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 800, color: '#fff',
                  background: '#10B981', padding: '0.2rem 0.55rem',
                  borderRadius: 999, letterSpacing: '0.04em',
                }}>7 日間 無料</span>
                <span style={{ fontSize: '0.82rem', color: '#065F46', fontWeight: 600, lineHeight: 1.5 }}>
                  どのプランも、最初の 7 日間は <strong>¥0</strong>。8 日目から自動でスタート。いつでも解約 OK。
                </span>
              </div>

              {/* プランカード (モバイル 1 列 / デスクトップ複数列) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.75rem',
              }}>
                {plans.filter(p => p.id !== 'free').map(p => {
                  const selected = p.id === planId;
                  const price = getPlanPrice(p, cycle);
                  const monthly = cycle === 'yearly' && p.priceJpy_yearly
                    ? Math.round(p.priceJpy_yearly / 12)
                    : p.priceJpy;
                  return (
                    <button key={p.id} type="button" onClick={() => setPlanId(p.id)} style={{
                      textAlign: 'left',
                      padding: '1.1rem 1rem',
                      borderRadius: 16,
                      background: selected ? `${accent}0F` : '#FAFAF8',
                      border: selected ? `2px solid ${accent}` : '1px solid rgba(0,0,0,0.08)',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.18s',
                    }}>
                      {p.badge && (
                        <span style={{
                          position: 'absolute', top: -10, right: 12,
                          background: accentGrad, color: '#fff',
                          padding: '0.2rem 0.6rem', borderRadius: 999,
                          fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em',
                        }}>
                          {p.badge}
                        </span>
                      )}
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.25rem', color: '#1F1A2E' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#8A8593', marginBottom: '0.6rem', minHeight: '1.2em' }}>
                        {p.tagline}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: accent }}>
                          ¥{price.toLocaleString()}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#5A5562' }}>
                          / {cycle === 'yearly' ? '年' : '月'}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '0.68rem', color: '#10B981', fontWeight: 700, marginBottom: '0.5rem',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span>✦</span> 最初の 7 日間 ¥0、その後 自動スタート
                      </div>
                      {cycle === 'yearly' && (
                        <div style={{ fontSize: '0.68rem', color: '#10B981', marginBottom: '0.5rem', fontWeight: 600 }}>
                          月あたり ¥{monthly.toLocaleString()}
                        </div>
                      )}
                      <ul style={{
                        paddingLeft: '1rem', margin: 0,
                        fontSize: '0.74rem', lineHeight: 1.6, color: '#1F1A2E',
                      }}>
                        {p.features.slice(0, 4).map((f, i) => <li key={i}>{f}</li>)}
                        {p.features.length > 4 && (
                          <li style={{ color: '#8A8593' }}>+ {p.features.length - 4} 項目</li>
                        )}
                      </ul>
                      <div style={{
                        marginTop: '0.8rem',
                        padding: '0.4rem 0.6rem',
                        borderRadius: 999,
                        background: selected ? accentGrad : 'rgba(0,0,0,0.04)',
                        color: selected ? '#fff' : '#5A5562',
                        fontSize: '0.75rem', fontWeight: 700, textAlign: 'center',
                      }}>
                        {selected ? '✓ 選択中' : '選ぶ'}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{
                marginTop: '1.25rem',
                padding: '0.85rem 1rem', borderRadius: 12,
                background: '#F8F7FA', border: '1px solid rgba(0,0,0,0.06)',
                fontSize: '0.78rem', color: '#5A5562', lineHeight: 1.7,
              }}>
                <strong style={{ color: '#1F1A2E' }}>選択中:</strong> {brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} · {plan.name} · ¥{displayPrice.toLocaleString()} / {cycle === 'yearly' ? '年' : '月'}
                {cycle === 'yearly' && plan.priceJpy_yearly && (
                  <> ({plan.priceJpy * 12 - plan.priceJpy_yearly > 0 && <>¥{(plan.priceJpy * 12 - plan.priceJpy_yearly).toLocaleString()} お得</>})</>
                )}
              </div>

              <button onClick={proceedToAccount} style={{
                width: '100%',
                background: accentGrad, color: '#fff',
                border: 'none', borderRadius: 999,
                padding: '0.95rem 1.4rem',
                fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 8px 24px ${accent}55`,
                marginTop: '1rem',
              }}>
                次へ →
              </button>
            </motion.div>
          )}

          {step === 'account' && (
            <motion.div key="account" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <p style={{ marginBottom: '1rem', color: '#5A5562', fontSize: '0.92rem' }}>
                ログイン情報を作成します。
              </p>

              <Field label="メールアドレス" required>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email"
                  style={inp} />
              </Field>

              <Field label="パスワード" required hint="6 文字以上">
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="6 文字以上" autoComplete="new-password"
                    style={{ ...inp, flex: 1 }} />
                  <button onClick={() => setShowPassword(s => !s)} type="button" style={{
                    background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 12, padding: '0.6rem 0.8rem', cursor: 'pointer',
                    fontSize: '0.78rem', color: '#5A5562',
                  }}>
                    {showPassword ? '隠す' : '表示'}
                  </button>
                </div>
              </Field>

              <Field label="パスワード (確認)" required>
                <input type={showPassword ? 'text' : 'password'} value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="もう一度" autoComplete="new-password"
                  style={inp} />
              </Field>

              {error && <ErrorBox msg={error} />}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep('plan')} style={btnSecondary}>← 戻る</button>
                <button onClick={proceedToPayment} style={{ ...btnPrimary(accent, accentGrad), flex: 2 }}>
                  {isFree
                    ? (hasReferralBonus
                        ? `✨ ${7 + REFERRAL_BONUS_DAYS}日間 無料ではじめる →`
                        : '✨ 7日間 無料ではじめる →')
                    : '次へ →'}
                </button>
              </div>

              <p style={{ marginTop: '0.85rem', fontSize: '0.75rem', color: '#8A8593', lineHeight: 1.7 }}>
                パスワードは SHA-256 でハッシュ化してブラウザ内に保存されます。
                サーバーには平文で送信されません。
              </p>
            </motion.div>
          )}

          {step === 'payment' && (
            <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div style={{
                padding: '1.25rem', borderRadius: 16,
                background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)',
                border: '1px solid rgba(16,185,129,0.25)',
                marginBottom: '1rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#065F46', fontWeight: 600 }}>{plan.name} プラン ({cycle === 'yearly' ? '年額' : '月額'})</span>
                  <span style={{ fontWeight: 700, color: '#374151' }}>¥{displayPrice.toLocaleString()} / {cycle === 'yearly' ? '年' : '月'}</span>
                </div>
                {isFree ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#10B981', fontWeight: 700 }}>7日間 無料トライアル</span>
                      <span style={{ color: '#10B981', fontWeight: 800 }}>¥0</span>
                    </div>
                    {hasReferralBonus && (
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        marginBottom: '0.5rem',
                        padding: '0.5rem 0.65rem', borderRadius: 10,
                        background: 'rgba(245,158,11,0.10)', border: '1px dashed #F59E0B',
                      }}>
                        <span style={{ color: '#92400E', fontWeight: 700 }}>🎁 友達招待ボーナス +{REFERRAL_BONUS_DAYS} 日</span>
                        <span style={{ color: '#92400E', fontWeight: 800 }}>¥0</span>
                      </div>
                    )}
                    <div style={{ height: 1, background: 'rgba(16,185,129,0.2)', margin: '0.6rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#065F46' }}>
                        本日のお支払い {hasReferralBonus && <span style={{ fontSize: '0.78rem', color: '#92400E', fontWeight: 700 }}>(計 {7 + REFERRAL_BONUS_DAYS} 日無料)</span>}
                      </span>
                      <span style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10B981' }}>¥0</span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 全プラン共通 7 日間 無料 (Stripe trial_period_days=7) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#10B981', fontWeight: 700 }}>✦ 7 日間 無料トライアル</span>
                      <span style={{ color: '#10B981', fontWeight: 800 }}>¥0</span>
                    </div>
                    {hasReferralBonus && (
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        marginBottom: '0.5rem',
                        padding: '0.5rem 0.65rem', borderRadius: 10,
                        background: 'rgba(245,158,11,0.10)', border: '1px dashed #F59E0B',
                      }}>
                        <span style={{ color: '#92400E', fontWeight: 700 }}>🎁 友達招待ボーナス +{REFERRAL_BONUS_DAYS} 日</span>
                        <span style={{ color: '#92400E', fontWeight: 800 }}>¥0</span>
                      </div>
                    )}
                    <div style={{ height: 1, background: 'rgba(16,185,129,0.2)', margin: '0.6rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#065F46' }}>本日のお支払い</span>
                      <span style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10B981' }}>¥0</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#065F46', marginTop: '0.5rem', lineHeight: 1.7 }}>
                      {`8 日後 (${new Date(Date.now() + (7 + (hasReferralBonus ? REFERRAL_BONUS_DAYS : 0)) * 86400000).toLocaleDateString('ja-JP')}) から ¥${displayPrice.toLocaleString()} / ${cycle === 'yearly' ? '年' : '月'} で自動スタート。いつでも解約 OK。`}
                    </div>
                    {cycle === 'yearly' && plan.priceJpy_yearly && (
                      <p style={{ fontSize: '0.78rem', color: '#065F46', marginTop: '0.5rem', lineHeight: 1.7 }}>
                        年間契約で月あたり ¥{monthlyEquivalent.toLocaleString()} ・ 月額契約より ¥{(plan.priceJpy * 12 - plan.priceJpy_yearly).toLocaleString()} お得
                      </p>
                    )}
                  </>
                )}
              </div>

              {showingTestMode ? (
                <div style={{
                  padding: '0.95rem 1.1rem', borderRadius: 14,
                  background: '#FEF3C7', border: '1px solid #FCD34D',
                  fontSize: '0.88rem', color: '#7C2D12', marginBottom: '1rem', lineHeight: 1.7,
                }}>
                  <strong>ベータ確認モード</strong><br />
                  {isFree
                    ? 'カード情報は不要です。¥0 で 7 日間トライアル開始。'
                    : 'Stripe 接続準備中です。今回は ¥0 で登録 → 後日決済画面をご案内します。'}
                  {isMasterAuth() && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <a href="/master/stripe-status" style={{ color: '#7C2D12', textDecoration: 'underline', fontWeight: 700 }}>
                        → Stripe 接続診断を開く (オーナー)
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '0.95rem 1.1rem', borderRadius: 14,
                  background: '#EBF8FF', border: '1px solid #90CDF4',
                  fontSize: '0.88rem', color: '#2A4365', marginBottom: '1rem', lineHeight: 1.7,
                }}>
                  次の画面で <strong>カード情報を登録</strong>します (Stripe の安全な画面)。
                </div>
              )}

              {error && <ErrorBox msg={error} />}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep('account')} style={btnSecondary}>← 戻る</button>
                <button onClick={completePayment} disabled={busy} style={{
                  ...btnPrimary(accent, accentGrad),
                  flex: 2, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer',
                }}>
                  {busy
                    ? '処理中…'
                    : showingTestMode
                      ? (isFree ? '✨ 無料トライアル開始 (¥0)' : '✨ 仮登録する (¥0)')
                      : '✨ カードを登録して 7 日無料を始める (本日 ¥0)'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                  style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: accentGrad,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2.5rem', color: '#fff',
                    boxShadow: `0 12px 32px ${accent}66`,
                    marginBottom: '1.25rem',
                  }}>
                  ✓
                </motion.div>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                  ようこそ、{brand === 'iris' ? 'Iris' : 'CORE Prism'} へ。
                </h3>
                <p style={{ color: '#5A5562', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: '1rem' }}>
                  <strong>{plan.name}</strong> プランでアカウントが発行されました。
                </p>
                <div style={{
                  padding: '0.85rem 1rem', borderRadius: 12,
                  background: '#F8F7FA', border: '1px solid rgba(0,0,0,0.06)',
                  textAlign: 'left', marginBottom: '1.25rem',
                }}>
                  <p style={{ fontSize: '0.78rem', color: '#8A8593', marginBottom: '0.3rem' }}>ログイン情報</p>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}>{email}</p>
                  <p style={{ fontSize: '0.78rem', color: '#8A8593', marginTop: '0.4rem' }}>
                    パスワードは設定したものをご使用ください。
                  </p>
                </div>
              </div>
              <button onClick={goToApp} style={{ ...btnPrimary(accent, accentGrad), width: '100%' }}>
                {brand === 'iris' ? 'Iris を始める' : 'CORE Prism を始める'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)',
      padding: '0.6rem 0.85rem', borderRadius: 12, marginBottom: '0.75rem',
      color: '#9B1B30', fontSize: '0.85rem',
    }}>⚠ {msg}</div>
  );
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <label style={{ display: 'block', fontSize: '0.8rem', color: '#5A5562', marginBottom: '0.3rem', fontWeight: 600 }}>
        {label} {required && <span style={{ color: '#E1306C' }}>*</span>}
        {hint && <span style={{ marginLeft: '0.4rem', color: '#8A8593', fontWeight: 400 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%',
  background: '#FFFFFF',
  border: '1px solid rgba(0,0,0,0.12)',
  color: '#1F1A2E',
  padding: '0.7rem 0.95rem',
  borderRadius: 12,
  fontSize: '16px',
  outline: 'none',
  fontFamily: 'inherit',
};

const btnSecondary: React.CSSProperties = {
  flex: 1,
  background: 'rgba(0,0,0,0.04)',
  color: '#5A5562',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 999,
  padding: '0.85rem 1.4rem',
  fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
};

function btnPrimary(_accent: string, gradient: string): React.CSSProperties {
  return {
    background: gradient,
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '0.95rem 1.4rem',
    fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
  };
}
