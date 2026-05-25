// ============================================================
// MyBusinessRevenueCard — ユーザー自身の事業の売上・経費・利益
//
// オーナー指示 (2026-05-18):
//   PRISM のユーザー (経営者) が知りたいのは「自分の事業がいくら売れて、
//   いくら経費を使ったか」。CORE 運営の売上ではない。
//
// ユーザーが連携センターで自分の Stripe 読み取り専用キー (rk_live_…) を
// つなぐと、そのキーが localStorage (core_integration_stripe) に入る。
// このカードはそのキーで /api/revenue/snapshot を叩き、ユーザー自身の
// 事業の「今月の売上・経費・利益」を表示する。
// ============================================================
import { TrendingUp, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, Tooltip as RTooltip, YAxis } from 'recharts';
import { useStripeRevenue } from '../hooks/useStripeRevenue';

interface MonthPoint {
  month: string;
  revenueJpy: number;
  expenseJpy: number;
  profitJpy: number;
  txnCount?: number;
}

const yen = (n: number) => '¥' + Math.round(n).toLocaleString('ja-JP');

interface Props {
  onOpenIntegrations?: () => void;
}

export default function MyBusinessRevenueCard({ onOpenIntegrations }: Props) {
  // EarningsAndTimeHero と同じ共有フックを使う (重複 fetch を排除 + キャッシュ共有)
  const stripe = useStripeRevenue();
  const key = stripe.connected;
  const tm = stripe.thisMonth;
  const data = {
    thisMonth: tm,
    monthly: stripe.monthly,
    currencies: stripe.currencies,
  };
  const err = stripe.error;
  const loading = stripe.loading;
  const reload = stripe.refresh;

  // ─── 未連携: つなぐ案内 ───
  if (!key) {
    return (
      <button
        type="button"
        onClick={onOpenIntegrations}
        style={{
          width: '100%', textAlign: 'left', cursor: onOpenIntegrations ? 'pointer' : 'default',
          borderRadius: 12, padding: '10px 11px', marginBottom: 8,
          background: 'linear-gradient(135deg, rgba(99,91,255,0.14), rgba(99,91,255,0.06))',
          border: '1px solid rgba(99,91,255,0.32)', color: '#fff',
          display: 'flex', alignItems: 'center', gap: 9,
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: '#635BFF', color: '#fff', fontWeight: 900, fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>S</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--fg)' }}>あなたの事業の売上を表示</div>
          <div style={{ fontSize: 9.5, color: 'var(--fg-muted)', lineHeight: 1.45, marginTop: 1 }}>
            Stripe をつなぐと、今月の売上・経費・利益が自動で出ます
          </div>
        </div>
        {onOpenIntegrations && <ArrowRight size={14} color="#8E5CFF" style={{ flexShrink: 0 }} />}
      </button>
    );
  }

  const monthly12 = (data?.monthly || []).slice(-12);
  const hasTrend = monthly12.some(m => m.revenueJpy !== 0);
  const multiCurrency = (data?.currencies || []).filter(c => c !== 'jpy').length > 0;

  return (
    <div style={{
      borderRadius: 12, marginBottom: 8, padding: '0.8rem 0.85rem',
      background: 'linear-gradient(135deg, rgba(99,91,255,0.13), rgba(52,211,153,0.08))',
      border: '1px solid rgba(99,91,255,0.3)',
      color: 'var(--fg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <TrendingUp size={12} color="#635BFF" />
          <span style={{ fontSize: 9.5, letterSpacing: '0.1em', fontWeight: 800, color: '#8E5CFF' }}>
            あなたの事業の今月
          </span>
        </div>
        <button
          type="button" onClick={() => reload()} aria-label="更新"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--fg-muted)', display: 'flex', padding: 2,
          }}
        >
          {loading ? <Loader2 size={12} className="mybiz-spin" /> : <RefreshCw size={12} />}
        </button>
      </div>

      {loading && tm.revenueJpy === 0 && tm.txnCount === 0 && (
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', padding: '4px 0' }}>
          売上を読み込んでいます…
        </div>
      )}

      {err && (
        <div style={{
          fontSize: 10.5, color: '#FBBF24', lineHeight: 1.55,
          background: 'rgba(251,191,36,0.1)', borderRadius: 8, padding: '7px 9px',
        }}>
          {err}
          <button
            type="button" onClick={() => reload()}
            style={{
              display: 'block', marginTop: 5, fontSize: 10, fontWeight: 800,
              color: '#FBBF24', background: 'transparent', border: 'none',
              cursor: 'pointer', padding: 0,
            }}
          >もう一度ためす →</button>
        </div>
      )}

      {!err && (
        <>
          {/* 利益 (一番大きく) */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: 'var(--fg-muted)' }}>今月の利益 (売上 − 経費)</div>
            <div style={{
              fontSize: 22, fontWeight: 900, lineHeight: 1.1,
              color: tm.profitJpy >= 0 ? '#34d399' : '#f87171',
            }}>
              {tm.profitJpy >= 0 ? '' : '−'}{yen(Math.abs(tm.profitJpy))}
            </div>
          </div>

          {/* 売上 / 経費 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: hasTrend ? 8 : 0 }}>
            <Mini label="売上" value={yen(tm.revenueJpy)} color="#34d399" />
            <Mini label="経費 (Stripe 手数料)" value={yen(tm.expenseJpy)} color="#f87171" />
          </div>

          {/* 12 ヶ月の売上推移 (ホバーで月名 + 金額) */}
          {hasTrend && <Sparkline12 monthly={monthly12} />}

          {/* 売上 0 のとき: 原因を診断して提示 */}
          {tm.revenueJpy === 0 && tm.txnCount === 0 && (
            <div style={{
              marginTop: 8, padding: '8px 10px',
              background: 'rgba(251,191,36,0.10)',
              border: '1px solid rgba(251,191,36,0.30)',
              borderRadius: 8,
              fontSize: 10.5, color: 'var(--fg)', lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 800, marginBottom: 3, color: '#FBBF24' }}>取引が見つかりません</div>
              <div style={{ fontSize: 10, color: 'var(--fg-muted)' }}>
                考えられる原因:<br />
                ① <strong>テストモードのキー</strong>を貼っている (rk_test_… / sk_test_…)<br />
                　→ 本番モードに切替えて <code>rk_live_…</code> を取得し直してください<br />
                ② キーの権限が「Read-only」になっていない (custom restricted key の場合 balance_transactions:read が必要)<br />
                ③ 過去 12 ヶ月にこの Stripe アカウントで入金がない
              </div>
            </div>
          )}

          {/* 売上はあるが手数料 0 = 取引はあったが手数料 0 (テストデータの可能性) */}
          {tm.revenueJpy > 0 && (
            <div style={{ fontSize: 9, color: 'var(--fg-subtle)', marginTop: 6, lineHeight: 1.5 }}>
              Stripe の入金データから計算。{tm.txnCount} 件の入金。
              {multiCurrency && ' 外貨はおおよその為替で円に換算。'}
            </div>
          )}
        </>
      )}

      <style>{`.mybiz-spin { animation: mybizspin 1s linear infinite; } @keyframes mybizspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '5px 8px' }}>
      <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function Sparkline12({ monthly }: { monthly: MonthPoint[] }) {
  // 月 (YYYY-MM) を「5月」のように短く
  const labelOf = (ym: string) => {
    const m = ym.split('-')[1];
    return m ? `${parseInt(m, 10)}月` : ym;
  };
  const chartData = monthly.map(m => ({
    label: labelOf(m.month),
    rev: m.revenueJpy,
    txn: m.txnCount || 0,
  }));
  return (
    <div>
      <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
        12 ヶ月の売上推移
      </div>
      <div style={{ width: '100%', height: 44 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <YAxis hide domain={[0, 'dataMax']} />
            <RTooltip
              cursor={{ stroke: '#8E5CFF', strokeDasharray: '2 3', strokeWidth: 1 }}
              contentStyle={{
                background: 'rgba(20,20,32,0.96)',
                border: '1px solid rgba(142,92,255,0.4)',
                borderRadius: 8,
                padding: '6px 9px',
                fontSize: 11,
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, marginBottom: 2 }}
              itemStyle={{ color: '#fff', padding: 0 }}
              formatter={(v) => ['¥' + Math.round(Number(v) || 0).toLocaleString('ja-JP'), '売上']}
            />
            <Line
              type="monotone"
              dataKey="rev"
              stroke="#34d399"
              strokeWidth={1.8}
              dot={false}
              activeDot={{ r: 3, fill: '#34d399', stroke: '#0b0b14', strokeWidth: 1.5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
