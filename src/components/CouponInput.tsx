// ============================================================
// CouponInput — Checkout 直前に Stripe Coupon / Promotion code を入力
//
// オーナー指示 (2026-06-04 第 21 波 ZZZ):
//   「割引コード をお持ちですか?」リンクで開閉。入力 → API で検証 →
//   有効なら緑バッジ + label 表示。Checkout に渡すために値を親に通知。
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Check, X, Loader2 } from 'lucide-react';

export interface AppliedCoupon {
  code: string;
  label: string;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  promotionCodeId?: string;
  couponId?: string;
}

interface Props {
  /** 適用成功時に呼ばれる — Stripe Checkout の discounts に渡す情報 */
  onApply: (c: AppliedCoupon) => void;
  /** 解除時 */
  onClear: () => void;
  /** 既に適用済の場合に表示する */
  applied?: AppliedCoupon | null;
  /** ライト UI 用 — テキスト色を darker に */
  light?: boolean;
}

interface ValidateResponse {
  valid: boolean;
  error?: string;
  label?: string;
  name?: string;
  percentOff?: number | null;
  amountOff?: number | null;
  currency?: string | null;
  promotionCodeId?: string;
  couponId?: string;
}

const ERROR_LABEL: Record<string, string> = {
  invalid_code_format: 'コードの形式が正しくありません',
  rate_limited: '少し時間を置いてから再試行してください',
  stripe_not_configured: 'Stripe 設定エラー (お問い合わせください)',
  expired_or_used: 'このコードは無効です (期限切れまたは使用済)',
  not_found: 'コードが見つかりません',
  bad_json: '通信エラー',
};

export default function CouponInput({ onApply, onClear, applied, light = false }: Props) {
  const [open, setOpen] = useState(!!applied);
  const [code, setCode] = useState(applied?.code || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const baseTextColor = light ? '#1F1A2E' : 'var(--fg)';
  const mutedColor = light ? '#5A5562' : 'var(--fg-muted)';

  const validate = async () => {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/stripe/coupon-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      });
      const j = (await res.json()) as ValidateResponse;
      if (!j.valid) {
        setErr(ERROR_LABEL[j.error || ''] || j.error || 'コードを確認できません');
        return;
      }
      onApply({
        code: c,
        label: j.label || '',
        percentOff: j.percentOff ?? null,
        amountOff: j.amountOff ?? null,
        currency: j.currency ?? null,
        promotionCodeId: j.promotionCodeId,
        couponId: j.couponId,
      });
    } catch (e) {
      setErr((e as Error)?.message || '通信エラー');
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setCode('');
    setErr(null);
    onClear();
  };

  // 適用済 表示
  if (applied) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        borderRadius: 10,
        background: 'rgba(52,211,153,0.1)',
        border: '1px solid rgba(52,211,153,0.35)',
        marginBottom: 12,
      }}>
        <Check size={14} color="#10B981" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#065F46' }}>{applied.code} 適用済</div>
          <div style={{ fontSize: 11, color: '#047857' }}>{applied.label}</div>
        </div>
        <button
          onClick={clear}
          aria-label="コードを解除"
          style={{
            width: 22, height: 22, borderRadius: 11,
            background: 'rgba(0,0,0,0.05)', border: 'none',
            color: '#065F46', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600,
            color: mutedColor, cursor: 'pointer',
            background: 'transparent', border: 'none', padding: 0,
            textDecoration: 'underline',
          }}
        >
          <Tag size={11} /> 割引コード をお持ちですか?
        </button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: baseTextColor, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag size={12} /> 割引コード
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') validate(); }}
                placeholder="例: EARLY50"
                disabled={busy}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: light ? '#fff' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
                  color: baseTextColor,
                  fontSize: 13,
                  fontFamily: 'Menlo, monospace',
                  letterSpacing: '0.05em',
                  outline: 'none',
                }}
              />
              <button
                onClick={validate}
                disabled={busy || !code.trim()}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: busy || !code.trim()
                    ? (light ? '#E5E7EB' : 'rgba(255,255,255,0.1)')
                    : 'linear-gradient(135deg, #A78BFA, #F472B6)',
                  color: '#fff', border: 'none',
                  fontSize: 12, fontWeight: 800,
                  cursor: busy || !code.trim() ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                {busy ? <Loader2 size={12} style={{ animation: 'core-spin 1s linear infinite' }} /> : null}
                適用
              </button>
            </div>
            {err && (
              <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{err}</div>
            )}
            <button
              onClick={() => { setOpen(false); setErr(null); }}
              style={{
                background: 'transparent', border: 'none',
                color: mutedColor, fontSize: 11, padding: 0,
                cursor: 'pointer', textAlign: 'left', marginTop: 2,
              }}
            >閉じる</button>
          </motion.div>
        </AnimatePresence>
      )}
      <style>{`@keyframes core-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
