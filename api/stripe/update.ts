// ============================================================
// /api/stripe/update — サブスクリプションのプラン変更
// POST { subscription_id, new_price_id, proration?: 'create_prorations'|'none' }
// 既存 subscription_item を新 price に差し替える (即時 prorated)
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function getPriceId(plan: string, brand: string): string | undefined {
  const map: Record<string, string | undefined> = {
    iris_lite:      process.env.STRIPE_PRICE_LITE,
    iris_standard:  process.env.STRIPE_PRICE_STANDARD,
    iris_pro:       process.env.STRIPE_PRICE_PRO,
    iris_studio:    process.env.STRIPE_PRICE_STUDIO,
    prism_lite:     process.env.STRIPE_PRICE_PRISM_STARTER,
    prism_standard: process.env.STRIPE_PRICE_PRISM_STANDARD,
    prism_pro:      process.env.STRIPE_PRICE_PRISM_EXCLUSIVE,
    prism_studio:   process.env.STRIPE_PRICE_PRISM_STUDIO,
  };
  return map[`${brand}_${plan}`];
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503, ch);

  let body: { subscription_id?: string; plan?: string; brand?: string; proration?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, ch);
  }

  const { subscription_id, plan, brand, proration } = body;
  if (!subscription_id || !plan || !brand) {
    return json({ error: 'Missing subscription_id / plan / brand' }, 400, ch);
  }
  const newPriceId = getPriceId(plan, brand);
  if (!newPriceId) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503, ch);

  // 1) 既存 subscription を取得して item id を取り出す
  let sub: any;
  try {
    const r = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscription_id)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    sub = await r.json();
    if (!r.ok) return json({ error: sub.error?.message || 'sub fetch failed' }, 500, ch);
  } catch (e: any) {
    return json({ error: `Stripe unreachable: ${e.message}` }, 502, ch);
  }

  const itemId: string | undefined = sub?.items?.data?.[0]?.id;
  if (!itemId) return json({ error: 'subscription has no items' }, 500, ch);

  // 2) item の price を入れ替え
  const params = new URLSearchParams();
  params.append('items[0][id]', itemId);
  params.append('items[0][price]', newPriceId);
  params.append('proration_behavior', proration === 'none' ? 'none' : 'create_prorations');
  params.append('cancel_at_period_end', 'false'); // ダウングレード後も解約予約解除
  params.append('metadata[plan]', plan);
  params.append('metadata[brand]', brand);

  let resp: Response;
  try {
    resp = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscription_id)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
  } catch (e: any) {
    return json({ error: `Stripe unreachable: ${e.message}` }, 502, ch);
  }

  const result = await resp.json() as any;
  if (!resp.ok) return json({ error: result.error?.message || 'Stripe error' }, 500, ch);
  return json({
    success: true,
    plan,
    current_period_end: result.current_period_end ?? null,
    cancel_at_period_end: !!result.cancel_at_period_end,
  }, 200, ch);
}
