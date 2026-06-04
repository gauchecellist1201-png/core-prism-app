// ============================================================
// OnboardFunnel — /master/onboard-funnel オーナー専用 オンボ ファネル
//
// オーナー指示 (2026-06-04 第 29 波 YYYY):
//   /api/track/onboarding-step?days=14 を叩いて
//   1. 累計ファネル: welcome → name → industry → apikey → model → completed
//   2. 7 日 トレンド: 完了率 / 直近 7 日 vs 前 7 日
//   3. 落差: 最大の脱落 ステップ + 改善提案 候補
// ============================================================

import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface DayRow { date: string; data: Record<string, number>; dropRate: number; }
interface ApiResp { ok: boolean; configured: boolean; hint?: string; days: DayRow[]; }

const STEPS: { key: string; label: string; emoji: string }[] = [
  { key: 'welcome',    label: 'Welcome 開始',     emoji: '👋' },
  { key: 'name',       label: '名前を入力',       emoji: '✍️' },
  { key: 'industry',   label: '業界を選択',       emoji: '🏷️' },
  { key: 'apikey',     label: 'API キー 入力',     emoji: '🔑' },
  { key: 'model',      label: 'モデル を選ぶ',     emoji: '🧠' },
  { key: 'completed',  label: 'ダッシュボード到達', emoji: '✅' },
];

const SUGGESTIONS: Record<string, string> = {
  welcome:   '入口の魅力強化: ヒーロー の見出し / 3 行サマリ を見直し、初動の興味を引き上げる',
  name:      '入力 ハードル削減: 名前 を任意化 / Google ログインで自動取得 する',
  industry:  '選択肢の絞り込み: 主要 6 業界 + 「あとで選ぶ」を 1 タップで素通り可能に',
  apikey:    '最大の壁: 無料 Anthropic 試用 リンク / Sandbox モード /「あとで入れる」スキップ を用意',
  model:     '初期 推奨を 1 つに固定: Haiku 4.5 を初期選択にして、後から変更 OK の案内',
  completed: 'ラスト押し: ステップ 5 完了直後 にお祝い + チュートリアル動画 (TTTT) を自動再生',
};

const MASTER_KEY_LOCAL = 'core_master_key';

export default function OnboardFunnel() {
  const [data, setData] = useState<DayRow[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const masterKey = localStorage.getItem(MASTER_KEY_LOCAL) || (window.prompt('Master key (GAUCHE2026)') || '');
      if (masterKey) localStorage.setItem(MASTER_KEY_LOCAL, masterKey);
      const res = await fetch('/api/track/onboarding-step?days=14');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as ApiResp;
      setData(j.days || []);
      setConfigured(!!j.configured);
      setHint(j.hint || null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // 累計集計 (14 日 全体)
  const totals: Record<string, number> = {};
  for (const s of STEPS) totals[s.key] = 0;
  for (const day of data) {
    for (const s of STEPS) totals[s.key] += day.data[s.key] || 0;
  }

  // 直近 7 日 / 前 7 日
  const recent7 = data.slice(-7);
  const prev7 = data.slice(-14, -7);
  const sum7 = (arr: DayRow[], k: string) => arr.reduce((a, d) => a + (d.data[k] || 0), 0);
  const completionThis = (() => {
    const w = sum7(recent7, 'welcome');
    const c = sum7(recent7, 'completed');
    return w > 0 ? Math.round((c / w) * 1000) / 10 : 0;
  })();
  const completionPrev = (() => {
    const w = sum7(prev7, 'welcome');
    const c = sum7(prev7, 'completed');
    return w > 0 ? Math.round((c / w) * 1000) / 10 : 0;
  })();
  const trend = completionThis - completionPrev;

  // 最大の脱落 = (前ステップ - 当ステップ) が 最も大きいところ
  let worstDrop = { from: '', to: '', dropCount: 0, pct: 0 };
  for (let i = 1; i < STEPS.length; i++) {
    const from = STEPS[i - 1].key;
    const to = STEPS[i].key;
    const a = totals[from] || 0;
    const b = totals[to] || 0;
    const dropCount = Math.max(0, a - b);
    const pct = a > 0 ? Math.round((dropCount / a) * 1000) / 10 : 0;
    if (dropCount > worstDrop.dropCount) worstDrop = { from, to, dropCount, pct };
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #07071a 0%, #0d0d22 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 18px 80px' }}>
        <a href="/master" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: 24 }}>
          <ArrowLeft size={14} /> /master へ戻る
        </a>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #6366F1, #A855F7)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 24px rgba(99,102,241,0.4)',
            flexShrink: 0,
          }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#A855F7', fontWeight: 800 }}>MASTER · ONBOARD FUNNEL</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', margin: '4px 0 4px', fontWeight: 900 }}>
              オンボ ファネル — 直近 14 日
            </h1>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
              {configured === false
                ? hint || 'Upstash 未設定 — 集計は表示できません'
                : `welcome → completed の脱落を 1 画面で。 7 日 完了率: ${completionThis}% (前 7 日 ${completionPrev}%)`}
            </div>
          </div>
          <button onClick={load} disabled={loading} style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.15)',
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> 更新
          </button>
        </div>

        {err && (
          <div style={{
            padding: 12, borderRadius: 10,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            color: '#FCA5A5', fontSize: '0.85rem', marginBottom: 18,
          }}>
            読み込み失敗: {err}
          </div>
        )}

        {/* 7 日 完了率 + トレンド */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24,
        }}>
          <KpiCard
            title="直近 7 日 完了率"
            value={`${completionThis}%`}
            sub={`${sum7(recent7, 'completed')} / ${sum7(recent7, 'welcome')}`}
            color="#34D399"
          />
          <KpiCard
            title="前 7 日 完了率"
            value={`${completionPrev}%`}
            sub={`${sum7(prev7, 'completed')} / ${sum7(prev7, 'welcome')}`}
            color="#94A3B8"
          />
          <KpiCard
            title="トレンド"
            value={`${trend >= 0 ? '+' : ''}${trend.toFixed(1)} pt`}
            sub={trend > 0 ? '改善中' : trend < 0 ? '悪化中' : '横ばい'}
            color={trend > 0 ? '#34D399' : trend < 0 ? '#F87171' : '#94A3B8'}
            icon={trend >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          />
          <KpiCard
            title="最大 脱落 ステップ"
            value={worstDrop.to ? `${STEPS.find(s => s.key === worstDrop.from)?.emoji || ''}→${STEPS.find(s => s.key === worstDrop.to)?.emoji || ''}` : '—'}
            sub={worstDrop.to ? `${worstDrop.dropCount} 名 (${worstDrop.pct}%)` : '—'}
            color="#FBBF24"
            icon={<AlertCircle size={16} />}
          />
        </div>

        {/* ファネル バー (累計 14 日) */}
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '12px 0 12px' }}>累計 ファネル (直近 14 日)</h2>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '18px 20px', marginBottom: 24,
        }}>
          {STEPS.map((s, i) => {
            const v = totals[s.key] || 0;
            const top = totals[STEPS[0].key] || 1;
            const widthPct = top > 0 ? Math.max(2, (v / top) * 100) : 0;
            const prevCount = i === 0 ? top : (totals[STEPS[i - 1].key] || 0);
            const dropPct = prevCount > 0 ? Math.round((1 - v / prevCount) * 1000) / 10 : 0;
            return (
              <div key={s.key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: '0.85rem' }}>
                  <span><span style={{ marginRight: 6 }}>{s.emoji}</span> {s.label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <strong>{v.toLocaleString()}</strong>
                    {i > 0 && dropPct > 0 && <span style={{ marginLeft: 8, color: '#FBBF24', fontSize: 11 }}>−{dropPct}%</span>}
                  </span>
                </div>
                <div style={{
                  height: 16, borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${widthPct}%`, height: '100%',
                    background: i === STEPS.length - 1
                      ? 'linear-gradient(90deg, #34D399, #10B981)'
                      : 'linear-gradient(90deg, #6366F1, #A855F7)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 14 日 日別 表 */}
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '12px 0 12px' }}>日別 (新しい順)</h2>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, overflow: 'auto', marginBottom: 24,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>日付</th>
                {STEPS.map((s) => (
                  <th key={s.key} style={{ padding: '10px 8px', textAlign: 'right' }}>{s.emoji}<br /><span style={{ fontSize: 9 }}>{s.label}</span></th>
                ))}
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>離脱 率</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d, i) => (
                <tr key={d.date + i} style={{ borderBottom: i === data.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '8px 14px', color: 'rgba(255,255,255,0.85)' }}>{d.date}</td>
                  {STEPS.map((s) => (
                    <td key={s.key} style={{ padding: '8px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.85)' }}>
                      {d.data[s.key] || 0}
                    </td>
                  ))}
                  <td style={{ padding: '8px 14px', textAlign: 'right', color: d.dropRate > 50 ? '#F87171' : 'rgba(255,255,255,0.6)' }}>
                    {d.dropRate}%
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={STEPS.length + 2} style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.55)' }}>データ なし</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 改善提案 (最大の脱落に応じて) */}
        {worstDrop.to && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.10))',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 16, padding: '18px 20px',
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#FBBF24', fontWeight: 800, marginBottom: 8 }}>改善 候補</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 8px' }}>
              「{STEPS.find(s => s.key === worstDrop.to)?.label}」 で {worstDrop.dropCount} 名脱落 ({worstDrop.pct}%)
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.7 }}>
              {SUGGESTIONS[worstDrop.to] || '該当ステップ の UX を見直し、入力負荷 / 心理障壁 を下げる'}
            </p>
          </div>
        )}

        <div style={{ marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          ソース: <code>/api/track/onboarding-step?days=14</code> · Upstash <code>onboard:funnel:&lt;date&gt;</code> ハッシュ
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function KpiCard({ title, value, sub, color, icon }: { title: string; value: string; sub: string; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 14,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: '1.45rem', fontWeight: 900, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}
