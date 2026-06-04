// ============================================================
// /api/master/cashflow-forecast — オーナー専用 資金繰り 60 日予測
//
// オーナー指示 (2026-06-04 第 40 波 EEEEEE):
//   現在の MRR と 固定費 (CASH_FIXED_MONTHLY env) から、
//   60 日先 まで 残高の推移を 1 日刻みで返す。
//   ?balance=N で 現在残高 を 上書き可 (既定 CASH_CURRENT_BALANCE env、なければ 0)。
//
// GET (x-master-key)
//   レスポンス:
//   {
//     asOf, mrrJpy, fixedMonthlyJpy, openingBalanceJpy,
//     dailyNet,         // 平均: (mrr - fixed) / 30
//     series: [{ date, balance, dayIn, dayOut }, ...],  // 60 件
//     zeroDate?, daysUntilZero?
//   }
// ============================================================

import Stripe from 'stripe';
import { logMasterAudit } from '../_lib/masterAudit';

export const config = { runtime: 'edge' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

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

async function calcMrr(stripe: Stripe): Promise<number> {
  let mrr = 0;
  let starting_after: string | undefined = undefined;
  let safety = 0;
  while (safety++ < 100) {
    const page = await stripe.subscriptions.list({
      status: 'active', limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });
    for (const s of page.data) mrr += monthlyValueJpy(s);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return mrr;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const url = new URL(req.url);
  const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
  if (key !== 'GAUCHE2026') {
    await logMasterAudit(req, '/api/master/cashflow-forecast', 'forbidden');
    return json({ error: 'forbidden' }, 403);
  }
  await logMasterAudit(req, '/api/master/cashflow-forecast', 'ok');

  // 入力 (env / クエリ)
  const fixedMonthlyJpy = Number(process.env.CASH_FIXED_MONTHLY || '0');
  const balanceParam = url.searchParams.get('balance');
  const openingBalanceJpy = Number(
    balanceParam !== null ? balanceParam : (process.env.CASH_CURRENT_BALANCE || '0')
  );

  // MRR (Stripe)
  let mrrJpy = 0;
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
      mrrJpy = await calcMrr(stripe);
    } catch { mrrJpy = 0; }
  }

  // 1 日 純増 (営業日無視で 月割り)
  const dailyIn = Math.round(mrrJpy / 30);
  const dailyOut = Math.round(fixedMonthlyJpy / 30);
  const dailyNet = dailyIn - dailyOut;

  // 60 日 シリーズ
  const series: Array<{ date: string; balance: number; dayIn: number; dayOut: number }> = [];
  let balance = openingBalanceJpy;
  let zeroDate: string | undefined;
  let daysUntilZero: number | undefined;
  for (let i = 0; i <= 60; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    if (i > 0) balance += dailyNet;
    if (balance <= 0 && zeroDate === undefined) {
      zeroDate = date;
      daysUntilZero = i;
    }
    series.push({ date, balance: Math.round(balance), dayIn: dailyIn, dayOut: dailyOut });
  }

  return json({
    ok: true,
    asOf: new Date().toISOString(),
    mrrJpy,
    fixedMonthlyJpy,
    openingBalanceJpy,
    dailyNet,
    dailyIn,
    dailyOut,
    series,
    zeroDate,
    daysUntilZero,
    note: 'MRR は active subscription を 月額換算 で集計。固定費は env CASH_FIXED_MONTHLY (税込目安)。' +
          '残高 は ?balance= or env CASH_CURRENT_BALANCE で 上書き可。',
  });
}
