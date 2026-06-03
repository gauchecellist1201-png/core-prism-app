// ============================================================
// StripeConnectCard — Stripe Connect 接続 / 状況可視化 カード
//
// オーナー指示 (2026-06-04 第 15 波 GGG):
//   立替 → 送金 型 (Iris クリエイターが Stripe Connect で接続し、
//   案件報酬を 自身の口座に直接振込) の UI 土台。
//
// 表示パターン:
//   1) 未接続: 「Stripe Connect で接続する」ボタン → /api/stripe/connect-start
//   2) 接続済 + 振込可能: 緑 ✓ + アカウント ID + 口座への次回 payout 設定
//   3) 接続済 + 不足アリ: 要対応 KYC 項目 + 「Dashboard で続ける」リンク
//
// 既存の StripeConnectHero (未接続バナー) と併用可。
// こちらは「接続後の状態」も丁寧に見せるカード版。
// ============================================================

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, ArrowRight, RefreshCw, ExternalLink } from 'lucide-react';

const STRIPE = '#635BFF';
const STRIPE_USER_KEY_LS = 'core_stripe_user_key_v1';

interface StatusOk {
  connected: true;
  accountId: string;
  mode: 'live' | 'test';
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  defaultCurrency: string;
  country: string;
  businessProfile: { name?: string; url?: string };
  requirements: {
    currently_due: string[];
    eventually_due: string[];
    past_due: string[];
    pending_verification: string[];
    disabled_reason: string | null;
  };
  payoutSchedule: { interval?: string; delay_days?: number } | null;
  readyToReceive: boolean;
}
interface StatusErr { connected: false; error: string }
type Status = StatusOk | StatusErr;

interface Props {
  /** 接続開始 ボタン押下時 — /api/stripe/connect-start を叩いて Stripe へ飛ばす */
  onStartConnect: () => void;
}

export default function StripeConnectCard({ onStartConnect }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);

  const userKey = (() => {
    try { return localStorage.getItem(STRIPE_USER_KEY_LS) || ''; } catch { return ''; }
  })();

  const load = async () => {
    if (!userKey) { setStatus(null); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/connect-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripe_user_key: userKey }),
      });
      const j = await res.json();
      setStatus(j as Status);
    } catch (e) {
      setStatus({ connected: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ─── 未接続 ─────────────────────────────────
  if (!userKey || !status || !status.connected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '1.1rem 1.15rem',
          borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(99,91,255,0.18), rgba(46,111,255,0.10))',
          border: '1px solid rgba(99,91,255,0.36)',
          color: 'var(--fg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: STRIPE, color: '#fff',
            fontWeight: 900, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>S</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Stripe Connect で接続</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
              案件報酬を 自分の口座に直接 受け取れます
            </div>
          </div>
        </div>
        {status && !status.connected && status.error && (
          <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginBottom: 8, padding: '6px 10px', background: 'rgba(220,38,38,0.1)', borderRadius: 8 }}>
            {status.error}
          </div>
        )}
        <button
          onClick={onStartConnect}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 13,
            color: '#fff',
            background: `linear-gradient(135deg, ${STRIPE}, #8E5CFF)`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          Stripe Connect で接続する <ArrowRight size={14} />
        </button>
      </motion.div>
    );
  }

  // ─── 接続済 ─────────────────────────────────
  const ok = status.readyToReceive;
  const req = status.requirements;
  const issuesCount =
    (req.currently_due?.length || 0) +
    (req.past_due?.length || 0) +
    (req.pending_verification?.length || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '1.1rem 1.15rem',
        borderRadius: 18,
        background: ok
          ? 'linear-gradient(135deg, rgba(52,211,153,0.16), rgba(99,91,255,0.10))'
          : 'linear-gradient(135deg, rgba(251,191,36,0.16), rgba(99,91,255,0.08))',
        border: `1px solid ${ok ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.4)'}`,
        color: 'var(--fg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: ok ? '#10B981' : '#F59E0B',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {ok ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
            {ok ? 'Stripe Connect 接続済 — 振込 OK' : 'Stripe Connect: 追加情報が必要です'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', marginTop: 2, fontFamily: 'Menlo, monospace' }}>
            {status.accountId} · {status.mode} · {status.country || '—'} · {status.defaultCurrency || 'JPY'}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="再読込"
          style={{
            width: 30, height: 30, borderRadius: 15,
            background: 'rgba(255,255,255,0.08)', border: 'none',
            color: 'var(--fg-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'core-spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        fontSize: '0.72rem', marginBottom: 10,
      }}>
        <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
          <div style={{ color: 'var(--fg-muted)', fontWeight: 600 }}>charges</div>
          <div style={{ fontWeight: 800, color: status.chargesEnabled ? '#34D399' : '#F87171' }}>
            {status.chargesEnabled ? 'ON' : 'OFF'}
          </div>
        </div>
        <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
          <div style={{ color: 'var(--fg-muted)', fontWeight: 600 }}>payouts</div>
          <div style={{ fontWeight: 800, color: status.payoutsEnabled ? '#34D399' : '#F87171' }}>
            {status.payoutsEnabled ? 'ON' : 'OFF'}
          </div>
        </div>
      </div>

      {status.payoutSchedule && (
        <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginBottom: 8 }}>
          📅 次回振込: {status.payoutSchedule.interval || '—'} (delay {status.payoutSchedule.delay_days ?? '—'} 日)
        </div>
      )}

      {issuesCount > 0 && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 8,
          fontSize: '0.72rem',
          marginBottom: 10,
        }}>
          <strong>要対応 {issuesCount} 件:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
            {[...req.past_due, ...req.currently_due, ...req.pending_verification].slice(0, 4).map((r, i) => (
              <li key={i} style={{ color: 'var(--fg-muted)' }}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <a
        href={`https://dashboard.stripe.com/${status.mode === 'test' ? 'test/' : ''}connect/accounts/${status.accountId}`}
        target="_blank" rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: '0.78rem', color: STRIPE, textDecoration: 'none', fontWeight: 700,
        }}
      >
        Stripe Dashboard で開く <ExternalLink size={12} />
      </a>

      <style>{`@keyframes core-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}
