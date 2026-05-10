// api/stripe/checkout.ts — Stripe Checkout セッション作成 (Vercel Edge Function)
// POST { plan, brand, email?, mode? }
// → 成功: { url: session.url }
// → env 未設定: 503 + { error: 'STRIPE_NOT_CONFIGURED' }

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// プラン × ブランド → 環境変数キー
function priceEnvKey(plan: string, brand: string): string {
  if (brand === 'prism') {
    const map: Record<string, string> = {
      lite: 'STRIPE_PRICE_PRISM_STARTER',
      standard: 'STRIPE_PRICE_PRISM_STANDARD',
      pro: 'STRIPE_PRICE_PRISM_EXCLUSIVE',
    };
    return map[plan] ?? '';
  }
  // iris
  const map: Record<string, string> = {
    lite: 'STRIPE_PRICE_LITE',
    standard: 'STRIPE_PRICE_STANDARD',
    pro: 'STRIPE_PRICE_PRO',
    studio: 'STRIPE_PRICE_STUDIO',
  };
  return map[plan] ?? '';
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503);

  let body: { plan?: string; brand?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { plan = 'lite', brand = 'prism', email } = body;

  if (plan === 'free') return json({ error: 'Free plan has no checkout' }, 400);

  const envKey = priceEnvKey(plan, brand);
  if (!envKey) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503);

  const priceId = process.env[envKey];
  if (!priceId) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503);

  // success_url に session_id を埋め込む ({CHECKOUT_SESSION_ID} は Stripe が自動置換)
  const origin = new URL(req.url).origin;
  const successUrl = `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}&brand=${brand}`;
  const cancelUrl = `${origin}/${brand === 'iris' ? 'iris' : ''}`;

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('metadata[plan]', plan);
  params.set('metadata[brand]', brand);
  if (email) params.set('customer_email', email);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = await res.json() as { url?: string; error?: { message: string } };
  if (!res.ok) return json({ error: session.error?.message ?? 'Stripe error' }, res.status);

  return json({ url: session.url });
}
