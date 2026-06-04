// ============================================================
// RevenueDashboard — /master/revenue-dashboard
//
// オーナー指示 (2026-06-04 第 33 波 JJJJJ):
//   過去 12 ヶ月 の Stripe 月次売上 を 棒グラフ + MRR 折れ線 + 解約率 で 1 画面に。
//   master key + STRIPE_SECRET_KEY 必須。
//   401 / 503 時 は 案内付きで 設定方法を表示。
// ============================================================

import { useEffect, useState } from 'react';
import { isMasterAuth } from '../lib/billing';
import { LoaderBlock } from '../components/MicroLoader';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

interface MonthRow { month: string; revenueJpy: number; charges: number; }
interface MrrRow { month: string; mrr: number; }
interface RevenueResp {
  asOf: string;
  months: MonthRow[];
  mrrJpy: number;
  mrrSeriesJpy: MrrRow[];
  activeSubscriptions: number;
  churn: { thisMonth: { canceled: number; baseAtStart: number; ratePct: number } };
  note?: string;
}

const W = 980, H = 320, PAD_L = 56, PAD_R = 16, PAD_T = 18, PAD_B = 36;

export default function RevenueDashboard() {
  const [authed] = useState(isMasterAuth);
  const [data, setData] = useState<RevenueResp | null>(null);
  const [err, setErr] = useState<{ status?: number; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!authed) return;
    setLoading(true); setErr(null);
    const key = localStorage.getItem('core_master_key') || 'GAUCHE2026';
    fetch('/api/master/revenue-monthly', { headers: { 'x-master-key': key } })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          const msg = (() => { try { return JSON.parse(t).error || t; } catch { return t || `HTTP ${r.status}`; } })();
          throw Object.assign(new Error(msg), { status: r.status });
        }
        return r.json() as Promise<RevenueResp>;
      })
      .then(setData)
      .catch((e: any) => setErr({ status: e?.status, message: e?.message || String(e) }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [authed]);

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A12', color: '#fff', padding: '4rem 1.5rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>master key が必要です</h2>
          <p style={{ fontSize: '0.88rem', lineHeight: 1.7 }}>
            ブラウザコンソールで{' '}
            <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
              localStorage.setItem('core_master_key', 'GAUCHE2026')
            </code>{' '}
            を実行してから 再読込してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A12', color: '#fff', padding: '2rem 1.25rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <a href="/master" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: 24 }}>
          <ArrowLeft size={14} /> /master へ戻る
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #34D399, #10B981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#04130c', boxShadow: '0 12px 24px rgba(52,211,153,0.35)',
            flexShrink: 0, fontSize: 22, fontWeight: 900,
          }}>¥</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.28em', color: '#34D399', fontWeight: 800 }}>MASTER · REVENUE</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.9rem)', margin: '4px 0 0', fontWeight: 900 }}>過去 12 ヶ月 売上 + MRR + 解約率</h1>
            {data?.asOf && (
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                取得時刻: {new Date(data.asOf).toLocaleString('ja-JP')}
              </div>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> 再取得
          </button>
        </div>

        {err && (
          <div style={{
            padding: '16px 18px', borderRadius: 12,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            color: '#FCA5A5', marginBottom: 18,
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, marginBottom: 6 }}>
              <AlertCircle size={14} /> 取得失敗 (HTTP {err.status || '?'})
            </div>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.7 }}>{err.message}</div>
            {err.status === 401 || err.status === 403 ? (
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'rgba(252,165,165,0.85)' }}>
                → ブラウザコンソールで{' '}
                <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>
                  localStorage.setItem('core_master_key', 'GAUCHE2026')
                </code>{' '}
                を実行 → 再読込
              </div>
            ) : err.status === 503 ? (
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'rgba(252,165,165,0.85)' }}>
                → Vercel env に <code>STRIPE_SECRET_KEY</code> (sk_live_xxx) が設定されているか確認してください。
              </div>
            ) : null}
          </div>
        )}

        {!data && !err && <LoaderBlock message="Stripe の月次売上 + サブスク + 解約率 を計算中…" />}

        {data && (
          <>
            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              <Kpi label="今月 売上" value={yen(data.months[data.months.length - 1]?.revenueJpy || 0)} sub={`${data.months[data.months.length - 1]?.charges || 0} 件`} color="#34D399" />
              <Kpi label="MRR (現時点)" value={yen(data.mrrJpy)} sub={`${data.activeSubscriptions} サブスク`} color="#6366F1" />
              <Kpi label="今月 解約" value={`${data.churn.thisMonth.canceled} 件`} sub={`${data.churn.thisMonth.ratePct}% (月初 base ${data.churn.thisMonth.baseAtStart})`} color="#F87171" />
              <Kpi label="12 ヶ月 累計" value={yen(data.months.reduce((a, m) => a + m.revenueJpy, 0))} sub="" color="#FBBF24" />
            </div>

            {/* Bars + Line */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 18,
              marginBottom: 18,
            }}>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginBottom: 8 }}>月次 売上 (棒) + MRR (線)</div>
              <Chart months={data.months} mrr={data.mrrSeriesJpy} />
            </div>

            {/* Table */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, overflow: 'auto', marginBottom: 18,
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>月</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>売上</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>件数</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>平均</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m, i) => {
                    const avg = m.charges > 0 ? Math.round(m.revenueJpy / m.charges) : 0;
                    return (
                      <tr key={m.month} style={{ borderBottom: i === data.months.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '8px 14px', color: 'rgba(255,255,255,0.85)' }}>{m.month}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', color: '#34D399', fontWeight: 700 }}>{yen(m.revenueJpy)}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', color: 'rgba(255,255,255,0.85)' }}>{m.charges}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>{avg > 0 ? yen(avg) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data.note && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                ⓘ {data.note}
              </div>
            )}
          </>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function yen(n: number): string {
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33` }}>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 900, color, lineHeight: 1.2, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Chart({ months, mrr }: { months: MonthRow[]; mrr: MrrRow[] }) {
  const maxBar = Math.max(1, ...months.map((m) => m.revenueJpy));
  const maxLine = Math.max(1, ...mrr.map((m) => m.mrr), maxBar);
  const max = Math.max(maxBar, maxLine);
  const xStep = (W - PAD_L - PAD_R) / months.length;
  const y = (v: number) => H - PAD_B - ((H - PAD_T - PAD_B) * v) / max;

  // Y 軸 ガイド (5 段)
  const ticks: number[] = [];
  for (let i = 0; i <= 4; i++) ticks.push((max / 4) * i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* axes */}
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="rgba(255,255,255,0.15)" />
      {/* Y guides */}
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="rgba(255,255,255,0.05)" />
          <text x={PAD_L - 6} y={y(v) + 3} fontSize="9" fill="rgba(255,255,255,0.45)" textAnchor="end">
            ¥{Math.round(v).toLocaleString('ja-JP')}
          </text>
        </g>
      ))}
      {/* bars */}
      {months.map((m, i) => {
        const bx = PAD_L + i * xStep + 4;
        const bw = Math.max(6, xStep - 8);
        const by = y(m.revenueJpy);
        return (
          <g key={m.month}>
            <rect x={bx} y={by} width={bw} height={H - PAD_B - by} fill="url(#barG)" rx="3" />
            <text x={bx + bw / 2} y={H - PAD_B + 14} fontSize="10" fill="rgba(255,255,255,0.55)" textAnchor="middle">
              {m.month.slice(5)}
            </text>
          </g>
        );
      })}
      {/* line (MRR) */}
      {mrr.length > 1 && (
        <polyline
          points={mrr.map((m, i) => `${PAD_L + i * xStep + xStep / 2},${y(m.mrr)}`).join(' ')}
          fill="none"
          stroke="#A78BFA"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* line points */}
      {mrr.map((m, i) => (
        <circle key={m.month} cx={PAD_L + i * xStep + xStep / 2} cy={y(m.mrr)} r="3.5" fill="#A78BFA" stroke="#0A0A12" strokeWidth="1.5" />
      ))}
      <defs>
        <linearGradient id="barG" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      {/* legend */}
      <g transform={`translate(${PAD_L + 4} ${PAD_T - 2})`}>
        <rect x="0" y="0" width="10" height="10" fill="url(#barG)" rx="2" />
        <text x="14" y="9" fontSize="10" fill="rgba(255,255,255,0.7)">月次売上</text>
        <line x1="62" y1="5" x2="78" y2="5" stroke="#A78BFA" strokeWidth="2.5" />
        <circle cx="70" cy="5" r="3" fill="#A78BFA" />
        <text x="82" y="9" fontSize="10" fill="rgba(255,255,255,0.7)">MRR</text>
      </g>
    </svg>
  );
}
