// ============================================================
// CashflowForecast — /master/cashflow-forecast
//
// オーナー指示 (2026-06-04 第 40 波 EEEEEE):
//   MRR + 固定費 で 60 日 先まで 残高推移 を 折れ線で表示。
//   残高ゼロ になる日を明示。
//   ?balance=N で 現在残高を 一時上書き 可。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { isMasterAuth } from '../lib/billing';
import { LoaderBlock } from '../components/MicroLoader';
import { ArrowLeft, RefreshCw, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';

interface SeriesPoint { date: string; balance: number; dayIn: number; dayOut: number; }
interface Resp {
  ok: boolean;
  asOf: string;
  mrrJpy: number;
  fixedMonthlyJpy: number;
  openingBalanceJpy: number;
  dailyIn: number;
  dailyOut: number;
  dailyNet: number;
  series: SeriesPoint[];
  zeroDate?: string;
  daysUntilZero?: number;
  note?: string;
}

const W = 960, H = 320, PAD_L = 56, PAD_R = 16, PAD_T = 18, PAD_B = 36;

function yen(n: number): string {
  const sign = n < 0 ? '-¥' : '¥';
  return sign + Math.abs(Math.round(n)).toLocaleString('ja-JP');
}

export default function CashflowForecast() {
  const [authed] = useState(isMasterAuth);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<{ status?: number; message: string } | null>(null);
  const [balanceOverride, setBalanceOverride] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('core_cash_balance') || '';
  });

  const load = () => {
    if (!authed) return;
    setLoading(true); setErr(null);
    const key = localStorage.getItem('core_master_key') || 'GAUCHE2026';
    const q = balanceOverride ? `?balance=${encodeURIComponent(balanceOverride)}` : '';
    fetch(`/api/master/cashflow-forecast${q}`, { headers: { 'x-master-key': key } })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          const msg = (() => { try { return JSON.parse(t).error || t; } catch { return t || `HTTP ${r.status}`; } })();
          throw Object.assign(new Error(msg), { status: r.status });
        }
        return r.json() as Promise<Resp>;
      })
      .then(setData)
      .catch((e: any) => setErr({ status: e?.status, message: e?.message || String(e) }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [authed]);

  const applyBalance = () => {
    try { localStorage.setItem('core_cash_balance', balanceOverride); } catch { /* */ }
    load();
  };

  // チャート 集計
  const chart = useMemo(() => {
    if (!data) return null;
    const vals = data.series.map((p) => p.balance);
    const min = Math.min(0, ...vals);
    const max = Math.max(0, ...vals);
    const range = max - min || 1;
    const xStep = (W - PAD_L - PAD_R) / Math.max(1, data.series.length - 1);
    const x = (i: number) => PAD_L + i * xStep;
    const y = (v: number) => H - PAD_B - ((v - min) / range) * (H - PAD_T - PAD_B);
    const points = data.series.map((p, i) => `${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
    const zeroX = data.daysUntilZero !== undefined ? x(data.daysUntilZero) : null;
    const zeroY = y(0);
    return { vals, min, max, range, x, y, points, zeroX, zeroY };
  }, [data]);

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A12', color: '#fff', padding: '4rem 1.5rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>master key が必要です</h2>
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
            background: 'linear-gradient(135deg, #22D3EE, #6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 12px 24px rgba(34,211,238,0.35)',
            flexShrink: 0, fontSize: 22,
          }}>🌊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.28em', color: '#22D3EE', fontWeight: 800 }}>MASTER · CASHFLOW</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.9rem)', margin: '4px 0 0', fontWeight: 900 }}>資金繰り 60 日 予測</h1>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {data?.asOf ? `取得時刻: ${new Date(data.asOf).toLocaleString('ja-JP')}` : '—'}
            </div>
          </div>
          <button onClick={load} disabled={loading} style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4,
          }}><RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> 再取得</button>
        </div>

        {err && (
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            color: '#FCA5A5', marginBottom: 18,
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, marginBottom: 4 }}>
              <AlertCircle size={14} /> 取得失敗 (HTTP {err.status || '?'})
            </div>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.7 }}>{err.message}</div>
          </div>
        )}

        {/* 現在残高 入力 */}
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 18,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: '0.12em' }}>
            現在残高 (JPY)
          </span>
          <input
            type="number"
            value={balanceOverride}
            onChange={(e) => setBalanceOverride(e.target.value)}
            placeholder={data ? String(data.openingBalanceJpy) : '0'}
            style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: '0.86rem', outline: 'none', minWidth: 140,
            }}
          />
          <button onClick={applyBalance} style={{
            padding: '8px 14px', borderRadius: 8,
            background: '#22D3EE', color: '#0A0A12', border: 'none',
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800,
          }}>反映</button>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>
            env CASH_FIXED_MONTHLY / CASH_CURRENT_BALANCE で 既定値設定
          </span>
        </div>

        {!data && !err && <LoaderBlock message="Stripe MRR と 固定費 を取得中…" />}

        {data && chart && (
          <>
            {/* KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
              <Kpi label="現在 残高" value={yen(data.openingBalanceJpy)} color="#34D399" />
              <Kpi label="MRR (月収入)" value={yen(data.mrrJpy)} color="#22D3EE" />
              <Kpi label="月次 固定費" value={yen(data.fixedMonthlyJpy)} color="#F87171" />
              <Kpi label="1 日 純増減" value={yen(data.dailyNet)} color={data.dailyNet >= 0 ? '#34D399' : '#F87171'} icon={data.dailyNet >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} />
            </div>

            {/* 警告 / 安心 バナー */}
            {data.zeroDate ? (
              <div style={{
                padding: '14px 18px', borderRadius: 14,
                background: 'rgba(248,113,113,0.12)',
                border: '1px solid rgba(248,113,113,0.4)',
                marginBottom: 22,
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#F87171', fontWeight: 800 }}>🚨 残高ゼロ 到達</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, marginTop: 4 }}>
                  あと <strong style={{ color: '#F87171' }}>{data.daysUntilZero} 日</strong> ({data.zeroDate}) で 残高 0 に到達
                </div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', marginTop: 4, lineHeight: 1.6 }}>
                  この日までに 売上 ¥{Math.abs(data.dailyNet * data.daysUntilZero!).toLocaleString('ja-JP')} 以上 上乗せ するか、固定費を ¥{yen(Math.abs(data.dailyNet) * 30 / Math.max(1, data.daysUntilZero!) * 30)} 削減 が必要。
                </div>
              </div>
            ) : (
              <div style={{
                padding: '14px 18px', borderRadius: 14,
                background: 'rgba(52,211,153,0.10)',
                border: '1px solid rgba(52,211,153,0.4)',
                marginBottom: 22,
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#34D399', fontWeight: 800 }}>🟢 60 日 間 残高 プラス</div>
                <div style={{ fontSize: '0.95rem', marginTop: 4 }}>
                  予測の範囲 (60 日) では 残高ゼロ に到達しません。 60 日後 残高: <strong style={{ color: '#34D399' }}>{yen(data.series[data.series.length - 1]?.balance || 0)}</strong>
                </div>
              </div>
            )}

            {/* チャート */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 18,
              marginBottom: 18,
            }}>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginBottom: 8 }}>
                残高 推移 (60 日)
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* zero baseline */}
                <line x1={PAD_L} y1={chart.zeroY} x2={W - PAD_R} y2={chart.zeroY} stroke="rgba(248,113,113,0.5)" strokeDasharray="4 4" />
                <text x={PAD_L - 6} y={chart.zeroY + 3} fontSize="10" fill="rgba(248,113,113,0.8)" textAnchor="end">¥0</text>
                {/* min/max guide */}
                {[chart.min, 0, chart.max].filter((v, i, a) => a.indexOf(v) === i).map((v, i) => (
                  <g key={i}>
                    <text x={PAD_L - 6} y={chart.y(v) + 3} fontSize="9" fill="rgba(255,255,255,0.45)" textAnchor="end">{yen(v)}</text>
                  </g>
                ))}
                {/* area */}
                <path
                  d={`M ${PAD_L},${chart.zeroY} L ${chart.points.split(' ').join(' L ')} L ${W - PAD_R},${chart.zeroY} Z`}
                  fill="rgba(34,211,238,0.18)"
                />
                {/* line */}
                <polyline points={chart.points} fill="none" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {/* zero marker */}
                {chart.zeroX !== null && (
                  <g>
                    <line x1={chart.zeroX} y1={PAD_T} x2={chart.zeroX} y2={H - PAD_B} stroke="#F87171" strokeDasharray="3 3" />
                    <circle cx={chart.zeroX} cy={chart.zeroY} r="5" fill="#F87171" stroke="#0A0A12" strokeWidth="2" />
                    <text x={chart.zeroX + 6} y={PAD_T + 14} fontSize="11" fill="#F87171" fontWeight="800">残高ゼロ</text>
                  </g>
                )}
                {/* x labels (10 日 刻み) */}
                {[0, 10, 20, 30, 40, 50, 60].map((d) => (
                  <text key={d} x={chart.x(d)} y={H - PAD_B + 14} fontSize="10" fill="rgba(255,255,255,0.55)" textAnchor="middle">D+{d}</text>
                ))}
              </svg>
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
              {data.note} 売上発生時刻 を 月割で均し、 単純 線形 予測 (キャンペーン / 解約は 反映していません)。
            </div>
          </>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function Kpi({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33` }}>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '1.3rem', fontWeight: 900, color, lineHeight: 1.2, marginTop: 4 }}>{value}</div>
    </div>
  );
}
