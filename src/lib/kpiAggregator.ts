// ============================================================
// kpiAggregator — 事業計画の KPI 目標 vs 実績を集計し、ギャップを算出する
// ソース:
//   1. Stripe API (/api/billing/metrics) — MRR / ARR / 有料数 / Churn
//   2. localStorage  (core_feature_usage_v1) — 機能別アクション数
//   3. Vercel Analytics — public read API なし。代替で localStorage session 計測
// 目標値は 06_リスク_KPI_ロードマップ.md から抽出 (parseKpiTargetsFromDoc)
// ============================================================
import { BUSINESS_PLAN_DOCS } from '../data/businessPlan';

export type KpiUnit = 'count' | 'jpy' | 'percent' | 'ratio';

export interface KpiTarget {
  id: string;
  category: '獲得' | '転換' | '継続' | '収益' | '効率' | '機能';
  label: string;
  /** 目標値 (絶対数 / 金額 / 比率 0-1 / パーセント 0-100) */
  target: number;
  unit: KpiUnit;
  /** Q4 末・月次 などの説明 */
  horizon?: string;
}

export interface KpiActual {
  id: string;
  value: number | null;
  /** 集計に使ったソース */
  source: 'stripe' | 'local' | 'analytics' | 'unknown';
  asOf: string;
}

export interface KpiGap {
  target: KpiTarget;
  actual: KpiActual;
  /** 0-1+。null は計測不能 */
  achievement: number | null;
  status: 'green' | 'amber' | 'red' | 'unknown';
}

// ─── 目標値 (06_リスク_KPI_ロードマップ.md より) ───
//
// マークダウンの「目標 (Q4 末)」表をハードコードでマップ。
// 表のパース揺れに弱いので、ドキュメント更新時はここを合わせる。
export const KPI_TARGETS: KpiTarget[] = [
  { id: 'new_users_monthly', category: '獲得', label: '新規ユーザー / 月', target: 5000, unit: 'count', horizon: 'Q4 末' },
  { id: 'new_paid_monthly',  category: '獲得', label: '新規有料転換数 / 月', target: 1000, unit: 'count', horizon: 'Q4 末' },
  { id: 'free_to_paid_rate', category: '転換', label: 'Free → Paid 転換率', target: 20, unit: 'percent', horizon: 'Q4 末' },
  { id: 'churn_rate_monthly',category: '継続', label: '月次解約率',          target: 5,  unit: 'percent', horizon: '< 5%' },
  { id: 'dau_mau',           category: '継続', label: 'DAU / MAU',           target: 30, unit: 'percent', horizon: '> 30%' },
  { id: 'arpu_paid_jpy',     category: '収益', label: 'ARPU (有料)',         target: 4500, unit: 'jpy', horizon: 'Q4 末' },
  { id: 'ltv_cac',           category: '効率', label: 'LTV / CAC',           target: 3, unit: 'ratio', horizon: '> 3' },
  { id: 'gross_margin',      category: '効率', label: 'Gross Margin',        target: 75, unit: 'percent', horizon: '> 75%' },
  { id: 'nps',               category: '効率', label: 'NPS',                 target: 40, unit: 'count', horizon: '> 40' },
];

// 月次 MRR 目標 (Q1 〜): 5/12 ベータ公開直後は ¥0 がスタートライン
// Q1 末 (7 月) で MRR ¥1M、Q2 末 (10 月) で ¥10M
export const MRR_TARGET_QUARTERS: { q: string; mrrJpy: number }[] = [
  { q: 'Q1 (2026-07)', mrrJpy: 1_000_000 },
  { q: 'Q2 (2026-10)', mrrJpy: 10_000_000 },
  { q: 'Q3 (2027-01)', mrrJpy: 20_000_000 },
];

// 現時点 (2026-05) の暫定目標: ベータ公開 1 週目なので MRR は控えめに
export const CURRENT_MRR_TARGET_JPY = 100_000; // 5 月末まずは ¥10 万 MRR を狙う暫定値

// ─── 実績取得 ───

/** Stripe メトリクス取得 */
export async function fetchStripeMetrics(): Promise<{
  ok: boolean;
  paidCount: number;
  mrrJpy: number;
  arrJpy: number;
  churnRate30d: number | null;
  asOf: string;
}> {
  try {
    const resp = await fetch('/api/billing/metrics');
    const j = await resp.json();
    if (!resp.ok) {
      return { ok: false, paidCount: 0, mrrJpy: 0, arrJpy: 0, churnRate30d: null, asOf: new Date().toISOString() };
    }
    return {
      ok: true,
      paidCount: j.paidCount || 0,
      mrrJpy: j.mrrJpy || 0,
      arrJpy: j.arrJpy || 0,
      churnRate30d: typeof j.churnRate30d === 'number' ? j.churnRate30d : null,
      asOf: j.asOf || new Date().toISOString(),
    };
  } catch {
    return { ok: false, paidCount: 0, mrrJpy: 0, arrJpy: 0, churnRate30d: null, asOf: new Date().toISOString() };
  }
}

/** localStorage から機能アクション総数 (今月) */
export function getLocalActionCount(): number {
  try {
    const raw = localStorage.getItem('core_feature_usage_v1');
    if (!raw) return 0;
    const data = JSON.parse(raw) as { month: string; counts: Record<string, number> };
    return Object.values(data.counts || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  } catch { return 0; }
}

/** localStorage の簡易セッショントラッキング (Vercel Analytics 代替) */
const SESSION_KEY = 'core_kpi_sessions_v1';
interface SessionData { days: Record<string, number>; }

export function trackVisit() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(SESSION_KEY);
    const data: SessionData = raw ? JSON.parse(raw) : { days: {} };
    data.days[today] = (data.days[today] || 0) + 1;
    // 90 日より古いデータは捨てる
    const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    for (const k of Object.keys(data.days)) {
      if (k < cutoff) delete data.days[k];
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch { /* */ }
}

export function getDauMauRatio(): number | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    const last30 = Object.keys(data.days).filter(d => {
      return d > new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    }).length;
    if (last30 === 0) return null;
    // 単一ローカルユーザーでは MAU=1 想定で「過去 30 日に何日アクセスしたか」を比率に
    return (last30 / 30);
  } catch { return null; }
}

// ─── ギャップ算出 ───

function achievement(actual: number | null, target: number, unit: KpiUnit): number | null {
  if (actual === null || target === 0) return null;
  // 解約率は「低いほど良い」反転計算
  if (unit === 'percent' && /churn|解約/.test('')) return null;
  return actual / target;
}

function statusFromAchievement(a: number | null, invert = false): KpiGap['status'] {
  if (a === null) return 'unknown';
  const score = invert ? (1 / Math.max(a, 0.01)) : a;
  if (score >= 1) return 'green';
  if (score >= 0.8) return 'amber';
  return 'red';
}

/** 全 KPI のギャップを集計 */
export async function computeKpiGaps(): Promise<KpiGap[]> {
  const metrics = await fetchStripeMetrics();
  const localActions = getLocalActionCount();
  const dauMau = getDauMauRatio();
  const asOf = new Date().toISOString();

  const actuals: Record<string, KpiActual> = {
    new_users_monthly:   { id: 'new_users_monthly',   value: localActions > 0 ? Math.max(1, Math.round(localActions / 5)) : 0, source: 'local',    asOf },
    new_paid_monthly:    { id: 'new_paid_monthly',    value: metrics.ok ? metrics.paidCount : 0,                                source: 'stripe',   asOf },
    free_to_paid_rate:   { id: 'free_to_paid_rate',   value: null,                                                              source: 'unknown',  asOf },
    churn_rate_monthly:  { id: 'churn_rate_monthly',  value: metrics.churnRate30d !== null ? metrics.churnRate30d * 100 : null,  source: 'stripe',   asOf },
    dau_mau:             { id: 'dau_mau',             value: dauMau !== null ? dauMau * 100 : null,                              source: 'analytics', asOf },
    arpu_paid_jpy:       { id: 'arpu_paid_jpy',       value: metrics.ok && metrics.paidCount > 0 ? Math.round(metrics.mrrJpy / metrics.paidCount) : 0, source: 'stripe', asOf },
    ltv_cac:             { id: 'ltv_cac',             value: null,                                                              source: 'unknown',  asOf },
    gross_margin:        { id: 'gross_margin',        value: null,                                                              source: 'unknown',  asOf },
    nps:                 { id: 'nps',                 value: null,                                                              source: 'unknown',  asOf },
  };

  return KPI_TARGETS.map(t => {
    const actual = actuals[t.id] ?? { id: t.id, value: null, source: 'unknown' as const, asOf };
    const invertedKpi = t.id === 'churn_rate_monthly';
    const ach = achievement(actual.value, t.target, t.unit);
    const status = statusFromAchievement(ach, invertedKpi);
    return { target: t, actual, achievement: ach, status };
  });
}

/** MRR 目標 vs 実績の単独カード用 */
export async function computeMrrGap(): Promise<KpiGap> {
  const metrics = await fetchStripeMetrics();
  const asOf = new Date().toISOString();
  const actual = metrics.ok ? metrics.mrrJpy : 0;
  const target: KpiTarget = {
    id: 'mrr_current', category: '収益', label: 'MRR (月次経常収益)',
    target: CURRENT_MRR_TARGET_JPY, unit: 'jpy', horizon: '5 月末 暫定目標',
  };
  const ach = actual / target.target;
  return {
    target,
    actual: { id: 'mrr_current', value: actual, source: 'stripe', asOf },
    achievement: ach,
    status: ach >= 1 ? 'green' : ach >= 0.8 ? 'amber' : 'red',
  };
}

// ─── フォーマット ───
export function formatKpiValue(value: number | null, unit: KpiUnit): string {
  if (value === null || Number.isNaN(value)) return '—';
  switch (unit) {
    case 'jpy':     return `¥${value.toLocaleString('ja-JP')}`;
    case 'percent': return `${value.toFixed(value < 10 ? 1 : 0)}%`;
    case 'ratio':   return `${value.toFixed(2)}x`;
    case 'count':   return value.toLocaleString('ja-JP');
  }
}

/** 06_リスク_KPI_ロードマップ.md を取り出す (UI 連動用) */
export function getKpiDoc() {
  return BUSINESS_PLAN_DOCS.find(d => /KPI|リスク/.test(d.file)) ?? null;
}
