// ============================================================
// SocialShares — /master/social-shares (オーナー専用)
//
// オーナー指示 (2026-06-04 第 46 波 XXXXXX):
//   /api/track/social-share?days=14 から データ を取得して可視化。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { isMasterAuth } from '../lib/billing';
import { LoaderBlock } from '../components/MicroLoader';
import { ArrowLeft, RefreshCw, Copy, Share2 } from 'lucide-react';

// lucide-react から ブランド アイコン は 除去 — 自前 テキスト
const XIcon = ({ size = 14 }: { size?: number }) => <span aria-hidden="true" style={{ fontSize: size, fontWeight: 900, lineHeight: 1 }}>𝕏</span>;
const FbIcon = ({ size = 14 }: { size?: number }) => <span aria-hidden="true" style={{ fontSize: size, fontWeight: 900, lineHeight: 1, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>f</span>;
const InIcon = ({ size = 14 }: { size?: number }) => <span aria-hidden="true" style={{ fontSize: size * 0.78, fontWeight: 900, lineHeight: 1, fontFamily: 'Arial, sans-serif' }}>in</span>;

interface DayRow { date: string; networks: Record<string, number>; total: number; }
interface Resp { ok: boolean; configured: boolean; asOf: string; days: DayRow[]; totals: Record<string, number>; }

const NETWORKS = [
  { id: 'x',         label: 'X',        color: '#000000', Icon: XIcon },
  { id: 'facebook',  label: 'Facebook', color: '#1877F2', Icon: FbIcon },
  { id: 'linkedin',  label: 'LinkedIn', color: '#0A66C2', Icon: InIcon },
  { id: 'copy',      label: 'URL Copy', color: '#94A3B8', Icon: Copy },
];

export default function SocialShares() {
  const [authed] = useState(isMasterAuth);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    if (!authed) return;
    setLoading(true); setErr(null);
    const key = localStorage.getItem('core_master_key') || 'GAUCHE2026';
    fetch('/api/track/social-share?days=14', { headers: { 'x-master-key': key } })
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

  const totalAll = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.totals || {}).reduce((a, b) => a + b, 0);
  }, [data]);

  const maxDay = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.days.map((d) => d.total));
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
            background: 'linear-gradient(135deg, #6366F1, #EC4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 12px 24px rgba(99,102,241,0.4)',
            flexShrink: 0,
          }}><Share2 size={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.28em', color: '#EC4899', fontWeight: 800 }}>MASTER · SOCIAL SHARES</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.9rem)', margin: '4px 0 0', fontWeight: 900 }}>
              シェア 計測 (累計 {totalAll.toLocaleString('ja-JP')})
            </h1>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {data?.asOf ? `取得: ${new Date(data.asOf).toLocaleString('ja-JP')}` : '—'}
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
          }}>取得失敗: {err}</div>
        )}

        {!data && !err && <LoaderBlock message="シェア 件数 を集計中…" />}

        {data && (
          <>
            {/* KPI by network */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
              {NETWORKS.map((n) => {
                const Icon = n.Icon;
                const v = data.totals[n.id] || 0;
                return (
                  <div key={n.id} style={{
                    padding: '14px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${n.color}44`,
                  }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: n.color, fontWeight: 800, letterSpacing: '0.05em' }}>
                      <Icon size={12} /> {n.label}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: n.color, lineHeight: 1.2, marginTop: 4 }}>
                      {v.toLocaleString('ja-JP')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Daily bars (last 14 days) */}
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '8px 0 12px' }}>日別 シェア (直近 14 日)</h2>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '14px 16px', marginBottom: 18,
            }}>
              {data.days.length === 0 || data.days.every((d) => d.total === 0) ? (
                <div style={{ padding: 20, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                  まだ シェア 記録が ありません。 LP の シェア ボタンが タップされ始めると ここに 集計されます。
                </div>
              ) : (
                data.days.map((d) => {
                  const widthPct = Math.max(2, (d.total / maxDay) * 100);
                  return (
                    <div key={d.date} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 3 }}>
                        <span>{d.date}</span>
                        <span style={{ display: 'inline-flex', gap: 8 }}>
                          {NETWORKS.map((n) => (
                            <span key={n.id} style={{ color: n.color, fontWeight: 800 }}>
                              {n.label}: {d.networks[n.id] || 0}
                            </span>
                          ))}
                          <strong style={{ color: '#fff' }}>= {d.total}</strong>
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
                        {NETWORKS.map((n) => {
                          const v = d.networks[n.id] || 0;
                          if (v === 0) return null;
                          const segPct = (v / Math.max(1, d.total)) * widthPct;
                          return (
                            <div key={n.id} style={{ width: `${segPct}%`, background: n.color }} />
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
              ソース: <code>/api/track/social-share</code> · ネットワーク 別 累計 + 日次。1 IP / 60 秒 で 60 件 制限。
            </div>
          </>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
