// ============================================================
// /api/master/revenue-monthly — オーナー専用 月次売上 + MRR + 解約率
//
// オーナー指示 (2026-06-04 第 33 波 JJJJJ):
//   過去 12 ヶ月 を Stripe Charges + Subscriptions から計算。
//   MRR = 現在 active なサブスクの合計月額 (年契約は ÷ 12)
//   解約率 = 当月 canceled / 月初 active
//
// GET (x-master-key: GAUCHE2026 必須)
//   レスポンス:
//   {
//     months: [{ month: '2025-07', revenueJpy: 1234, charges: 56 }, ...],
//     mrrJpy: 234500,
//     mrrSeriesJpy: [{ month, mrr }, ...],   // 過去 12 ヶ月 MRR スナップ
//     churn: { thisMonth: { canceled: N, baseAtStart: M, ratePct: 5.4 } },
//     asOf
//   }
// ============================================================

import Stripe from 'stripe';

export const config = { runtime: 'edge' };

interface MonthRow { month: string; revenueJpy: number; charges: number; }
interface MrrRow { month: string; mrr: number; }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function ymUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthRange(monthsBack: number): Array<{ start: Date; end: Date; ym: string }> {
  const out = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1, 0, 0, 0));
    out.push({ start, end, ym: ymUtc(start) });
  }
  return out;
}

async function sumChargesByMonth(stripe: Stripe, months: ReturnType<typeof monthRange>): Promise<MonthRow[]> {
  // 1 度の range で全部取得 (from = 最古, to = now) して クライアント側で集計
  const from = months[0].start;
  const to = months[months.length - 1].end;
  const map: Record<string, MonthRow> = {};
  for (const m of months) map[m.ym] = { month: m.ym, revenueJpy: 0, charges: 0 };
  let starting_after: string | undefined = undefined;
  let safety = 0;
  while (safety++ < 200) {
    const page: Stripe.Response<Stripe.ApiList<Stripe.Charge>> = await stripe.charges.list({
      created: { gte: Math.floor(from.getTime() / 1000), lte: Math.floor(to.getTime() / 1000) },
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });
    for (const c of page.data) {
      if (c.status !== 'succeeded') continue;
      if (c.currency !== 'jpy') continue;
      const d = new Date(c.created * 1000);
      const ym = ymUtc(d);
      if (map[ym]) {
        map[ym].revenueJpy += c.amount;
        map[ym].charges += 1;
      }
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return months.map((m) => map[m.ym]);
}

/** サブスクの 「月額換算」 (年契約は 12 で割る、税抜) */
function monthlyValueJpy(s: Stripe.Subscription): number {
  let sum = 0;
  for (const item of s.items.data) {
    const p = item.price;
    if (!p || p.currency !== 'jpy') continue;
    const interval = p.recurring?.interval;
    const intervalCount = p.recurring?.interval_count || 1;
    const unit = p.unit_amount || 0;
    const qty = item.quantity || 1;
    let perMonth = 0;
    if (interval === 'month') perMonth = (unit * qty) / intervalCount;
    else if (interval === 'year') perMonth = (unit * qty) / (12 * intervalCount);
    else if (interval === 'week') perMonth = (unit * qty) * 4.345 / intervalCount;
    else if (interval === 'day') perMonth = (unit * qty) * 30 / intervalCount;
    sum += perMonth;
  }
  return Math.round(sum);
}

async function calcMrr(stripe: Stripe): Promise<{ mrr: number; activeCount: number }> {
  let mrr = 0;
  let activeCount = 0;
  let starting_after: string | undefined = undefined;
  let safety = 0;
  while (safety++ < 200) {
    const page: Stripe.Response<Stripe.ApiList<Stripe.Subscription>> = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });
    for (const s of page.data) {
      mrr += monthlyValueJpy(s);
      activeCount += 1;
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return { mrr, activeCount };
}

/** 当月 解約率 — 今月 1 日 0 時 から 今 までに canceled に遷移した サブスク 数 / 月初 active 数 */
async function calcChurnThisMonth(stripe: Stripe, monthStart: Date): Promise<{ canceled: number; baseAtStart: number; ratePct: number }> {
  // canceled_at >= monthStart の subscription を 集計
  let canceled = 0;
  let starting_after: string | undefined = undefined;
  let safety = 0;
  while (safety++ < 100) {
    const page: Stripe.Response<Stripe.ApiList<Stripe.Subscription>> = await stripe.subscriptions.list({
      status: 'canceled',
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });
    for (const s of page.data) {
      const ts = (s.canceled_at || s.ended_at || 0) * 1000;
      if (ts >= monthStart.getTime()) canceled += 1;
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  // 月初 active = active 現在 + 当月 canceled (簡易近似)
  // 厳密には スナップショットが必要だが、Stripe 標準API では取れないため 近似
  const activeNow = await stripe.subscriptions.list({ status: 'active', limit: 1 });
  // total は API では取れないので、再度 全件カウント (上で既に取った値を使う)
  const baseAtStart = canceled + (activeNow as any).data?.length;
  // baseAtStart を 正確に取り直す
  let activeCount = 0;
  let sa: string | undefined = undefined;
  let s2 = 0;
  while (s2++ < 100) {
    const page: Stripe.Response<Stripe.ApiList<Stripe.Subscription>> = await stripe.subscriptions.list({
      status: 'active', limit: 100, ...(sa ? { starting_after: sa } : {}),
    });
    activeCount += page.data.length;
    if (!page.has_more) break;
    sa = page.data[page.data.length - 1].id;
  }
  const base = canceled + activeCount;
  const ratePct = base > 0 ? Math.round((canceled / base) * 1000) / 10 : 0;
  return { canceled, baseAtStart: base, ratePct };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const url = new URL(req.url);
  const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
  if (key !== 'GAUCHE2026') return json({ error: 'forbidden' }, 403);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: 'STRIPE_SECRET_KEY 未設定' }, 503);
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  try {
    const months = monthRange(12);
    const [monthRows, mrrNow, churn] = await Promise.all([
      sumChargesByMonth(stripe, months),
      calcMrr(stripe),
      calcChurnThisMonth(stripe, months[months.length - 1].start),
    ]);
    // MRR スナップショット系列 は Stripe API 標準では取れないため、現在 MRR を 12 ヶ月最後にだけ入れる
    // 簡易: 過去は 月次売上 ≒ MRR と近似 (年額契約 混在で 誤差あり) — 注意書き 付き
    const mrrSeries: MrrRow[] = monthRows.map((r) => ({ month: r.month, mrr: r.revenueJpy }));
    mrrSeries[mrrSeries.length - 1] = { month: months[months.length - 1].ym, mrr: mrrNow.mrr };

    return json({
      asOf: new Date().toISOString(),
      months: monthRows,
      mrrJpy: mrrNow.mrr,
      mrrSeriesJpy: mrrSeries,
      activeSubscriptions: mrrNow.activeCount,
      churn: { thisMonth: churn },
      note: 'MRR 系列は 過去 11 ヶ月分は 月次売上 で近似。最新月のみ active subscriptions から正確算出。',
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}
