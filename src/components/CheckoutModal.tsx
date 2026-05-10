// ============================================================
// CheckoutModal — 4ステップ決済フロー
//
// env 設定済み: /api/stripe/checkout を叩き Stripe Checkout へリダイレクト
// env 未設定 (503): テストモード (¥0) にフォールバック
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type Plan, type Brand, useBillingUser,
} from '../lib/billing';
import { sendEmail } from '../lib/emailNotify';
import { isBiometricAvailable, registerBiometric } from '../lib/biometricAuth';

interface Props {
  brand: Brand;
  plan: Plan;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'plan' | 'account' | 'payment' | 'success';

export default function CheckoutModal({ brand, plan, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('plan');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // true = Stripe 本番セッション確立済み、false = テストモード
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const { signup } = useBillingUser();

  const isFree = plan.priceJpy === 0;

  // ステップ 1 → 2
  const proceedToAccount = () => setStep('account');

  // ステップ 2 → 3: バリデーション
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

  // ステップ 3: 決済実行
  const completePayment = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!isFree) {
        // Stripe セッション作成を試みる
        let stripeUrl: string | null = null;
        try {
          const resp = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: plan.id, brand, email }),
          });
          if (resp.status === 503) {
            // env 未設定 → テストモードにフォールバック
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
          // 先に signup してから Stripe へ
          await signup({ email, password, brand, plan: plan.id });
          // welcome メール (非同期・失敗無視)
          sendEmail(email, 'welcome', { name: email.split('@')[0], brand });
          window.location.href = stripeUrl;
          return;
        }
      }

      // テストモード / 無料プラン: 即 signup → success
      await signup({ email, password, brand, plan: plan.id });
      // welcome メール (非同期・失敗無視)
      sendEmail(email, 'welcome', { name: email.split('@')[0], brand });
      // Face ID / Touch ID 登録 (失敗しても続行)
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

  // 完了 → アプリへ
  const goToApp = () => {
    onSuccess?.();
    onClose();
    window.location.href = brand === 'iris' ? '/iris?app=1' : '/?app=1';
  };

  const accent = brand === 'iris' ? '#E1306C' : '#0033A0';
  const accentGrad = brand === 'iris'
    ? 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)'
    : 'linear-gradient(135deg, #0033A0, #1A4FC4)';

  // 決済画面でテストモードかどうか (isFree は常にテスト扱い)
  const showingTestMode = isTestMode || isFree;

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
          background: '#FFFFFF', borderRadius: 24, padding: '1.75rem',
          maxWidth: 540, width: '100%', maxHeight: '92vh', overflow: 'auto',
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#1F1A2E',
          boxShadow: '0 30px 80px rgba(15,10,25,0.4)',
        }}
      >
        {/* ヘッダ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: accent, fontWeight: 700, textTransform: 'uppercase' }}>
              {brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} · {step === 'plan' ? 'プラン確認' : step === 'account' ? 'アカウント作成' : step === 'payment' ? 'お支払い' : '完了'}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.3rem 0 0', lineHeight: 1.3 }}>
              {plan.name}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', fontSize: '0.9rem',
          }}>✕</button>
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
          {/* Step 1: プラン詳細 */}
          {step === 'plan' && (
            <motion.div key="plan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div style={{
                padding: '1.25rem', borderRadius: 16,
                background: `${accent}11`,
                border: `1px solid ${accent}33`,
                marginBottom: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 900, color: accent }}>
                    ¥{plan.priceJpy.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#5A5562' }}>/ 月</span>
                  {plan.badge && (
                    <span style={{
                      marginLeft: 'auto',
                      background: accentGrad, color: '#fff',
                      padding: '0.18rem 0.6rem', borderRadius: 999,
                      fontSize: '0.7rem', fontWeight: 700,
                    }}>
                      {plan.badge}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.85rem', color: '#5A5562', marginBottom: '0.75rem' }}>{plan.tagline}</p>
                <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.9, fontSize: '0.88rem', color: '#1F1A2E' }}>
                  {plan.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>

              <button onClick={proceedToAccount} style={{
                width: '100%',
                background: accentGrad, color: '#fff',
                border: 'none', borderRadius: 999,
                padding: '0.95rem 1.4rem',
                fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 8px 24px ${accent}55`,
              }}>
                次へ →
              </button>
            </motion.div>
          )}

          {/* Step 2: アカウント作成 */}
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
                <button onClick={() => setStep('plan')} style={btnSecondary}>← 戺る</button>
                <button onClick={proceedToPayment} style={{ ...btnPrimary(accent, accentGrad), flex: 2 }}>
                  ✨ 14日間 無料ではじめる →
                </button>
              </div>

              <p style={{ marginTop: '0.85rem', fontSize: '0.75rem', color: '#8A8593', lineHeight: 1.7 }}>
                🔒 パスワードは SHA-256 でハッシュ化してブラウザ内に保存されます。
                サーバーには平文で送信されません。
              </p>
            </motion.div>
          )}

          {/* Step 3: 14日間 無料トライアル開始 */}
          {step === 'payment' && (
            <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div style={{
                padding: '1.25rem', borderRadius: 16,
                background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)',
                border: '1px solid rgba(16,185,129,0.25)',
                marginBottom: '1rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#065F46', fontWeight: 600 }}>{plan.name} プラン</span>
                  <span style={{ fontWeight: 700, color: '#374151' }}>¥{plan.priceJpy.toLocaleString()} / 月</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#10B981', fontWeight: 700 }}>14日間 無料トライアル</span>
                  <span style={{ color: '#10B981', fontWeight: 800 }}>-¥{plan.priceJpy.toLocaleString()}</span>
                </div>
                <div style={{ height: 1, background: 'rgba(16,185,129,0.2)', margin: '0.6rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#065F46' }}>本日のお支払い</span>
                  <span style={{ fontSize: '1.85rem', fontWeight: 900, color: '#10B981' }}>¥0</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#065F46', marginTop: '0.5rem', lineHeight: 1.7 }}>
                  ✓ 今すぐ全機能が使えます<br />
                  ✓ 15 日目から ¥{plan.priceJpy.toLocaleString()}/月 を自動課金<br />
                  ✓ いつでも 1 タップで解約可能（解約まで請求は発生しません）
                </p>
              </div>

              {showingTestMode ? (
                <div style={{
                  padding: '0.95rem 1.1rem', borderRadius: 14,
                  background: '#FEF3C7', border: '1px solid #FCD34D',
                  fontSize: '0.88rem', color: '#7C2D12', marginBottom: '1rem', lineHeight: 1.7,
                }}>
                  🧪 <strong>ベータ確認モード</strong><br />
                  カード情報は不要です。¥0 で 14 日間トライアル開始。
                </div>
              ) : (
                <div style={{
                  padding: '0.95rem 1.1rem', borderRadius: 14,
                  background: '#EBF8FF', border: '1px solid #90CDF4',
                  fontSize: '0.88rem', color: '#2A4365', marginBottom: '1rem', lineHeight: 1.7,
                }}>
                  💳 次の画面で <strong>カード情報を 1 度だけ登録</strong>します（Stripe の安全な画面）。<br />
                  今日の請求は <strong>¥0</strong>。15 日目から自動で月額が始まります。
                </div>
              )}

              {error && <ErrorBox msg={error} />}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep('account')} style={btnSecondary}>← 戺る</button>
                <button onClick={completePayment} disabled={busy} style={{
                  ...btnPrimary(accent, accentGrad),
                  flex: 2, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer',
                }}>
                  {busy
                    ? '処理中…'
                    : showingTestMode
                      ? '✨ 無料トライアル開始 (¥0)'
                      : '✨ 14日間 無料で始める →'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: 完了 */}
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
                {brand === 'iris' ? '🌹 Iris を始める' : '✨ CORE Prism を始める'}
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
