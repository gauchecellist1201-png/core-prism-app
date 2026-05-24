// ============================================================
// /api/billing/portal-session — Stripe Customer Portal セッションを発行
// POST { customer_id?, return_url? } → { url }
//
// Day 2: 課金失敗時 (past_due / unpaid / incomplete) の救済 UX 用。
// StripeFailureBanner からこの endpoint を叩き、Stripe Billing Portal を開く。
// customer_id が無い場合は subscription_id から逆引きする (fallback)。
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
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503, ch);

  let body: { customer_id?: string; subscription_id?: string; return_url?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, ch);
  }

  let { customer_id } = body;
  const { subscription_id, return_url } = body;

  // customer_id が無ければ subscription_id から逆引き
  if (!customer_id && subscription_id) {
    try {
      const subResp = await fetch(
        `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscription_id)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } },
      );
      const subData = await subResp.json() as { customer?: string; error?: { message?: string } };
      if (subResp.ok && typeof subData.customer === 'string') {
        customer_id = subData.customer;
      } else if (!subResp.ok) {
        return json({ error: subData.error?.message || 'Subscription lookup failed' }, 404, ch);
      }
    } catch (e: any) {
      return json({ error: `Stripe unreachable: ${e.message}` }, 502, ch);
    }
  }

  if (!customer_id) return json({ error: 'Missing customer_id or subscription_id' }, 400, ch);

  const origin = req.headers.get('origin') || 'https://core-prism-app.vercel.app';
  const rUrl = return_url || `${origin}/`;

  const params = new URLSearchParams();
  params.append('customer', customer_id);
  params.append('return_url', rUrl);

  let resp: Response;
  try {
    resp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
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

  const result = await resp.json() as { url?: string; error?: { message?: string } };
  if (!resp.ok) return json({ error: result.error?.message || 'Stripe error' }, 500, ch);
  return json({ url: result.url }, 200, ch);
}
