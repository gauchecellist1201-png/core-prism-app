// ============================================================
// /api/stripe/sync — フロントが起動時に叩く: Stripe / webhook キャッシュと
// ローカル状態 (localStorage core_user) を 1 往復で同期。
// POST { subscription_id, customer_id? } →
//   { ok, status, plan, brand, current_period_end, cancel_at_period_end,
//     plan_expires_at, delinquent, downgrade_to_free }
// ・webhook が記録した state を最優先 (低レイテンシ)、無ければ Stripe へ問い合わせ
// ・downgrade_to_free が true ならフロントは plan='free' に降格
// ============================================================

import { readSubState } from './webhook';

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

function log(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}) {
  const line = { ts: new Date().toISOString(), svc: 'stripe-sync', level, event, ...fields };
  const out = JSON.stringify(line);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

interface StripeSubResp {
  id?: string;
  status?: string;
  customer?: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: { plan?: string; brand?: string };
  items?: { data?: Array<{ price?: { id?: string; metadata?: { plan?: string; brand?: string } } }> };
  error?: { message?: string; code?: string };
}

/** Stripe status → フロント挙動 */
function deriveFlags(status: string, cpe: number | null) {
  const downgrade =
    status === 'canceled' ||
    status === 'unpaid' ||
    status === 'incomplete_expired';
  // past_due は猶予中: 期限後にもう一度同期されたら下げる判定
  const expired = !!cpe && cpe * 1000 < Date.now();
  const downgrade_to_free = downgrade || (status === 'past_due' && expired);
  const delinquent = status === 'past_due' || status === 'unpaid';
  return { downgrade_to_free, delinquent };
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);

  let body: { subscription_id?: string; customer_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, ch);
  }

  const subId = body.subscription_id;
  if (!subId) return json({ error: 'Missing subscription_id' }, 400, ch);

  // 1) webhook キャッシュ (新鮮なら即返す)
  const cached = readSubState(subId);
  const fresh = cached && Date.now() - cached.updated_at < 60 * 1000;
  if (cached && fresh) {
    const flags = deriveFlags(cached.status, cached.current_period_end);
    log('info', 'sync_cache_hit', { sub_id: subId, status: cached.status });
    return json({
      ok: true,
      source: 'cache',
      status: cached.status,
      plan: cached.plan,
      brand: cached.brand,
      current_period_end: cached.current_period_end,
      plan_expires_at: cached.current_period_end ? new Date(cached.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: cached.cancel_at_period_end,
      ...flags,
    }, 200, ch);
  }

  // 2) Stripe へ問い合わせ
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    log('warn', 'env_missing', { field: 'STRIPE_SECRET_KEY' });
    return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503, ch);
  }

  let resp: Response;
  try {
    resp = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}?expand[]=items.data.price`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
  } catch (e: any) {
    log('error', 'stripe_unreachable', { sub_id: subId, msg: e?.message });
    return json({ error: `Stripe unreachable: ${e?.message}` }, 502, ch);
  }

  const sub = await resp.json() as StripeSubResp;
  if (!resp.ok) {
    // 解約済み等で 404 のときも downgrade_to_free を返してフロントを free に戻す
    if (resp.status === 404) {
      log('info', 'sub_not_found', { sub_id: subId });
      return json({
        ok: true,
        source: 'stripe',
        status: 'canceled',
        plan: null,
        brand: null,
        current_period_end: null,
        plan_expires_at: null,
        cancel_at_period_end: false,
        downgrade_to_free: true,
        delinquent: false,
      }, 200, ch);
    }
    log('error', 'stripe_error', { sub_id: subId, http: resp.status, msg: sub.error?.message });
    return json({ error: sub.error?.message || 'Stripe error', http: resp.status }, 500, ch);
  }

  const status = sub.status || 'unknown';
  const cpe = sub.current_period_end ?? null;
  const planMeta = sub.metadata?.plan
    || sub.items?.data?.[0]?.price?.metadata?.plan
    || null;
  const brandMeta = sub.metadata?.brand
    || sub.items?.data?.[0]?.price?.metadata?.brand
    || null;

  const flags = deriveFlags(status, cpe);
  log('info', 'sync_stripe', { sub_id: subId, status, plan: planMeta, brand: brandMeta, cpe });

  return json({
    ok: true,
    source: 'stripe',
    status,
    plan: planMeta,
    brand: brandMeta,
    current_period_end: cpe,
    plan_expires_at: cpe ? new Date(cpe * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    ...flags,
  }, 200, ch);
}
