// ============================================================
// WebVitals — /master/web-vitals (オーナー専用 Core Web Vitals)
//
// オーナー指示 (2026-06-04 第 39 波 AAAAAA):
//   /api/track/web-vitals (GET) を 叩いて 5 メトリクスの p75 と 直近 20 件 を表示。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { isMasterAuth } from '../lib/billing';
import { LoaderBlock } from '../components/MicroLoader';
import { ArrowLeft, RefreshCw, Gauge, AlertCircle } from 'lucide-react';

interface Entry { name: string; value: number; id: string; path: string; rating?: string; ts: number; ua?: string; }
interface MetricStats { count: number; p75: number; median: number; recent: Entry[]; }
interface Resp { ok: boolean; configured: boolean; asOf: string; metrics: Record<string, MetricStats>; }

const METRICS: { key: string; label: string; unit: string; goodMax: number; nimMax: number; emoji: string }[] = [
  { key: 'LCP',  label: 'LCP (Largest Contentful Paint)', unit: 'ms', goodMax: 2500, nimMax: 4000, emoji: '🖼️' },
  { key: 'CLS',  label: 'CLS (Cumulative Layout Shift)',   unit: '',   goodMax: 0.1,  nimMax: 0.25, emoji: '📐' },
  { key: 'INP',  label: 'INP (Interaction to Next Paint)', unit: 'ms', goodMax: 200,  nimMax: 500,  emoji: '👆' },
  { key: 'FCP',  label: 'FCP (First Contentful Paint)',    unit: 'ms', goodMax: 1800, nimMax: 3000, emoji: '⚡' },
  { key: 'TTFB', label: 'TTFB (Time to First Byte)',        unit: 'ms', goodMax: 800,  nimMax: 1800, emoji: '🛰' },
];

function rateColor(value: number, good: number, nim: number): string {
  if (value <= good) return '#34D399';
  if (value <= nim) return '#FBBF24';
  return '#F87171';
}
function rateLabel(value: number, good: number, nim: number): string {
  if (value <= good) return '🟢 good';
  if (value <= nim) return '🟡 needs improvement';
  return '🔴 poor';
}
function fmt(value: number, unit: string): string {
  if (unit === '') return value.toFixed(3);
  return Math.round(value) + (unit ? ` ${unit}` : '');
}

export default function WebVitals() {
  const [authed] = useState(isMasterAuth);
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!authed) return;
    setLoading(true); setErr(null);
    const key = localStorage.getItem('core_master_key') || 'GAUCHE2026';
    fetch('/api/track/web-vitals', { headers: { 'x-master-key': key } })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          throw new Error(t || `HTTP ${r.status}`);
        }
        return r.json() as Promise<Resp>;
      })
      .then(setData)
      .catch((e) => setErr(String(e?.message || e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [authed]);

  const overall = useMemo(() => {
    if (!data) return null;
    const lcp = data.metrics.LCP?.p75 ?? 0;
    const cls = data.metrics.CLS?.p75 ?? 0;
    const inp = data.metrics.INP?.p75 ?? 0;
    const passed = (lcp > 0 && lcp <= 2500) && (cls <= 0.1) && (inp > 0 && inp <= 200);
    return { passed, lcp, cls, inp };
  }, [data]);

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A12', color: '#fff', padding: '4rem 1.5rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>master key が必要です</h2>
          <p style={{ fontSize: '0.88rem', lineHeight: 1.7 }}>
            コンソールで <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>localStorage.setItem('core_master_key', 'GAUCHE2026')</code> → 再読込
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
            background: 'linear-gradient(135deg, #FBBF24, #F97316)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1a0a1a', boxShadow: '0 12px 24px rgba(251,191,36,0.4)',
            flexShrink: 0,
          }}><Gauge size={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.28em', color: '#FBBF24', fontWeight: 800 }}>MASTER · WEB VITALS</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.9rem)', margin: '4px 0 0', fontWeight: 900 }}>Core Web Vitals (rolling 100)</h1>
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
            padding: 12, borderRadius: 10,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            color: '#FCA5A5', fontSize: '0.85rem', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <AlertCircle size={14} /> 取得失敗: {err}
          </div>
        )}

        {!data && !err && <LoaderBlock message="Vitals を集計中…" />}

        {data && overall && (
          <div style={{
            padding: '16px 18px', borderRadius: 14,
            background: overall.passed ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)',
            border: `1px solid ${overall.passed ? '#34D399' : '#FBBF24'}44`,
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: overall.passed ? '#34D399' : '#FBBF24', fontWeight: 800 }}>
              {overall.passed ? '🟢 CORE WEB VITALS PASS' : '🟡 CWV 改善余地あり'}
            </div>
            <div style={{ fontSize: '0.9rem', marginTop: 4, color: 'rgba(255,255,255,0.85)' }}>
              p75: LCP <strong>{fmt(overall.lcp, 'ms')}</strong> · CLS <strong>{fmt(overall.cls, '')}</strong> · INP <strong>{fmt(overall.inp, 'ms')}</strong>
            </div>
          </div>
        )}

        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {METRICS.map((m) => {
              const s = data.metrics[m.key];
              const p75 = s?.p75 ?? 0;
              const c = rateColor(p75, m.goodMax, m.nimMax);
              return (
                <div key={m.key} style={{
                  padding: '14px 16px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${c}33`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 800, letterSpacing: '0.08em' }}>
                      <span style={{ fontSize: 14 }}>{m.emoji}</span> {m.key}
                    </span>
                    <span style={{ fontSize: 9, color: c, fontWeight: 800 }}>
                      {p75 > 0 ? rateLabel(p75, m.goodMax, m.nimMax) : '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{m.label}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: c, marginTop: 8, lineHeight: 1.2 }}>
                    p75: {p75 > 0 ? fmt(p75, m.unit) : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
                    median {s?.median ? fmt(s.median, m.unit) : '—'} · 件数 {s?.count ?? 0}
                  </div>
                  {/* recent list */}
                  {s && s.recent.length > 0 && (
                    <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 800, letterSpacing: '0.12em', marginBottom: 4 }}>RECENT</div>
                      {s.recent.slice(0, 6).map((e, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.65)', padding: '2px 0' }}>
                          <code style={{ fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.55)' }}>{e.path.slice(0, 28)}</code>
                          <span style={{ color: rateColor(e.value, m.goodMax, m.nimMax), fontWeight: 700 }}>{fmt(e.value, m.unit)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
          初期化: <code>initWebVitals()</code> を App.tsx で 呼び出し。 計測 は LCP/CLS/INP は ページ離脱時 確定 (sendBeacon)。
          基準: Web Vitals 2024-12 公式 (good/needs-improvement/poor)。
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
