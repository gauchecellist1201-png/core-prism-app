// ============================================================
// /api/stripe/webhook — Stripe Webhook 受信 (署名検証 + 200)
// KV 永続化なし: success_url に session_id を載せてクライアントが取りに来る
// ============================================================

export const config = { runtime: 'edge' };

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const v1 = parts.find(p => p.startsWith('v1='))?.slice(3);
  if (!timestamp || !v1) return false;

  // 5 分以上古いリクエストを拒否
  const ts = parseInt(timestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return expected === v1;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // env 未設定でも 200 を返す (本番前にテストできるよう)
    return new Response(JSON.stringify({ received: true, warning: 'STRIPE_WEBHOOK_SECRET not set' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sigHeader = req.headers.get('stripe-signature') || '';
  const rawBody = await req.text();

  const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // イベントを受け取るが永続化は行わない
  // クライアントは success_url の session_id で /api/billing/lookup を呼ぶ
  let event: { type?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    event = {};
  }

  console.log('[stripe/webhook] received:', event.type || 'unknown');

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
