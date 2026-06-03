// ============================================================
// BillingSuccess — Stripe 決済完了ページ
// /billing/success?session_id=cs_xxx&brand=iris
// syncFromStripe() でプランを確定してアプリへリダイレクト
// ============================================================
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { syncFromStripe } from '../lib/billing';
import { getReferralData, getReferralUrl, REFERRAL_BONUS_DAYS } from '../lib/referral';

type Status = 'loading' | 'success' | 'error';

export default function BillingSuccess() {
  const [status, setStatus] = useState<Status>('loading');
  const [planLabel, setPlanLabel] = useState('');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const planParam = params.get('plan');
    const brand = params.get('brand') || (planParam?.includes('iris') ? 'iris' : 'prism');

    let cancelled = false;

    // ── v2: Stripe Payment Link 経由なら ?plan=v2-... が付く (オーナー指示 2026-06-03) ──
    if (planParam && planParam.startsWith('v2-')) {
      const niceName = ({
        'v2-btoC-light': 'ライト (¥3,000/月)',
        'v2-btoC-standard': 'スタンダード (¥5,000/月)',
        'v2-btoC-pro': 'プロ (¥15,000/月)',
        'v2-btoB-entry': '法人エントリー (¥20,000/月)',
        'v2-btoB-standard': '法人スタンダード (¥30,000/月)',
        'v2-btoB-pro': '法人プロ (¥50,000/月)',
        'v2-enterprise': 'エンタープライズ',
      } as Record<string, string>)[planParam] || planParam;
      setPlanLabel(niceName);
      setStatus('success');
      setTimeout(() => {
        window.location.href = brand === 'iris' ? '/iris?app=1' : '/?app=1';
      }, 2500);
      return;
    }

    // ── v1 互換: session_id 経由 ──
    if (!sessionId) {
      setErrMsg('session_id が見つかりません。');
      setStatus('error');
      return;
    }

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
              <strong>{planLabel}</strong> プランが有効になりました。
            </p>

            {/* 紹介リンク (オーナー指示 2026-06-03: 完了 → 即拡散の動線) */}
            <ReferralBlock brand={brand as 'iris' | 'prism'} accent={accent} grad={grad} />

            <p style={{ color: '#8A8593', fontSize: '0.85rem', marginTop: '1.5rem' }}>
              ※ あと数秒でアプリへ移動します
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

// ─── 紹介リンク ブロック (オーナー指示 2026-06-03) ─────
function ReferralBlock({ brand, accent, grad }: { brand: 'iris' | 'prism'; accent: string; grad: string }) {
  const [data] = useState(() => getReferralData());
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const url = getReferralUrl(brand, data.myCode);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  };

  const handleShare = async () => {
    const text = brand === 'iris'
      ? `Iris (SNS クリエイター向け AI チーム) を使い始めました。私の紹介リンクからの登録で、お互い +${REFERRAL_BONUS_DAYS} 日無料です:`
      : `CORE Prism (経営者向け AI 役員 13 名) を使い始めました。私の紹介リンクからの登録で、お互い +${REFERRAL_BONUS_DAYS} 日無料です:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: brand === 'iris' ? 'CORE Iris' : 'CORE Prism', text, url });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(
    brand === 'iris'
      ? `Iris (SNS クリエイター向け 6 人の AI チーム) を始めました ✨\n紹介リンクからの登録で、お互い +${REFERRAL_BONUS_DAYS} 日無料に。\n`
      : `CORE Prism (経営者の AI 役員 13 名) を始めました 👑\n紹介リンクからの登録で、お互い +${REFERRAL_BONUS_DAYS} 日無料に。\n`
  )}&url=${encodeURIComponent(url)}`;

  return (
    <div style={{
      marginTop: '1.75rem',
      padding: '1.25rem 1rem',
      borderRadius: 14,
      background: `linear-gradient(135deg, ${accent}10, ${accent}05)`,
      border: `1px solid ${accent}33`,
      textAlign: 'left',
    }}>
      <div style={{
        fontSize: 10.5, letterSpacing: '0.2em', color: accent,
        fontWeight: 800, marginBottom: 6,
      }}>
        🎁 友達紹介で +{REFERRAL_BONUS_DAYS} 日無料
      </div>
      <p style={{ fontSize: 13, color: '#1F1A2E', lineHeight: 1.7, marginBottom: 10, fontWeight: 600 }}>
        友達 1 人紹介 → <strong>お互いに +{REFERRAL_BONUS_DAYS} 日</strong> 無料が延長されます
      </p>
      <div style={{
        background: '#fff', borderRadius: 8, padding: '8px 10px',
        fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5,
        color: '#3A3A4E', wordBreak: 'break-all',
        border: '1px solid rgba(0,0,0,0.08)', marginBottom: 10,
      }}>
        {url}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1, minWidth: 100,
            padding: '8px 12px', borderRadius: 8,
            background: copied ? '#34D399' : grad,
            color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 12.5, fontWeight: 800,
            transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ コピーしました' : '📋 リンクをコピー'}
        </button>
        <a
          href={xUrl}
          target="_blank" rel="noopener noreferrer"
          style={{
            padding: '8px 14px', borderRadius: 8,
            background: '#0a0a0f', color: '#fff', textDecoration: 'none',
            fontSize: 12.5, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          𝕏 でシェア
        </a>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={handleShare}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: 'rgba(0,0,0,0.06)', color: '#3A3A4E',
              border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 700,
            }}
          >
            {shared ? '✓' : '📤 共有'}
          </button>
        )}
      </div>
      <p style={{ fontSize: 10.5, color: '#8A8593', marginTop: 8, lineHeight: 1.6 }}>
        あなたの紹介コード: <strong style={{ color: accent }}>{data.myCode}</strong>
        {data.referredCount > 0 && (
          <span> · 紹介済: {data.referredCount} 人 (累計 +{data.bonusDays} 日)</span>
        )}
      </p>
    </div>
  );
}
