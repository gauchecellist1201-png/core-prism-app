// ============================================================
// StatusPage — /status 公式 ステータス ページ
//
// オーナー指示 (2026-06-04 第 29 波 WWWW):
//   サービスごとの up/down + 直近 90 日 のインシデント を 公開閲覧モードで。
//   /api/status (新規, 公開) を 120 秒 cache で叩く。
// ============================================================

import { useEffect, useState } from 'react';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { ArrowLeft, ShieldCheck, ShieldAlert, ShieldX, RefreshCw, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface PublicService { name: string; ok: boolean | null; latencyMs: number | null; note: string; }
interface Incident { date: string; title: string; status: 'investigating' | 'monitoring' | 'resolved'; minutesDown?: number; }

interface StatusData {
  asOf: string;
  overall: 'operational' | 'degraded' | 'major_outage';
  services: PublicService[];
  incidents: Incident[];
}

const PALETTE = {
  operational: { color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: <ShieldCheck size={26} />, label: 'すべて正常' },
  degraded:    { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: <ShieldAlert size={26} />, label: '一部 劣化' },
  major_outage:{ color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: <ShieldX size={26} />,    label: '主要障害 発生中' },
} as const;

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetchWithTimeout('/api/status', { headers: { 'Accept': 'application/json' } }, 12000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as StatusData;
      setData(j);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    // 2 分ごとに自動 リフレッシュ
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  }, []);

  const overall = data?.overall || 'operational';
  const pal = PALETTE[overall];

  // 90 日 ヒートマップ (incidents 集合)
  const incByDate = new Map<string, Incident>();
  (data?.incidents || []).forEach((i) => incByDate.set(i.date, i));
  const days: { date: string; sev: 'ok' | 'minor' | 'major'; inc?: Incident }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const inc = incByDate.get(date);
    const sev: 'ok' | 'minor' | 'major' = !inc
      ? 'ok'
      : (inc.minutesDown && inc.minutesDown >= 30) ? 'major' : 'minor';
    days.push({ date, sev, inc });
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #070712 0%, #0d0d1c 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
    }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 18px 80px' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: 24 }}>
          <ArrowLeft size={14} /> ホームへ戻る
        </a>

        {/* Overall Banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: pal.bg,
          border: `1px solid ${pal.color}44`,
          borderRadius: 18,
          padding: '20px 22px',
          marginBottom: 24,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: `linear-gradient(135deg, ${pal.color}, ${pal.color}aa)`,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 10px 24px ${pal.color}55`,
            flexShrink: 0,
          }}>{pal.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: pal.color, fontWeight: 800 }}>CORE PRISM STATUS</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', margin: '4px 0 4px', fontWeight: 900 }}>{pal.label}</h1>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>
              {data?.asOf
                ? `最終チェック: ${new Date(data.asOf).toLocaleString('ja-JP')}`
                : '読み込み中…'}
            </div>
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
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            更新
          </button>
        </div>

        {err && (
          <div style={{
            padding: 12, borderRadius: 10,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            color: '#FCA5A5', fontSize: '0.85rem', marginBottom: 18,
          }}>
            ステータス取得に失敗: {err}
          </div>
        )}

        {/* Services */}
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '8px 0 12px' }}>サービス別 ステータス</h2>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, overflow: 'hidden',
          marginBottom: 28,
        }}>
          {(data?.services || []).map((s, i) => (
            <div key={s.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px',
              borderBottom: i === (data?.services?.length || 0) - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            }}>
              <ServiceIcon ok={s.ok} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  {s.note}{s.latencyMs ? ` · ${s.latencyMs}ms` : ''}
                </div>
              </div>
              <ServiceBadge ok={s.ok} />
            </div>
          ))}
          {(!data?.services || data.services.length === 0) && !loading && (
            <div style={{ padding: 18, fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
              ステータス情報が未設定です (env keys 未設定 / Upstash 未接続)。
            </div>
          )}
        </div>

        {/* 90 day heatmap */}
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '8px 0 12px' }}>直近 90 日 (一目で)</h2>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 18,
          marginBottom: 28,
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(30, 1fr)', gap: 4,
          }}>
            {days.map((d) => {
              const c = d.sev === 'ok' ? '#1F2937'
                      : d.sev === 'minor' ? '#FBBF24' : '#F87171';
              const ring = d.sev === 'ok' ? 'rgba(52,211,153,0.55)' : c;
              return (
                <div
                  key={d.date}
                  title={d.inc ? `${d.date} — ${d.inc.title} (${d.inc.minutesDown || '?'}min, ${d.inc.status})` : `${d.date} — 正常`}
                  style={{
                    width: '100%', aspectRatio: '1/1', borderRadius: 3,
                    background: c,
                    boxShadow: d.sev === 'ok' ? 'inset 0 0 0 1px rgba(52,211,153,0.25)' : `0 0 0 1px ${ring}`,
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            <Legend color="#1F2937" label="正常" ring="rgba(52,211,153,0.5)" />
            <Legend color="#FBBF24" label="軽微 障害" />
            <Legend color="#F87171" label="重大 障害" />
          </div>
        </div>

        {/* Incident List */}
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '8px 0 12px' }}>インシデント履歴 (直近 90 日)</h2>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          {(data?.incidents || []).length === 0 ? (
            <div style={{ padding: 18, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
              直近 90 日 に 記録された インシデント はありません 🎉
            </div>
          ) : (
            (data?.incidents || []).map((inc, i, arr) => (
              <div key={inc.date + i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 18px',
                borderBottom: i === arr.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
              }}>
                <IncidentDot status={inc.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{inc.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                    {inc.date} · {inc.status === 'resolved' ? '✅ 解決済' : inc.status === 'monitoring' ? '👀 経過観察' : '🔧 調査中'}
                    {inc.minutesDown ? ` · 推定影響 ${inc.minutesDown} 分` : ''}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          このページは <code>/api/status</code> を 120 秒キャッシュで叩いています。最終チェック日時は カード右側 をご確認ください。
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ServiceIcon({ ok }: { ok: boolean | null }) {
  if (ok === true)  return <CheckCircle2 size={22} color="#34D399" />;
  if (ok === false) return <XCircle size={22} color="#F87171" />;
  return <AlertCircle size={22} color="rgba(255,255,255,0.4)" />;
}
function ServiceBadge({ ok }: { ok: boolean | null }) {
  const map = ok === true
    ? { c: '#34D399', t: '正常' }
    : ok === false
      ? { c: '#F87171', t: '不調' }
      : { c: 'rgba(255,255,255,0.4)', t: '未設定' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 800,
      padding: '4px 10px', borderRadius: 999,
      background: `${map.c}22`, color: map.c,
      border: `1px solid ${map.c}55`,
    }}>{map.t}</span>
  );
}
function Legend({ color, label, ring }: { color: string; label: string; ring?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 12, height: 12, borderRadius: 3,
        background: color,
        boxShadow: ring ? `inset 0 0 0 1px ${ring}` : 'none',
      }} /> {label}
    </span>
  );
}
function IncidentDot({ status }: { status: Incident['status'] }) {
  const c = status === 'resolved' ? '#34D399'
          : status === 'monitoring' ? '#FBBF24' : '#F87171';
  return <span style={{ width: 10, height: 10, borderRadius: 5, background: c, marginTop: 6, flexShrink: 0 }} />;
}
