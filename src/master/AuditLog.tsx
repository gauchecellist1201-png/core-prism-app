// ============================================================
// AuditLog — /master/audit-log オーナー専用 認証履歴
//
// オーナー指示 (2026-06-04 第 40 波 DDDDDD):
//   master:audit:list を 時系列で表示。1000 件まで、IP 末尾だけ表示、UA 概要。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { isMasterAuth } from '../lib/billing';
import { LoaderBlock } from '../components/MicroLoader';
import { ArrowLeft, RefreshCw, ShieldCheck, ShieldX, AlertCircle, Filter } from 'lucide-react';

interface Entry { ts: number; endpoint: string; action: string; authResult: 'ok' | 'forbidden'; ipMasked: string; uaShort: string; note?: string; }
interface Resp { ok: boolean; asOf: string; count: number; entries: Entry[]; }

const ENDPOINT_LABEL: Record<string, string> = {
  '/api/master/secrets-health':   '🔑 Secrets Health',
  '/api/master/revenue-monthly':  '💴 Revenue Monthly',
  '/api/master/audit-log':         '📜 Audit Log',
  '/api/master/cashflow-forecast': '🌊 Cashflow Forecast',
  '/api/track/web-vitals':         '🎚️ Web Vitals',
};

export default function AuditLog() {
  const [authed] = useState(isMasterAuth);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ok' | 'forbidden'>('all');

  const load = () => {
    if (!authed) return;
    setLoading(true); setErr(null);
    const key = localStorage.getItem('core_master_key') || 'GAUCHE2026';
    fetch('/api/master/audit-log', { headers: { 'x-master-key': key } })
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

  const filtered = useMemo(() => {
    if (!data) return [] as Entry[];
    if (filter === 'all') return data.entries;
    return data.entries.filter((e) => e.authResult === filter);
  }, [data, filter]);

  // 集計
  const stats = useMemo(() => {
    if (!data) return { ok: 0, forbidden: 0, total: 0, last24h: 0, distinctIp: 0 };
    const ok = data.entries.filter((e) => e.authResult === 'ok').length;
    const forbidden = data.entries.filter((e) => e.authResult === 'forbidden').length;
    const last24h = data.entries.filter((e) => Date.now() - e.ts < 86400_000).length;
    const distinctIp = new Set(data.entries.map((e) => e.ipMasked)).size;
    return { ok, forbidden, total: data.entries.length, last24h, distinctIp };
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
            background: 'linear-gradient(135deg, #94A3B8, #475569)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 12px 24px rgba(148,163,184,0.3)',
            flexShrink: 0, fontSize: 22,
          }}>📜</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.28em', color: '#94A3B8', fontWeight: 800 }}>MASTER · AUDIT LOG</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.9rem)', margin: '4px 0 0', fontWeight: 900 }}>認証 履歴 (master:audit:*)</h1>
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

        {!data && !err && <LoaderBlock message="認証履歴を読み込み中…" />}

        {data && (
          <>
            {/* KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
              <Kpi label="合計" value={String(stats.total)} color="#A78BFA" />
              <Kpi label="🟢 認証 OK" value={String(stats.ok)} color="#34D399" />
              <Kpi label="🔴 拒否" value={String(stats.forbidden)} color="#F87171" />
              <Kpi label="直近 24h" value={String(stats.last24h)} color="#FBBF24" />
              <Kpi label="ユニーク IP" value={String(stats.distinctIp)} color="#22D3EE" />
            </div>

            {/* フィルタ */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <Filter size={14} color="rgba(255,255,255,0.55)" />
              {(['all', 'ok', 'forbidden'] as const).map((f) => {
                const isActive = filter === f;
                const c = f === 'all' ? '#A78BFA' : f === 'ok' ? '#34D399' : '#F87171';
                const lbl = f === 'all' ? '全部' : f === 'ok' ? '✅ OK のみ' : '❌ 拒否のみ';
                return (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    padding: '5px 12px', borderRadius: 999,
                    border: `1px solid ${isActive ? c : 'rgba(255,255,255,0.1)'}`,
                    background: isActive ? `${c}22` : 'transparent',
                    color: isActive ? c : 'rgba(255,255,255,0.7)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>{lbl}</button>
                );
              })}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{filtered.length} 件 表示中</span>
            </div>

            {/* テーブル */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, overflow: 'auto',
            }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: '0.86rem' }}>
                  該当する 履歴 がありません。
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th scope="col" style={{ padding: '10px 12px', textAlign: 'left' }}>時刻</th>
                      <th scope="col" style={{ padding: '10px 12px', textAlign: 'left' }}>状態</th>
                      <th scope="col" style={{ padding: '10px 12px', textAlign: 'left' }}>Endpoint</th>
                      <th scope="col" style={{ padding: '10px 12px', textAlign: 'left' }}>Method</th>
                      <th scope="col" style={{ padding: '10px 12px', textAlign: 'left' }}>IP</th>
                      <th scope="col" style={{ padding: '10px 12px', textAlign: 'left' }}>環境</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e, i) => (
                      <tr key={`${e.ts}-${i}`} style={{ borderBottom: i === filtered.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                          {new Date(e.ts).toLocaleString('ja-JP')}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {e.authResult === 'ok'
                            ? <span style={{ color: '#34D399', display: 'inline-flex', alignItems: 'center', gap: 3 }}><ShieldCheck size={12} /> OK</span>
                            : <span style={{ color: '#F87171', display: 'inline-flex', alignItems: 'center', gap: 3 }}><ShieldX size={12} /> 拒否</span>}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.88)', fontFamily: 'Menlo, monospace', fontSize: 11.5 }}>
                          {ENDPOINT_LABEL[e.endpoint] || e.endpoint}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.7)', fontFamily: 'Menlo, monospace' }}>{e.action}</td>
                        <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.7)', fontFamily: 'Menlo, monospace' }}>{e.ipMasked}</td>
                        <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.7)' }}>{e.uaShort}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
              ※ IP は 末尾 だけ表示 (PII 配慮)。最大 1000 件 まで rolling 保存。master_key の値 は一切 記録しません (OK/拒否 のみ)。
            </div>
          </>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 900, color, lineHeight: 1.2, marginTop: 3 }}>{value}</div>
    </div>
  );
}
