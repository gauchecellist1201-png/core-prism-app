// ============================================================
// /api/billing/lookup — Stripe セッション情報照会
// GET ?session_id=cs_xxx → { plan, brand, status, customer_email, subscription_id }
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, ch);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503, ch);
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) {
    return json({ error: 'Missing session_id' }, 400, ch);
  }

  let resp: Response;
  try {
    resp = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items&expand[]=subscription`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
  } catch (e: any) {
    return json({ error: `Stripe unreachable: ${e.message}` }, 502, ch);
  }

  const session = await resp.json() as {
    metadata?: { plan?: string; brand?: string };
    customer_email?: string;
    customer_details?: { email?: string };
    subscription?: { id?: string; status?: string; current_period_end?: number } | string;
    error?: { message?: string };
  };

  if (!resp.ok) {
    return json({ error: session.error?.message || 'Session not found' }, 404, ch);
  }

  const sub = typeof session.subscription === 'object' ? session.subscription : null;

  return json({
    plan: session.metadata?.plan ?? null,
    brand: session.metadata?.brand ?? null,
    status: sub?.status ?? 'incomplete',
    customer_email: session.customer_email ?? session.customer_details?.email ?? null,
    subscription_id: sub?.id ?? (typeof session.subscription === 'string' ? session.subscription : null),
    current_period_end: sub?.current_period_end ?? null,
  }, 200, ch);
}
