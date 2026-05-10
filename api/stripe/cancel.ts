// ============================================================
// /api/stripe/cancel — サブスクリプション解約 (期間末に)
// POST { subscription_id }
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

  let body: { subscription_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, ch);
  }

  const { subscription_id } = body;
  if (!subscription_id) {
    return json({ error: 'Missing subscription_id' }, 400, ch);
  }

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
        body: 'cancel_at_period_end=true',
      },
    );
  } catch (e: any) {
    return json({ error: `Stripe unreachable: ${e.message}` }, 502, ch);
  }

  const result = await resp.json() as { cancel_at?: number; error?: { message?: string } };
  if (!resp.ok) {
    return json({ error: result.error?.message || 'Stripe error' }, 500, ch);
  }

  return json({ success: true, cancel_at: result.cancel_at ?? null }, 200, ch);
}
