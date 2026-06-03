// ============================================================
// /master/secrets-health — オーナー専用 API キー / 疎通 ダッシュボード
//
// オーナー指示 (2026-06-04 第 14 波 FFF):
//   Anthropic / Stripe / Resend / Gemini / Upstash / Slack / Cron / VAPID
//   の env 設定 + 疎通テスト結果を 1 画面で一目確認できる。
// ============================================================

import { useEffect, useState } from 'react';
import { isMasterAuth } from '../lib/billing';
import { LoaderBlock } from '../components/MicroLoader';

interface SecretCheck {
  key: string;
  label: string;
  present: boolean;
  preview: string;
  reachOk: boolean | null;
  reachLatencyMs: number | null;
  reachNote: string;
}

interface HealthResponse {
  asOf: string;
  checks: SecretCheck[];
}

function statusEmoji(c: SecretCheck): { e: string; bg: string; fg: string } {
  if (!c.present) return { e: '⚪', bg: 'rgba(255,255,255,0.04)', fg: 'rgba(255,255,255,0.5)' };
  if (c.reachOk === true) return { e: '✅', bg: 'rgba(16,185,129,0.12)', fg: '#34D399' };
  if (c.reachOk === false) return { e: '❌', bg: 'rgba(220,38,38,0.12)', fg: '#F87171' };
  return { e: '🟡', bg: 'rgba(251,191,36,0.12)', fg: '#FBBF24' };
}

export default function SecretsHealth() {
  const [authed] = useState(isMasterAuth);
  const [data, setData] = useState<HealthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);

  const load = () => {
    if (!authed) return;
    setReloading(true);
    setErr(null);
    const key = localStorage.getItem('core_master_key') || 'GAUCHE2026';
    fetch('/api/master/secrets-health', { headers: { 'x-master-key': key } })
      .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
      .then(j => setData(j as HealthResponse))
      .catch(e => setErr(String(e)))
      .finally(() => setReloading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [authed]);

  if (!authed) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
      master key が必要です。<br />
      ブラウザコンソールで <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>localStorage.setItem('core_master_key', 'GAUCHE2026')</code> を実行してから再読込してください。
    </div>;
  }
  if (err) return <div style={{ padding: '4rem', color: '#fca5a5' }}>取得失敗: {err}</div>;
  if (!data) return <LoaderBlock message="env を疎通テスト中…" />;

  const okCount = data.checks.filter(c => c.reachOk === true).length;
  const ngCount = data.checks.filter(c => c.reachOk === false).length;
  const missingCount = data.checks.filter(c => !c.present).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A12', color: '#fff', padding: '2rem 1.25rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', letterSpacing: '0.3em', color: '#a78bfa', fontWeight: 700 }}>MASTER — SECRETS HEALTH</p>
            <h1 style={{ margin: '6px 0 0', fontSize: '1.8rem', fontWeight: 900 }}>API キー 健康診断</h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>取得時刻 {new Date(data.asOf).toLocaleString('ja-JP')}</p>
          </div>
          <button
            onClick={load}
            disabled={reloading}
            style={{
              padding: '8px 18px', borderRadius: 999,
              background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
              color: '#fff', border: 'none',
              fontSize: '0.82rem', fontWeight: 700,
              cursor: reloading ? 'wait' : 'pointer',
              opacity: reloading ? 0.7 : 1,
            }}
          >{reloading ? '疎通中…' : '🔄 再診断'}</button>
        </div>

        {/* サマリ */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem', marginBottom: '2rem',
        }}>
          {[
            { label: '🟢 OK', val: okCount, color: '#34D399' },
            { label: '🔴 失敗', val: ngCount, color: '#F87171' },
            { label: '⚪ 未設定', val: missingCount, color: 'rgba(255,255,255,0.6)' },
            { label: '合計チェック', val: data.checks.length, color: '#fff' },
          ].map((card, i) => (
            <div key={i} style={{
              padding: '1.1rem 1rem', borderRadius: 14,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: card.color, fontVariantNumeric: 'tabular-nums' }}>{card.val}</div>
            </div>
          ))}
        </div>

        {/* 行詳細 */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          {data.checks.map((c, i) => {
            const st = statusEmoji(c);
            return (
              <div key={c.key} style={{
                display: 'grid',
                gridTemplateColumns: '40px 1.4fr 1.1fr 1.7fr 0.5fr',
                padding: '14px 16px',
                gap: 12,
                alignItems: 'center',
                borderBottom: i === data.checks.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                background: st.bg,
              }}>
                <div style={{ fontSize: 20, textAlign: 'center' }}>{st.e}</div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{c.label}</div>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: 'Menlo, monospace' }}>{c.key}</div>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'Menlo, monospace', wordBreak: 'break-all' }}>
                  {c.preview}
                </div>
                <div style={{ fontSize: '0.78rem', color: st.fg, lineHeight: 1.5 }}>
                  {c.reachNote}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {c.reachLatencyMs !== null ? `${c.reachLatencyMs}ms` : ''}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 4px' }}>※ キーの値は <strong>先頭 4 字 + 末尾 2 字</strong> のみ表示します (画面共有してもキー全体は漏れません)。</p>
          <p style={{ margin: 0 }}>※ 失敗 / 未設定は <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>vercel env</code> で確認 / 追加してください。</p>
        </div>
      </div>
    </div>
  );
}
