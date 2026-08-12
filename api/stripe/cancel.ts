// ============================================================
// /api/stripe/cancel — サブスクリプション解約 (期間末に)
// POST { subscription_id?, customer_id? }
//
// 2026-08-12: subscription_id が無いお客様でも解約できるようにした。
//   api/billing/lookup.ts は subscription_id: null を返しうるので、
//   実際にお金を払っているのに手元に subscription_id が無い人が存在する。
//   その人が解約できないと、フロントが「たぶん成功した」を出すしかなくなる
//   (競合5社中4社が★1を集めているのがまさにこれ)。customer_id から引き直す。
// あわせて、Stripe が 200 を返しただけで成功と言わず、
//   cancel_at_period_end が本当に true になったかを確かめてから成功を返す。
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

  let body: { subscription_id?: string; customer_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, ch);
  }

  const { customer_id } = body;
  let subscription_id = body.subscription_id;

  // subscription_id が手元に無い人は customer_id から引き直す。
  // (お金は払っているのに解約できない人を作らないため)
  if (!subscription_id) {
    if (!customer_id) {
      return json({ error: 'Missing subscription_id', code: 'NO_SUBSCRIPTION_REF' }, 400, ch);
    }
    let listResp: Response;
    try {
      listResp = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customer_id)}&status=all&limit=10`,
        { headers: { Authorization: `Bearer ${secretKey}` } },
      );
    } catch (e: any) {
      return json({ error: `Stripe unreachable: ${e.message}`, code: 'STRIPE_UNREACHABLE' }, 502, ch);
    }
    const list = await listResp.json() as {
      data?: { id: string; status: string; cancel_at_period_end?: boolean }[];
      error?: { message?: string };
    };
    if (!listResp.ok) {
      return json({ error: list.error?.message || 'Stripe error', code: 'STRIPE_ERROR' }, 500, ch);
    }
    const live = (list.data || []).filter(s => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due');
    if (live.length === 0) {
      // 止めるものが実際に無い＝ここは「解約できた」ではなく「もともと課金されていない」
      const alreadyCanceled = (list.data || []).some(s => s.cancel_at_period_end || s.status === 'canceled');
      return json({
        error: alreadyCanceled ? '既に解約済みです' : '課金中のご契約が見つかりませんでした',
        code: alreadyCanceled ? 'ALREADY_CANCELED' : 'NO_ACTIVE_SUBSCRIPTION',
      }, 404, ch);
    }
    subscription_id = live[0].id;
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
    return json({ error: `Stripe unreachable: ${e.message}`, code: 'STRIPE_UNREACHABLE' }, 502, ch);
  }

  const result = await resp.json() as {
    cancel_at?: number; cancel_at_period_end?: boolean; error?: { message?: string };
  };
  if (!resp.ok) {
    return json({ error: result.error?.message || 'Stripe error', code: 'STRIPE_ERROR' }, 500, ch);
  }
  // 200 が返っただけでは成功と言わない。実際に期間末解約が立ったかを見る
  if (result.cancel_at_period_end !== true) {
    return json({
      error: '解約の予約がStripe側で確認できませんでした',
      code: 'NOT_CONFIRMED',
    }, 502, ch);
  }

  return json({
    success: true,
    subscription_id,
    cancel_at: result.cancel_at ?? null,
  }, 200, ch);
}
