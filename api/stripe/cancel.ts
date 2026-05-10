// api/stripe/cancel.ts — サブスクリプション解約 (期末解約)
// POST { subscription_id }
// → subscriptions.update(id, { cancel_at_period_end: true })

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503);

  let body: { subscription_id: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { subscription_id } = body;
  if (!subscription_id) return json({ error: 'subscription_id required' }, 400);

  try {
    const stripe = new Stripe(secretKey);
    const sub = await stripe.subscriptions.update(subscription_id, {
      cancel_at_period_end: true,
    });
    return json({
      cancelled:          true,
      cancel_at:          sub.cancel_at,
      current_period_end: sub.current_period_end,
    });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}
