// ============================================================
// FinancialKpiCards — /master/ai-stats の上部に並ぶ 3 枚カード
//
// 表示する 3 つの数字:
//   A) 当月の粗利率   (今月売上 - 今月 AI コスト) / 今月売上 × 100
//   B) 来月予測赤字額 直近 3 ヶ月平均 burn と 平均売上伸び率からの予測
//   C) 残ランウェイ   現金残高 / 月間 burn
//
// 鉄則 (~/.claude/skills/core-prism-honest-numbers/SKILL.md):
//   - 実データのみ。架空数字で埋めない。
//   - データが足りなければ「未設定」「データなし」と素直に書く。
//   - 整数で表示。¥600 のような小数や根拠不明な小額は出さない。
// ============================================================
import { useEffect, useState } from 'react';
import { useStripeRevenue, type MonthRevenuePoint } from '../hooks/useStripeRevenue';

// localStorage キー (このダッシュボード専用に新規)
const API_COST_BY_MONTH_LS = 'core-prism:api-cost-by-month';  // { 'YYYY-MM': number(JPY) }
const CASH_BALANCE_LS      = 'core-prism:cash-balance';        // number(JPY)

type ApiCostByMonth = Record<string, number>;

function readApiCostByMonth(): ApiCostByMonth | null {
  try {
    const raw = localStorage.getItem(API_COST_BY_MONTH_LS);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (j && typeof j === 'object') return j as ApiCostByMonth;
    return null;
  } catch { return null; }
}

function readCashBalance(): number | null {
  try {
    const raw = localStorage.getItem(CASH_BALANCE_LS);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  } catch { return null; }
}

function writeCashBalance(n: number) {
  try { localStorage.setItem(CASH_BALANCE_LS, String(Math.round(n))); } catch { /* */ }
}

function thisMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtYen(n: number): string {
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

/** 直近 N ヶ月の monthly point を、当月を含む形で取り出す */
function lastNMonths(monthly: MonthRevenuePoint[], n: number): MonthRevenuePoint[] {
  if (!monthly?.length) return [];
  return monthly.slice(-n);
}

/** 来月予測赤字額: 直近 3 ヶ月の平均 burn と 平均売上伸び率から来月の収支を見積もる
 *  戻り値:
 *    - 数字 > 0: 赤字額 (JPY)
 *    - 数字 <= 0: 黒字想定 (-値で黒字額)
 *    - null:    データ不足
 */
function predictNextMonthDeficit(monthly: MonthRevenuePoint[]): number | null {
  const last3 = lastNMonths(monthly, 3);
  if (last3.length < 3) return null;
  // 各月の expense は Stripe API 由来 (refund 等)。実 burn には API/家賃が乗らないため、
  // ここでは Stripe の expense + 当該月の AI コスト (取れれば) を合算する。
  const costs = readApiCostByMonth() || {};
  const burns = last3.map(m => m.expenseJpy + (costs[m.month] || 0));
  const avgBurn = burns.reduce((a, b) => a + b, 0) / burns.length;
  // 売上の伸び率 (前月比) の平均
  const growths: number[] = [];
  for (let i = 1; i < last3.length; i++) {
    const prev = last3[i - 1].revenueJpy;
    const cur = last3[i].revenueJpy;
    if (prev > 0) growths.push((cur - prev) / prev);
  }
  const avgGrowth = growths.length ? growths.reduce((a, b) => a + b, 0) / growths.length : 0;
  const lastRev = last3[last3.length - 1].revenueJpy;
  const predictedRevenue = lastRev * (1 + avgGrowth);
  // 赤字額 = 予測 burn - 予測売上
  return Math.round(avgBurn - predictedRevenue);
}

/** 月間 burn rate (JPY/月) — 直近 3 ヶ月平均 */
function monthlyBurnRate(monthly: MonthRevenuePoint[]): number | null {
  const last3 = lastNMonths(monthly, 3);
  if (last3.length < 3) return null;
  const costs = readApiCostByMonth() || {};
  const burns = last3.map(m => m.expenseJpy + (costs[m.month] || 0));
  const avg = burns.reduce((a, b) => a + b, 0) / burns.length;
  return Math.round(avg);
}

export default function FinancialKpiCards() {
  const { thisMonth, monthly, connected } = useStripeRevenue();
  const [apiCosts, setApiCosts] = useState<ApiCostByMonth | null>(() => readApiCostByMonth());
  const [cash, setCash] = useState<number | null>(() => readCashBalance());
  const [editCash, setEditCash] = useState(false);
  const [cashDraft, setCashDraft] = useState<string>('');

  // localStorage が他タブで変わった時の反映
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === API_COST_BY_MONTH_LS) setApiCosts(readApiCostByMonth());
      if (e.key === CASH_BALANCE_LS) setCash(readCashBalance());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const monthKey = thisMonthKey();
  const thisMonthCost = apiCosts ? apiCosts[monthKey] : undefined;

  // ───── A) 当月の粗利率 ─────
  let grossMarginNode: React.ReactNode;
  let grossMarginSub: React.ReactNode;
  const revenueThis = thisMonth?.revenueJpy || 0;
  if (!connected || revenueThis <= 0) {
    grossMarginNode = <span style={mutedBig}>未設定</span>;
    grossMarginSub = (
      <span>
        Stripe を連携すると表示されます{' '}
        <a href="/connect/stripe" style={linkStyle}>連携する</a>
      </span>
    );
  } else if (thisMonthCost === undefined) {
    grossMarginNode = <span style={mutedBig}>データ取得中</span>;
    grossMarginSub = <span>今月の AI コストがまだ集計されていません</span>;
  } else {
    const gross = revenueThis - thisMonthCost;
    const marginPct = Math.round((gross / revenueThis) * 100);
    const color = marginPct >= 50 ? '#10b981' : marginPct >= 20 ? '#f59e0b' : '#ef4444';
    grossMarginNode = <span style={{ ...bigNum, color }}>{marginPct}%</span>;
    grossMarginSub = (
      <span>
        売上 {fmtYen(revenueThis)} − AI 費 {fmtYen(thisMonthCost)} = 粗利 {fmtYen(gross)}
      </span>
    );
  }

  // ───── B) 来月予測赤字額 ─────
  let deficitNode: React.ReactNode;
  let deficitSub: React.ReactNode;
  if (!connected || monthly.length < 3) {
    deficitNode = <span style={mutedBig}>データ不足</span>;
    deficitSub = <span>予測には 3 ヶ月分のデータが必要です (現在 {monthly.length} ヶ月)</span>;
  } else {
    const def = predictNextMonthDeficit(monthly);
    if (def == null) {
      deficitNode = <span style={mutedBig}>データ不足</span>;
      deficitSub = <span>予測には 3 ヶ月分のデータが必要です</span>;
    } else if (def > 0) {
      deficitNode = <span style={{ ...bigNum, color: '#ef4444' }}>{fmtYen(def)}</span>;
      deficitSub = <span>直近 3 ヶ月の平均から推定した来月の赤字額</span>;
    } else {
      deficitNode = <span style={{ ...bigNum, color: '#10b981' }}>{fmtYen(-def)}</span>;
      deficitSub = <span>来月は黒字想定 (赤字なし)</span>;
    }
  }

  // ───── C) 残ランウェイ ─────
  let runwayNode: React.ReactNode;
  let runwaySub: React.ReactNode;
  const burn = connected && monthly.length >= 3 ? monthlyBurnRate(monthly) : null;
  if (cash == null) {
    runwayNode = <span style={mutedBig}>未設定</span>;
    runwaySub = (
      <span>
        現金残高を設定すると表示されます{' '}
        <button
          type="button"
          onClick={() => { setCashDraft(''); setEditCash(true); }}
          style={inlineBtn}
        >
          設定する
        </button>
      </span>
    );
  } else if (burn == null || burn <= 0) {
    runwayNode = <span style={mutedBig}>計算不能</span>;
    runwaySub = <span>月間 burn を計算するには 3 ヶ月分のデータが必要です</span>;
  } else {
    const months = Math.floor(cash / burn);
    const color = months >= 12 ? '#10b981' : months >= 6 ? '#f59e0b' : '#ef4444';
    runwayNode = <span style={{ ...bigNum, color }}>{months}ヶ月</span>;
    runwaySub = (
      <span>
        現金 {fmtYen(cash)} ÷ 月 burn {fmtYen(burn)}{' '}
        <button
          type="button"
          onClick={() => { setCashDraft(String(cash)); setEditCash(true); }}
          style={inlineBtnSmall}
        >
          残高を更新
        </button>
      </span>
    );
  }

  return (
    <>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <KpiCard
          title="当月の粗利率"
          formula="(売上 − AI コスト) ÷ 売上"
          big={grossMarginNode}
          sub={grossMarginSub}
        />
        <KpiCard
          title="来月の予測赤字額"
          formula="平均 burn − 予測売上 (直近 3 ヶ月)"
          big={deficitNode}
          sub={deficitSub}
        />
        <KpiCard
          title="残ランウェイ"
          formula="現金残高 ÷ 月間 burn"
          big={runwayNode}
          sub={runwaySub}
        />
      </section>

      {editCash && (
        <div style={modalOverlay} onClick={() => setEditCash(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>現金残高を入力</h3>
            <p style={{ color: '#aaa', fontSize: 13, marginTop: 0 }}>
              いま会社の口座にある全現金 (JPY) を入れてください。残ランウェイの計算に使います。
            </p>
            <input
              type="number"
              inputMode="numeric"
              value={cashDraft}
              onChange={e => setCashDraft(e.target.value)}
              placeholder="例: 5000000"
              autoFocus
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditCash(false)} style={btnGhost}>キャンセル</button>
              <button
                onClick={() => {
                  const n = Number(cashDraft);
                  if (Number.isFinite(n) && n >= 0) {
                    writeCashBalance(n);
                    setCash(Math.round(n));
                    setEditCash(false);
                  }
                }}
                style={btnPrimary}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ───── 部品 ─────

function KpiCard({
  title,
  formula,
  big,
  sub,
}: {
  title: string;
  formula: string;
  big: React.ReactNode;
  sub: React.ReactNode;
}) {
  return (
    <div className="cp-card cp-card-tap" style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={{ minHeight: 48, display: 'flex', alignItems: 'baseline' }}>
        {big}
      </div>
      <div style={subStyle}>{sub}</div>
      <div style={formulaStyle}>計算式: {formula}</div>
    </div>
  );
}

// ───── スタイル ─────

const cardStyle: React.CSSProperties = {
  background: '#13161d',
  border: '1px solid #1f2430',
  borderRadius: 12,
  padding: '16px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#9ca3af',
  fontWeight: 500,
};

const bigNum: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 700,
  lineHeight: 1.1,
  fontVariantNumeric: 'tabular-nums',
};

const mutedBig: React.CSSProperties = {
  ...bigNum,
  fontSize: 22,
  color: '#6b7280',
  fontWeight: 600,
};

const subStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#9ca3af',
  lineHeight: 1.5,
};

const formulaStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#6b7280',
  opacity: 0.6,
  marginTop: 2,
  borderTop: '1px dashed #1f2430',
  paddingTop: 6,
};

const linkStyle: React.CSSProperties = {
  color: '#60a5fa',
  textDecoration: 'underline',
};

const inlineBtn: React.CSSProperties = {
  background: '#1f2937',
  color: '#fff',
  border: '1px solid #374151',
  borderRadius: 6,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 12,
  marginLeft: 6,
};

const inlineBtnSmall: React.CSSProperties = {
  ...inlineBtn,
  padding: '2px 8px',
  fontSize: 11,
};

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 16,
};

const modalBox: React.CSSProperties = {
  background: '#13161d',
  border: '1px solid #2a3142',
  borderRadius: 14,
  padding: 20,
  width: 'min(420px, 100%)',
  color: '#e5e7eb',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0b0d12',
  color: '#fff',
  border: '1px solid #374151',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 16,
  boxSizing: 'border-box',
};

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: '#9ca3af',
  border: '1px solid #2a3142',
  borderRadius: 8,
  padding: '8px 14px',
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  background: '#7c3aed',
  color: '#fff',
  border: '1px solid #7c3aed',
  borderRadius: 8,
  padding: '8px 14px',
  cursor: 'pointer',
  fontWeight: 600,
};
