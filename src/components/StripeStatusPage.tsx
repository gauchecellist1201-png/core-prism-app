// ============================================================
// StripeStatusPage — オーナー専用 Stripe 接続診断
// /master/stripe-status で表示。master key 認証が必要。
//
// 表示内容:
// - STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET の設定状況
// - 14 個の Price ID それぞれの設定 + Stripe API での valid 検証
// - 月額 / 年額 の網羅性
// - チェックリスト形式 + 「もう一度チェック」ボタン
// ============================================================
import { useEffect, useState } from 'react';
import { isMasterAuth } from '../lib/billing';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, ExternalLink, Shield } from 'lucide-react';

const MASTER_KEY = 'GAUCHE2026';

interface PriceCheckResult {
  env_key: string;
  label: string;
  brand: 'iris' | 'prism';
  plan: string;
  cycle: 'monthly' | 'yearly';
  present: boolean;
  value_masked: string | null;
  valid?: boolean;
  unit_amount?: number;
  currency?: string;
  interval?: string;
  error?: string;
}

interface DiagnoseResponse {
  configured: boolean;
  secret_key_present: boolean;
  secret_key_mode: 'live' | 'test' | 'unknown' | null;
  webhook_secret_present: boolean;
  prices: PriceCheckResult[];
  missing: string[];
  invalid_prices: string[];
  checked_at: string;
}

export default function StripeStatusPage() {
  const [data, setData] = useState<DiagnoseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authorized = isMasterAuth();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/stripe/diagnose?master=${encodeURIComponent(MASTER_KEY)}`, {
        headers: { 'x-master-key': MASTER_KEY },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const json = await resp.json() as DiagnoseResponse;
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'ネットワークエラー');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) load();
  }, [authorized]);

  if (!authorized) {
    return (
      <div style={pageWrap}>
        <div style={card}>
          <Shield size={40} color="#E1306C" />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.5rem' }}>
            オーナー専用
          </h1>
          <p style={{ color: '#8A8593', marginTop: '0.5rem' }}>
            このページはマスター認証が必要です。
          </p>
          <a href="/master" style={btnSecondary}>マスター画面へ</a>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: '#E1306C', fontWeight: 700, textTransform: 'uppercase' }}>
                Master · Stripe Diagnostic
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.3rem 0 0' }}>
                Stripe 接続診断
              </h1>
              <p style={{ color: '#8A8593', marginTop: '0.4rem', fontSize: '0.9rem' }}>
                Vercel に設定した環境変数 + Stripe API で Price ID の整合性を確認します。
              </p>
            </div>
            <button onClick={load} disabled={loading} style={btnPrimary}>
              <RefreshCw size={16} style={{ marginRight: 6 }} />
              {loading ? 'チェック中…' : 'もう一度チェック'}
            </button>
          </div>
        </header>

        {error && (
          <div style={{
            ...card,
            border: '1px solid rgba(200,16,46,0.3)', background: 'rgba(200,16,46,0.05)',
          }}>
            <XCircle size={24} color="#9B1B30" />
            <strong style={{ color: '#9B1B30' }}>診断エラー</strong>
            <p style={{ color: '#5A5562', marginTop: '0.3rem' }}>{error}</p>
          </div>
        )}

        {loading && !data && (
          <div style={card}>
            <Loader2 size={28} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#8A8593', marginTop: '0.5rem' }}>診断中…</p>
          </div>
        )}

        {data && (
          <>
            {/* 全体ステータス */}
            <div style={{
              ...card,
              border: data.configured ? '2px solid #10B981' : '2px solid #F59E0B',
              background: data.configured ? 'linear-gradient(135deg, #F0FDF4, #ECFDF5)' : 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
            }}>
              {data.configured ? (
                <CheckCircle2 size={36} color="#10B981" />
              ) : (
                <AlertTriangle size={36} color="#F59E0B" />
              )}
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.5rem 0 0.25rem' }}>
                {data.configured ? '✓ 本番稼働可能' : '⚠ 設定が不完全'}
              </h2>
              <p style={{ color: '#5A5562', fontSize: '0.9rem' }}>
                {data.configured
                  ? 'Stripe 接続は完全に構成されています。決済受付可能。'
                  : `${data.missing.length} 個の env 未設定 · ${data.invalid_prices.length} 個の Price ID 無効`}
              </p>
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#8A8593' }}>
                最終チェック: {new Date(data.checked_at).toLocaleString('ja-JP')}
              </div>
            </div>

            {/* シークレットキー */}
            <div style={card}>
              <h3 style={sectionTitle}>シークレットキー</h3>
              <StatusRow
                label="STRIPE_SECRET_KEY"
                hint={data.secret_key_present ? `モード: ${data.secret_key_mode}` : 'Vercel env に設定してください'}
                ok={data.secret_key_present}
              />
              <StatusRow
                label="STRIPE_WEBHOOK_SECRET"
                hint={data.webhook_secret_present ? 'webhook 署名検証 OK' : 'webhook 受信ができません'}
                ok={data.webhook_secret_present}
              />
            </div>

            {/* Price ID リスト */}
            <div style={card}>
              <h3 style={sectionTitle}>Price ID (14 個)</h3>
              <p style={{ fontSize: '0.78rem', color: '#8A8593', marginBottom: '0.85rem' }}>
                Iris 4 プラン × 月額/年額 + Prism 3 プラン × 月額/年額 = 14 個
              </p>

              {(['iris', 'prism'] as const).map(brand => (
                <div key={brand} style={{ marginBottom: '1rem' }}>
                  <h4 style={{
                    fontSize: '0.85rem', fontWeight: 700,
                    color: brand === 'iris' ? '#E1306C' : '#0033A0',
                    marginBottom: '0.5rem',
                  }}>
                    {brand === 'iris' ? 'CORE Iris' : 'CORE Prism'}
                  </h4>
                  {data.prices.filter(p => p.brand === brand).map(price => (
                    <PriceRow key={price.env_key} price={price} />
                  ))}
                </div>
              ))}
            </div>

            {/* オーナー向けセットアップガイド */}
            <div style={card}>
              <h3 style={sectionTitle}>セットアップ手順</h3>
              <ol style={{ paddingLeft: '1.4rem', lineHeight: 2, fontSize: '0.88rem', color: '#1F1A2E' }}>
                <li>
                  <a href="https://dashboard.stripe.com/products" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    Stripe Dashboard → 商品
                    <ExternalLink size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                  </a>
                  で 7 商品 (Iris Lite/Standard/Pro/Studio + Prism Starter/Standard/Exclusive) を作成
                </li>
                <li>各商品に <strong>月額</strong> + <strong>年額</strong> の Price を作成 (年額 = 月額 × 10)</li>
                <li>14 個の Price ID をコピーして Vercel の env vars に貼る</li>
                <li>Webhook エンドポイント <code style={codeStyle}>https://core-prism-app.vercel.app/api/stripe/webhook</code> を Stripe Dashboard に登録</li>
                <li>署名 secret (whsec_) を <code style={codeStyle}>STRIPE_WEBHOOK_SECRET</code> に設定</li>
                <li>このページに戻ってチェック → 全て緑になれば完了</li>
              </ol>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatusRow({ label, hint, ok }: { label: string; hint: string; ok: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.65rem 0',
      borderBottom: '1px solid rgba(0,0,0,0.05)',
    }}>
      {ok
        ? <CheckCircle2 size={20} color="#10B981" style={{ flexShrink: 0 }} />
        : <XCircle size={20} color="#9B1B30" style={{ flexShrink: 0 }} />
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <code style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1F1A2E' }}>{label}</code>
        <div style={{ fontSize: '0.74rem', color: '#8A8593' }}>{hint}</div>
      </div>
    </div>
  );
}

function PriceRow({ price }: { price: PriceCheckResult }) {
  const status = !price.present
    ? 'missing'
    : price.valid === false
      ? 'invalid'
      : price.valid === true
        ? 'valid'
        : 'unchecked';

  const bg = status === 'valid' ? 'rgba(16,185,129,0.06)'
    : status === 'invalid' ? 'rgba(200,16,46,0.06)'
    : status === 'missing' ? 'rgba(245,158,11,0.06)'
    : 'transparent';

  const icon = status === 'valid' ? <CheckCircle2 size={18} color="#10B981" />
    : status === 'invalid' ? <XCircle size={18} color="#9B1B30" />
    : <AlertTriangle size={18} color="#F59E0B" />;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.65rem',
      padding: '0.5rem 0.75rem',
      borderRadius: 8,
      background: bg,
      marginBottom: '0.3rem',
    }}>
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1F1A2E' }}>
          {price.label}
        </div>
        <code style={{ fontSize: '0.7rem', color: '#5A5562' }}>{price.env_key}</code>
        {price.value_masked && (
          <span style={{ fontSize: '0.7rem', color: '#8A8593', marginLeft: '0.5rem' }}>
            = {price.value_masked}
          </span>
        )}
        {price.unit_amount !== undefined && (
          <span style={{ fontSize: '0.72rem', color: '#10B981', marginLeft: '0.5rem' }}>
            · {(price.currency || 'jpy').toUpperCase()} {price.unit_amount.toLocaleString()} / {price.interval}
          </span>
        )}
        {price.error && (
          <div style={{ fontSize: '0.7rem', color: '#9B1B30', marginTop: '0.2rem' }}>
            {price.error}
          </div>
        )}
      </div>
    </div>
  );
}

const pageWrap: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'linear-gradient(180deg, #FAFAF8, #F4F1FA)',
  padding: '2rem 1rem',
  fontFamily: 'Inter, -apple-system, sans-serif',
  color: '#1F1A2E',
};

const card: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 16,
  padding: '1.25rem 1.5rem',
  marginBottom: '1rem',
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 4px 20px rgba(15,10,25,0.04)',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 800,
  margin: '0 0 0.5rem',
  color: '#1F1A2E',
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  background: 'linear-gradient(135deg, #0033A0, #1A4FC4)',
  color: '#fff', border: 'none', borderRadius: 999,
  padding: '0.6rem 1.2rem',
  fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '1rem',
  background: 'rgba(0,0,0,0.04)', color: '#5A5562',
  border: '1px solid rgba(0,0,0,0.08)', borderRadius: 999,
  padding: '0.6rem 1.2rem',
  fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none',
};

const linkStyle: React.CSSProperties = {
  color: '#0033A0', textDecoration: 'underline', fontWeight: 600,
};

const codeStyle: React.CSSProperties = {
  background: '#F4F1FA',
  padding: '0.1rem 0.4rem',
  borderRadius: 4,
  fontSize: '0.78rem',
  fontFamily: 'monospace',
};
