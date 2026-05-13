// ============================================================
// /api/stripe/checkout — Stripe Checkout Session 作成
// POST { plan, brand, email? }
// env STRIPE_SECRET_KEY 未設定 → 503 STRIPE_NOT_CONFIGURED
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

function getPriceId(plan: string, brand: string, cycle: string): string | undefined {
  const key = `${brand}_${plan}_${cycle}`;
  const map: Record<string, string | undefined> = {
    // ─── 月額 (monthly) ───
    iris_lite_monthly:       process.env.STRIPE_PRICE_LITE,
    iris_standard_monthly:   process.env.STRIPE_PRICE_STANDARD,
    iris_pro_monthly:        process.env.STRIPE_PRICE_PRO,
    iris_studio_monthly:     process.env.STRIPE_PRICE_STUDIO,
    prism_lite_monthly:      process.env.STRIPE_PRICE_PRISM_STARTER,
    prism_standard_monthly:  process.env.STRIPE_PRICE_PRISM_STANDARD,
    prism_pro_monthly:       process.env.STRIPE_PRICE_PRISM_EXCLUSIVE,
    // ─── 年額 (yearly = 月額 × 10 で 2 ヶ月分お得) ───
    iris_lite_yearly:        process.env.STRIPE_PRICE_LITE_YEARLY,
    iris_standard_yearly:    process.env.STRIPE_PRICE_STANDARD_YEARLY,
    iris_pro_yearly:         process.env.STRIPE_PRICE_PRO_YEARLY,
    iris_studio_yearly:      process.env.STRIPE_PRICE_STUDIO_YEARLY,
    prism_lite_yearly:       process.env.STRIPE_PRICE_PRISM_STARTER_YEARLY,
    prism_standard_yearly:   process.env.STRIPE_PRICE_PRISM_STANDARD_YEARLY,
    prism_pro_yearly:        process.env.STRIPE_PRICE_PRISM_EXCLUSIVE_YEARLY,
  };
  return map[key];
}

function json(data: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: ch });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, ch);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503, ch);
  }

  let body: { plan?: string; brand?: string; email?: string; cycle?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, ch);
  }

  const { plan, brand, email } = body;
  const cycle = body.cycle === 'yearly' ? 'yearly' : 'monthly';
  if (!plan || !brand) {
    return json({ error: 'Missing plan or brand' }, 400, ch);
  }

  const priceId = getPriceId(plan, brand, cycle);
  if (!priceId) {
    return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503, ch);
  }

  const origin = req.headers.get('origin') || 'https://core-prism-app.vercel.app';
  const successUrl = `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}&brand=${brand}`;
  const cancelUrl = brand === 'iris' ? `${origin}/iris` : origin;

  const params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);
  params.append('metadata[plan]', plan);
  params.append('metadata[brand]', brand);
  params.append('metadata[cycle]', cycle);
  if (email) params.append('customer_email', email);

  let stripeResp: Response;
  try {
    stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  } catch (e: any) {
    return json({ error: `Stripe unreachable: ${e.message}` }, 502, ch);
  }

  const session = await stripeResp.json() as { url?: string; error?: { message?: string } };
  if (!stripeResp.ok) {
    return json({ error: session.error?.message || 'Stripe error' }, 500, ch);
  }

  return json({ url: session.url }, 200, ch);
}
