// api/stripe/cancel.ts — サブスクリプション解約 (cancel_at_period_end)
// POST { subscription_id }

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

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503);

  let body: { subscription_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { subscription_id } = body;
  if (!subscription_id) return json({ error: 'subscription_id required' }, 400);

  const params = new URLSearchParams();
  params.set('cancel_at_period_end', 'true');

  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscription_id}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const sub = await res.json() as { id?: string; cancel_at_period_end?: boolean; error?: { message: string } };
  if (!res.ok) return json({ error: sub.error?.message ?? 'Stripe error' }, res.status);

  return json({ subscription_id: sub.id, cancel_at_period_end: sub.cancel_at_period_end });
}
