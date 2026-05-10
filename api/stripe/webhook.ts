// api/stripe/webhook.ts — Stripe Webhook 受信 + 署名検証
// シンプル設計: signature verify + 200 のみ (KV なし)
// 将来的に checkout.session.completed でプラン更新等を追加可能

import Stripe from 'stripe';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !secretKey) {
    return new Response(JSON.stringify({ error: 'STRIPE_NOT_CONFIGURED' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = await req.text();

  try {
    const stripe = new Stripe(secretKey);
    stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
