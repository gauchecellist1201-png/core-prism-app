// api/billing/lookup.ts — Stripe Checkout Session 照会
// GET ?session_id=cs_test_xxx
// → { plan, status, customer_email, subscription_id, current_period_end }

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503);

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) return json({ error: 'session_id required' }, 400);

  // Checkout Session を expand して subscription を取得
  const expandParams = new URLSearchParams();
  expandParams.set('expand[]', 'line_items');
  expandParams.set('expand[]', 'subscription');

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}?${expandParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    },
  );

  const session = await res.json() as {
    metadata?: { plan?: string; brand?: string };
    payment_status?: string;
    status?: string;
    customer_email?: string;
    subscription?: {
      id?: string;
      status?: string;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
    } | null;
    error?: { message: string };
  };

  if (!res.ok) return json({ error: session.error?.message ?? 'Stripe error' }, res.status);

  const sub = session.subscription;
  return json({
    plan: session.metadata?.plan ?? 'free',
    brand: session.metadata?.brand ?? 'prism',
    status: sub?.status ?? session.payment_status ?? 'unknown',
    customer_email: session.customer_email ?? null,
    subscription_id: sub?.id ?? null,
    current_period_end: sub?.current_period_end ?? null,
    cancel_at_period_end: sub?.cancel_at_period_end ?? false,
  });
}
