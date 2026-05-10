// api/billing/lookup.ts — Stripe Checkout Session 詳細取得
// GET ?session_id=cs_test_xxx
// Response: { plan, status, customer_email, subscription_id, current_period_end }

import Stripe from 'stripe';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503);

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) return json({ error: 'session_id required' }, 400);

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const sub = session.subscription as Stripe.Subscription | null;

    return json({
      plan:              session.metadata?.plan || 'free',
      status:            sub?.status || 'incomplete',
      customer_email:    session.customer_email || '',
      subscription_id:   sub?.id || '',
      current_period_end: sub?.current_period_end || null,
    });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}
