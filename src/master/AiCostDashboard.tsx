// ============================================================
// /master/ai-cost — オーナー専用 AI モデル別 コスト試算ダッシュボード
//
// オーナー指示 (2026-06-03 第 8 波 NN):
//   Haiku / Sonnet / Opus が今月何トークン消費 + 何円かを可視化。
//
// 動作:
//   /api/ai/stats?days=30 を取得 → models[] を pricing マスタと突き合わせ
//   入力 / 出力トークンに per-1M USD を掛けて USD → JPY 換算 (¥150 / $1)。
//
// 認証: master key (isMasterAuth) が必須。
// ============================================================

import { useEffect, useState } from 'react';
import { isMasterAuth } from '../lib/billing';
import { LoaderBlock } from '../components/MicroLoader';

type ModelStats = {
  calls: number;
  tokens_in: number;
  tokens_out: number;
};

type DayStats = {
  date: string;
  total: { calls: number; tokens_in: number; tokens_out: number; latency_ms: number };
  routes: Record<string, unknown>;
  models: Record<string, ModelStats>;
};

type StatsResponse = {
  asOfUTC: string;
  storage: 'upstash' | 'memory';
  today: DayStats;
  aggregate: {
    total: { calls: number; tokens_in: number; tokens_out: number; latency_ms: number };
    routes: Record<string, unknown>;
    models: Record<string, ModelStats>;
  };
  perDay: DayStats[];
};

// ─── 価格表 (USD / 1M tokens) ─────────────────────────
// 2026-06 時点の Anthropic Claude / Google Gemini 公表値ベース
const PRICING_PER_1M_USD: Record<string, { in: number; out: number; label: string; color: string }> = {
  'claude-haiku-4-5':   { in: 0.80, out:  4.00, label: 'Claude Haiku 4.5',  color: '#34D399' },
  'claude-sonnet-4-5':  { in: 3.00, out: 15.00, label: 'Claude Sonnet 4.5', color: '#60A5FA' },
  'claude-sonnet-4':    { in: 3.00, out: 15.00, label: 'Claude Sonnet 4',   color: '#60A5FA' },
  'claude-opus-4-1':    { in: 15.00, out: 75.00, label: 'Claude Opus 4.1',  color: '#A78BFA' },
  'claude-opus-4':      { in: 15.00, out: 75.00, label: 'Claude Opus 4',    color: '#A78BFA' },
  'gemini-2-5-flash':   { in: 0.15, out:  0.60, label: 'Gemini 2.5 Flash',  color: '#F472B6' },
  'gemini-2-0-flash':   { in: 0.10, out:  0.40, label: 'Gemini 2.0 Flash',  color: '#F472B6' },
  'gemini-1-5-flash':   { in: 0.07, out:  0.30, label: 'Gemini 1.5 Flash',  color: '#F472B6' },
  'gemini-1-5-pro':     { in: 1.25, out:  5.00, label: 'Gemini 1.5 Pro',    color: '#FB923C' },
};

const FALLBACK = { in: 0.50, out: 2.00, label: '(未登録モデル)', color: '#9CA3AF' } as const;

// USD → JPY 換算レート (固定。為替変動は手動更新)
const USD_TO_JPY = 150;

function getPricing(model: string): { in: number; out: number; label: string; color: string } {
  // 「claude-haiku-4-5-20251022」 等の長ハッシュも前方一致で寛容に
  const lower = model.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
  for (const k of Object.keys(PRICING_PER_1M_USD)) {
    if (lower.startsWith(k)) return PRICING_PER_1M_USD[k];
  }
  return { ...FALLBACK };
}

function costUsd(stats: ModelStats, p: { in: number; out: number }): number {
  return (stats.tokens_in / 1_000_000) * p.in + (stats.tokens_out / 1_000_000) * p.out;
}

function yen(n: number): string {
  if (n >= 100_000) return '¥' + Math.round(n).toLocaleString('ja-JP');
  return '¥' + n.toFixed(2).replace(/\.?0+$/, '');
}

function num(n: number): string {
  return n.toLocaleString('en-US');
}

export default function AiCostDashboard() {
  const [authed] = useState(isMasterAuth);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) return;
    const key = localStorage.getItem('core_master_key') || 'GAUCHE2026';
    fetch('/api/ai/stats?days=30', { headers: { 'x-master-key': key } })
      .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
      .then(j => setData(j as StatsResponse))
      .catch(e => setErr(String(e)));
  }, [authed]);

  if (!authed) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
      master key が必要です。<br />
      ブラウザコンソールで <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>localStorage.setItem('core_master_key', 'GAUCHE2026')</code> を実行してから再読込してください。
    </div>;
  }

  if (err) {
    return <div style={{ padding: '4rem', color: '#fca5a5' }}>取得失敗: {err}</div>;
  }
  if (!data) {
    return <LoaderBlock message="AI 使用量を集計中…" />;
  }

  // モデル別合計 (30 日合算)
  const models = Object.entries(data.aggregate.models).map(([name, s]) => {
    const p = getPricing(name);
    const usd = costUsd(s, p);
    return {
      name,
      label: p.label,
      color: p.color,
      ...s,
      usd,
      jpy: usd * USD_TO_JPY,
      pin: p.in,
      pout: p.out,
    };
  }).sort((a, b) => b.jpy - a.jpy);

  const totalJpy = models.reduce((a, m) => a + m.jpy, 0);
  const totalUsd = models.reduce((a, m) => a + m.usd, 0);
  const totalCalls = data.aggregate.total.calls;
  const totalTokIn = data.aggregate.total.tokens_in;
  const totalTokOut = data.aggregate.total.tokens_out;

  // 今日分のコスト
  const todayJpy = Object.entries(data.today?.models || {}).reduce((acc, [name, s]) => {
    return acc + costUsd(s as ModelStats, getPricing(name)) * USD_TO_JPY;
  }, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A12', color: '#fff', padding: '2rem 1.25rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', letterSpacing: '0.3em', color: '#a78bfa', fontWeight: 700 }}>MASTER — AI COST</p>
            <h1 style={{ margin: '6px 0 0', fontSize: '1.8rem', fontWeight: 900 }}>AI モデル別 コスト試算</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>{data.storage === 'upstash' ? 'Upstash 永続化 ON' : 'メモリ集計 (再起動で消える)'}</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>取得時刻 {new Date(data.asOfUTC).toLocaleString('ja-JP')}</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>為替 ¥{USD_TO_JPY}/$ (手動レート)</div>
          </div>
        </div>

        {/* ── 直近 30 日合計 + 本日 + AI 呼び出し回数 のサマリ ─ */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem', marginBottom: '2rem',
        }}>
          {[
            { label: '直近 30 日 合計', val: yen(totalJpy), sub: `$${totalUsd.toFixed(2)}` },
            { label: '本日 (UTC)', val: yen(todayJpy), sub: '' },
            { label: '呼び出し回数', val: num(totalCalls), sub: '30 日合計' },
            { label: '入出力トークン', val: num(totalTokIn + totalTokOut), sub: `入 ${num(totalTokIn)} / 出 ${num(totalTokOut)}` },
          ].map((card, i) => (
            <div key={i} style={{
              padding: '1.1rem 1rem', borderRadius: 14,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{card.val}</div>
              {card.sub && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{card.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── モデル別 行 ───────────────────────────── */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 0.8fr 0.8fr 0.8fr 0.9fr 0.9fr',
            padding: '12px 16px',
            fontSize: '0.65rem', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)',
            fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div>モデル</div>
            <div style={{ textAlign: 'right' }}>呼び出し</div>
            <div style={{ textAlign: 'right' }}>入力 tok</div>
            <div style={{ textAlign: 'right' }}>出力 tok</div>
            <div style={{ textAlign: 'right' }}>USD/1M (in/out)</div>
            <div style={{ textAlign: 'right' }}>¥ 30 日合計</div>
          </div>
          {models.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
              まだ AI 使用ログがありません。
            </div>
          )}
          {models.map(m => (
            <div key={m.name} style={{
              display: 'grid',
              gridTemplateColumns: '1.6fr 0.8fr 0.8fr 0.8fr 0.9fr 0.9fr',
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: m.color }} />
                  <span style={{ fontSize: '0.93rem', fontWeight: 700 }}>{m.label}</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', marginTop: 2, marginLeft: 16 }}>{m.name}</div>
              </div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(m.calls)}</div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.7)' }}>{num(m.tokens_in)}</div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.7)' }}>{num(m.tokens_out)}</div>
              <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>{m.pin.toFixed(2)} / {m.pout.toFixed(2)}</div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: m.color }}>
                {yen(m.jpy)}
              </div>
            </div>
          ))}
        </div>

        {/* ── 注記 ───────────────────────────────────── */}
        <div style={{ marginTop: 24, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 6px' }}>
            ※ 価格表は <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>src/master/AiCostDashboard.tsx</code> の
            <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>PRICING_PER_1M_USD</code> を手動更新。
          </p>
          <p style={{ margin: '0 0 6px' }}>
            ※ 為替は固定 ¥{USD_TO_JPY}/$。週次でレビュー推奨。
          </p>
          <p style={{ margin: 0 }}>
            ※ メモリ集計モードの場合、Vercel Edge 再起動で値が消えます。Upstash REST URL/TOKEN を Vercel env に設定すると永続化されます。
          </p>
        </div>
      </div>
    </div>
  );
}
