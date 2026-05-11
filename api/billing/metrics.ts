// ============================================================
// /api/billing/metrics — Stripe 全体メトリクス (MRR / ARR / 有料数 / Churn)
// GET → { paidCount, mrrJpy, arrJpy, churnRate30d, asOf }
// セキュリティ: STRIPE_SECRET_KEY が無ければ 503。
// 公開エンドポイントだが Stripe 集計値のみ返すので個人情報は含まない。
// ============================================================

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

interface StripeSubscriptionItem {
  price?: { unit_amount?: number; currency?: string; recurring?: { interval?: string; interval_count?: number } };
  quantity?: number;
}
interface StripeSubscription {
  id: string;
  status: string;
  canceled_at?: number | null;
  current_period_start?: number;
  items: { data: StripeSubscriptionItem[] };
}
interface StripeList<T> { data: T[]; has_more: boolean; }

function monthlyAmountJpy(sub: StripeSubscription): number {
  let total = 0;
  for (const it of sub.items.data) {
    const amount = it.price?.unit_amount || 0;
    const qty = it.quantity || 1;
    const interval = it.price?.recurring?.interval || 'month';
    const intervalCount = it.price?.recurring?.interval_count || 1;
    const currency = (it.price?.currency || 'jpy').toLowerCase();
    // JPY は最小単位がそのまま円。それ以外は概算スキップ (将来為替対応)。
    if (currency !== 'jpy') continue;
    let monthly = amount * qty;
    switch (interval) {
      case 'day':   monthly = (amount * qty * 30) / intervalCount; break;
      case 'week':  monthly = (amount * qty * 4.345) / intervalCount; break;
      case 'month': monthly = (amount * qty) / intervalCount; break;
      case 'year':  monthly = (amount * qty) / (12 * intervalCount); break;
    }
    total += monthly;
  }
  return Math.round(total);
}

async function listAll(secretKey: string, params: Record<string, string>): Promise<StripeSubscription[]> {
  const out: StripeSubscription[] = [];
  let startingAfter: string | undefined;
  // 安全のため最大 5 ページ (500 件) まで
  for (let i = 0; i < 5; i++) {
    const sp = new URLSearchParams({ limit: '100', ...params });
    if (startingAfter) sp.set('starting_after', startingAfter);
    const resp = await fetch(`https://api.stripe.com/v1/subscriptions?${sp.toString()}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!resp.ok) throw new Error(`Stripe ${resp.status}`);
    const j = await resp.json() as StripeList<StripeSubscription>;
    out.push(...j.data);
    if (!j.has_more || j.data.length === 0) break;
    startingAfter = j.data[j.data.length - 1].id;
  }
  return out;
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, ch);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return json({
      error: 'STRIPE_NOT_CONFIGURED',
      paidCount: 0, mrrJpy: 0, arrJpy: 0, churnRate30d: null,
      asOf: new Date().toISOString(),
    }, 503, ch);
  }

  try {
    const active = await listAll(secretKey, { status: 'active' });
    const trialing = await listAll(secretKey, { status: 'trialing' });
    const canceled = await listAll(secretKey, { status: 'canceled' });

    const paidCount = active.length;
    const trialCount = trialing.length;
    const mrrJpy = active.reduce((sum, s) => sum + monthlyAmountJpy(s), 0);
    const arrJpy = mrrJpy * 12;

    // 過去 30 日の解約率: canceled_at が直近 30 日内 / (active + canceled 直近 30 日)
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;
    const recentlyCanceled = canceled.filter(s => (s.canceled_at || 0) >= thirtyDaysAgo).length;
    const baseForChurn = paidCount + recentlyCanceled;
    const churnRate30d = baseForChurn > 0 ? recentlyCanceled / baseForChurn : 0;

    return json({
      paidCount,
      trialCount,
      mrrJpy,
      arrJpy,
      churnRate30d,
      asOf: new Date().toISOString(),
    }, 200, { ...ch, 'Cache-Control': 'public, s-maxage=300' });
  } catch (e: any) {
    return json({ error: `Stripe metrics fetch failed: ${e.message}` }, 502, ch);
  }
}
