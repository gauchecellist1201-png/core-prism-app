// ============================================================
// CoreRevenueCard — CORE (Prism/Iris) の Stripe 実売上を右側に表示
//
// オーナー指示 (2026-05-17): Stripe を連携して売上を右側に反映。
// Stripe Secret Key は Vercel env (STRIPE_SECRET_KEY) に設定済みなので、
// /api/revenue/snapshot を master-key 付きで叩けば実売上が返る。
// マスターモードのとき右サイドバーに表示する。
// ============================================================
import { useEffect, useState } from 'react';
import { TrendingUp, Loader2, RefreshCw } from 'lucide-react';

interface Snapshot {
  asOf?: string;
  stripeConfigured?: boolean;
  totals?: {
    mrrJpy: number; paidCount: number; arrJpy: number;
    prismMrrJpy: number; irisMrrJpy: number; otherMrrJpy: number;
  };
  monthly?: { month: string; gmvJpy: number; prismJpy: number; irisJpy: number }[];
  error?: string;
}

const yen = (n: number) => '¥' + Math.round(n).toLocaleString();

export default function CoreRevenueCard() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetch('/api/revenue/snapshot', { headers: { 'x-master-key': 'GAUCHE2026' } })
      .then(r => r.json())
      .then((d: Snapshot) => {
        if (d.error) setErr(d.error);
        else setData(d);
      })
      .catch(e => setErr(e?.message || '取得に失敗しました'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const totals = data?.totals;
  const thisMonth = data?.monthly && data.monthly.length
    ? data.monthly[data.monthly.length - 1]
    : null;
  const trend = data?.monthly?.slice(-6).map(m => m.gmvJpy) || [];

  return (
    <div style={{
      borderRadius: 14,
      background: 'linear-gradient(135deg, rgba(46,111,255,0.12), rgba(142,92,255,0.10) 60%, rgba(232,75,151,0.08))',
      border: '1px solid rgba(142,92,255,0.3)',
      padding: '0.85rem 0.9rem',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <TrendingUp size={12} color="#8E5CFF" />
          <span style={{ fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 800, color: '#8E5CFF' }}>
            CORE の売上 (STRIPE)
          </span>
        </div>
        <button
          type="button" onClick={load} aria-label="更新"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)', display: 'flex', padding: 2,
          }}
        >
          {loading ? <Loader2 size={12} className="rev-spin" /> : <RefreshCw size={12} />}
        </button>
      </div>

      {loading && !data && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', padding: '6px 0' }}>
          売上を読み込んでいます…
        </div>
      )}

      {err && (
        <div style={{ fontSize: 10.5, color: '#FBBF24', lineHeight: 1.5, padding: '4px 0' }}>
          {err.includes('503') || err.includes('not')
            ? 'Stripe の設定を確認中です。'
            : 'いまは取得できませんでした。更新ボタンでもう一度お試しください。'}
        </div>
      )}

      {totals && (
        <>
          {/* 今月の入金 (一番大きく) */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)' }}>今月の入金</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
              {yen(thisMonth?.gmvJpy || 0)}
            </div>
          </div>

          {/* MRR + 有料数 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <Mini label="毎月の売上 (MRR)" value={yen(totals.mrrJpy)} />
            <Mini label="有料のお客さん" value={`${totals.paidCount} 人`} />
          </div>

          {/* Prism / Iris 別 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: trend.length > 1 ? 8 : 0 }}>
            <ProductBar label="Prism" value={totals.prismMrrJpy} max={totals.mrrJpy} color="#2E6FFF" />
            <ProductBar label="Iris" value={totals.irisMrrJpy} max={totals.mrrJpy} color="#E1306C" />
          </div>

          {/* 6 ヶ月トレンド */}
          {trend.length > 1 && <RevSparkline data={trend} />}
        </>
      )}
      <style>{`.rev-spin { animation: revspin 1s linear infinite; } @keyframes revspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '5px 8px' }}>
      <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{value}</div>
    </div>
  );
}

function ProductBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
        <span style={{ color, fontWeight: 800 }}>{label}</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{yen(value)}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.6s' }} />
      </div>
    </div>
  );
}

function RevSparkline({ data }: { data: number[] }) {
  const w = 100, h = 22;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div>
      <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>6 ヶ月の入金推移</div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="#8E5CFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
