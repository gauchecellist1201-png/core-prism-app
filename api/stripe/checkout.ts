// api/stripe/checkout.ts — Stripe Checkout Session 作成
// POST { plan, brand, email? }
// env: STRIPE_SECRET_KEY, STRIPE_PRICE_LITE etc.
// 未設定時: 503 + 'STRIPE_NOT_CONFIGURED' → クライアントが test mode にフォールバック

import Stripe from 'stripe';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function getPriceId(brand: string, plan: string): string | undefined {
  const map: Record<string, Record<string, string | undefined>> = {
    iris: {
      lite:     process.env.STRIPE_PRICE_LITE,
      standard: process.env.STRIPE_PRICE_STANDARD,
      pro:      process.env.STRIPE_PRICE_PRO,
      studio:   process.env.STRIPE_PRICE_STUDIO,
    },
    prism: {
      lite:     process.env.STRIPE_PRICE_PRISM_STARTER,
      standard: process.env.STRIPE_PRICE_PRISM_STANDARD,
      pro:      process.env.STRIPE_PRICE_PRISM_EXCLUSIVE,
    },
  };
  return map[brand]?.[plan];
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503);

  let body: { plan: string; brand: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { plan, brand, email } = body;
  const priceId = getPriceId(brand, plan);
  if (!priceId) return json({ error: 'PRICE_NOT_CONFIGURED', plan, brand }, 503);

  const origin = req.headers.get('origin') || 'https://core-prism-app.vercel.app';

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}&brand=${brand}`,
      cancel_url: `${origin}/${brand === 'iris' ? 'iris' : ''}`,
      customer_email: email || undefined,
      metadata: { plan, brand },
    });
    return json({ url: session.url });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}
