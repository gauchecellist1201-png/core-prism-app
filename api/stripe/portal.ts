// ============================================================
// /api/stripe/portal — Stripe Billing Portal セッションを発行
// POST { customer_id, return_url? }
// 顧客側でアップグレード/ダウングレード/解約/明細/カード変更すべて可
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

  let body: { customer_id?: string; return_url?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, ch);
  }

  const { customer_id, return_url } = body;
  if (!customer_id) return json({ error: 'Missing customer_id' }, 400, ch);

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
