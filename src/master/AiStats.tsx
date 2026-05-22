// ============================================================
// /master/ai-stats — オーナー専用 AI 使用量ダッシュボード
//
// /api/ai/stats を読み、ルート別・モデル別の呼び出し回数 / トークン
// 数 / Gemini 無料枠残量 (1500 req/日) を可視化する。
//
// 認証: localStorage の master key (isMasterAuth) を必須。
//   master key 自体は API へも x-master-key ヘッダーで送る。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { isMasterAuth } from '../lib/billing';
import { LoaderBlock } from '../components/MicroLoader';

type RouteStats = {
  calls: number;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
};

type ModelStats = {
  calls: number;
  tokens_in: number;
  tokens_out: number;
};

type DayStats = {
  date: string;
  total: RouteStats;
  routes: Record<string, RouteStats>;
  models: Record<string, ModelStats>;
};

type StatsResponse = {
  asOfUTC: string;
  storage: 'upstash' | 'memory';
  today: DayStats;
  aggregate: {
    total: RouteStats;
    routes: Record<string, RouteStats>;
    models: Record<string, ModelStats>;
  };
  perDay: DayStats[];
  gemini: {
    dailyFreeQuota: number;
    usedToday: number;
    remaining: number;
  };
};

const ROUTE_LABELS: Record<string, { label: string; color: string; note: string }> = {
  'master:claude': {
    label: 'マスター・Claude (重い処理)',
    color: '#f97316',
    note: '画像つき / 長文 / 高度な推論',
  },
  'master:claude-rescue': {
    label: 'マスター・Claude (救済)',
    color: '#ef4444',
    note: 'Gemini 無料枠枯渇 → Claude へ自動切替',
  },
  'light:gemini': {
    label: '軽量・Gemini (無料)',
    color: '#10b981',
    note: 'ふだんの軽い処理。1日 1,500 回まで無料',
  },
  'fallback:claude': {
    label: 'フォールバック・Claude→Gemini',
    color: '#8b5cf6',
    note: 'Claude が応答できず Gemini が代行',
  },
  unknown: {
    label: 'その他',
    color: '#6b7280',
    note: '分類不能',
  },
};

const KNOWN_ROUTES = ['master:claude', 'master:claude-rescue', 'light:gemini', 'fallback:claude'];

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ja-JP');
}

function pct(n: number, d: number): string {
  if (!d) return '0%';
  return ((n / d) * 100).toFixed(1) + '%';
}

async function fetchStats(days: number, masterKey: string): Promise<StatsResponse> {
  const res = await fetch(`/api/ai/stats?days=${days}`, {
    headers: { 'x-master-key': masterKey },
  });
  if (!res.ok) throw new Error(`stats ${res.status}`);
  return res.json();
}

function getMasterKey(): string {
  try {
    return localStorage.getItem('core_master_key_v1') || '';
  } catch {
    return '';
  }
}

export default function AiStats() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const authed = isMasterAuth();

  useEffect(() => {
    if (!authed) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchStats(days, getMasterKey())
      .then(r => { if (alive) setData(r); })
      .catch(e => { if (alive) setError(e?.message || 'fetch failed'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [days, refreshTick, authed]);

  const aggRoutes = data?.aggregate.routes || {};
  const aggModels = data?.aggregate.models || {};
  const today = data?.today;

  const orderedRoutes = useMemo(() => {
    const known = KNOWN_ROUTES.map(r => [r, aggRoutes[r] || { calls: 0, tokens_in: 0, tokens_out: 0, latency_ms: 0 }] as const);
    const other = Object.entries(aggRoutes).filter(([r]) => !KNOWN_ROUTES.includes(r));
    return [...known, ...other];
  }, [aggRoutes]);

  const modelEntries = useMemo(() => {
    return Object.entries(aggModels)
      .sort((a, b) => b[1].calls - a[1].calls)
      .slice(0, 20);
  }, [aggModels]);

  if (!authed) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ marginTop: 0 }}>AI 使用量ダッシュボード</h1>
          <p>このページはオーナー専用です。</p>
          <p style={{ color: '#888' }}>
            <a href="/master" style={{ color: '#60a5fa' }}>/master</a> でマスターキーを入力してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 20px 80px' }}>
        <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>AI 使用量ダッシュボード</h1>
          <span style={{ color: '#888', fontSize: 13 }}>
            {data ? `更新: ${new Date(data.asOfUTC).toLocaleString('ja-JP')} · 保存先: ${data.storage === 'upstash' ? 'Upstash KV' : 'メモリ (再起動で消える)'}` : ''}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              style={selectStyle}
              aria-label="集計期間"
            >
              <option value={1}>今日のみ</option>
              <option value={7}>直近 7 日</option>
              <option value={14}>直近 14 日</option>
              <option value={30}>直近 30 日</option>
            </select>
            <button onClick={() => setRefreshTick(t => t + 1)} style={btnStyle}>
              再取得
            </button>
          </div>
        </header>

        {loading && (
          <div style={cardStyle}>
            <LoaderBlock accent="#A78BFA" message="集計を取りに行ってます" padding="1rem 0" />
          </div>
        )}
        {error && (
          <div style={{ ...cardStyle, borderColor: '#7f1d1d', color: '#fca5a5' }}>
            読み込みに失敗しました: {error}
            <div style={{ marginTop: 8, fontSize: 12, color: '#aaa' }}>
              マスターキーが /master で登録されているか、x-master-key が一致するかを確認してください。
            </div>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Gemini 無料枠 */}
            <section style={cardStyle}>
              <h2 style={h2Style}>Gemini 無料枠 (今日)</h2>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: data.gemini.remaining > 200 ? '#10b981' : data.gemini.remaining > 50 ? '#f59e0b' : '#ef4444' }}>
                  {fmt(data.gemini.remaining)}
                </div>
                <div style={{ color: '#aaa' }}>残り (/ {fmt(data.gemini.dailyFreeQuota)} 回)</div>
              </div>
              <div style={progressOuter}>
                <div
                  style={{
                    ...progressInner,
                    width: pct(data.gemini.usedToday, data.gemini.dailyFreeQuota),
                    background: data.gemini.usedToday < data.gemini.dailyFreeQuota * 0.8 ? '#10b981' : '#ef4444',
                  }}
                />
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: '#aaa' }}>
                今日の使用: {fmt(data.gemini.usedToday)} 回 / {fmt(data.gemini.dailyFreeQuota)} 回 ({pct(data.gemini.usedToday, data.gemini.dailyFreeQuota)})
              </div>
            </section>

            {/* ルート別 */}
            <section style={cardStyle}>
              <h2 style={h2Style}>ルート別 (直近 {days} 日合計)</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>ルート</th>
                      <th style={thStyle}>説明</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>呼び出し回数</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>入力トークン</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>出力トークン</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>平均レイテンシ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedRoutes.map(([route, s]) => {
                      const meta = ROUTE_LABELS[route] || ROUTE_LABELS.unknown;
                      const avg = s.calls ? Math.round(s.latency_ms / s.calls) : 0;
                      return (
                        <tr key={route}>
                          <td style={tdStyle}>
                            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: meta.color, marginRight: 8 }} />
                            <span style={{ fontWeight: 600 }}>{meta.label}</span>
                            <div style={{ fontSize: 11, color: '#888' }}>{route}</div>
                          </td>
                          <td style={{ ...tdStyle, color: '#aaa', fontSize: 13 }}>{meta.note}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.calls)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#aaa' }}>{fmt(s.tokens_in)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#aaa' }}>{fmt(s.tokens_out)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#aaa' }}>{avg ? `${fmt(avg)} ms` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 700 }} colSpan={2}>合計</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(data.aggregate.total.calls)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(data.aggregate.total.tokens_in)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(data.aggregate.total.tokens_out)}</td>
                      <td style={tdStyle}>—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* モデル別 */}
            <section style={cardStyle}>
              <h2 style={h2Style}>モデル別 (上位 20 / 直近 {days} 日)</h2>
              {modelEntries.length === 0 ? (
                <div style={{ color: '#888' }}>まだ記録がありません。</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>モデル</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>呼び出し</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>入力トークン</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>出力トークン</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelEntries.map(([name, s]) => (
                        <tr key={name}>
                          <td style={tdStyle}>{name}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(s.calls)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#aaa' }}>{fmt(s.tokens_in)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#aaa' }}>{fmt(s.tokens_out)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 日別 */}
            <section style={cardStyle}>
              <h2 style={h2Style}>日別 (直近 {days} 日)</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>日付 (UTC)</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>呼び出し</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>入力</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>出力</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Gemini</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Claude</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.perDay.map(d => {
                      const gem = (d.routes['light:gemini']?.calls || 0) + (d.routes['fallback:claude']?.calls || 0);
                      const cla = (d.routes['master:claude']?.calls || 0) + (d.routes['master:claude-rescue']?.calls || 0);
                      return (
                        <tr key={d.date}>
                          <td style={tdStyle}>{d.date}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(d.total.calls)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#aaa' }}>{fmt(d.total.tokens_in)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#aaa' }}>{fmt(d.total.tokens_out)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#10b981' }}>{fmt(gem)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#f97316' }}>{fmt(cla)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div style={{ marginTop: 24, color: '#888', fontSize: 12 }}>
              ※ 「呼び出し回数」はクライアントが /api/ai に投げた成功リクエスト数。失敗は記録されません。<br />
              ※ 「Gemini 無料枠」は 1 日 1,500 回 (Google AI Studio の標準フリーティア) を基準。実際の残量は Google 側の集計が正です。<br />
              ※ Upstash KV が未設定だと記録はメモリのみ (Edge 再起動で消える)。本番では UPSTASH_REDIS_REST_URL / TOKEN を設定してください。
              {today && (
                <div style={{ marginTop: 8 }}>今日 ({today.date}) の合計: {fmt(today.total.calls)} 回 / 入力 {fmt(today.total.tokens_in)} tok / 出力 {fmt(today.total.tokens_out)} tok</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ───── スタイル ─────
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0b0d12',
  color: '#e5e7eb',
  fontFamily: 'system-ui, -apple-system, "Helvetica Neue", "Hiragino Sans", sans-serif',
};

const cardStyle: React.CSSProperties = {
  background: '#13161d',
  border: '1px solid #1f2430',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
};

const h2Style: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 16,
  fontSize: 18,
  color: '#fafafa',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #1f2430',
  color: '#9ca3af',
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: '10px',
  borderBottom: '1px solid #161922',
};

const btnStyle: React.CSSProperties = {
  background: '#1f2937',
  color: '#fff',
  border: '1px solid #374151',
  borderRadius: 8,
  padding: '6px 14px',
  cursor: 'pointer',
};

const selectStyle: React.CSSProperties = {
  background: '#1f2937',
  color: '#fff',
  border: '1px solid #374151',
  borderRadius: 8,
  padding: '6px 10px',
};

const progressOuter: React.CSSProperties = {
  marginTop: 12,
  height: 10,
  borderRadius: 5,
  background: '#1f2430',
  overflow: 'hidden',
};

const progressInner: React.CSSProperties = {
  height: '100%',
  transition: 'width 0.3s ease',
};
