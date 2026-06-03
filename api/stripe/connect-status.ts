// ============================================================
// /api/stripe/connect-status — ユーザー自身の Connect Account の状況確認
//
// オーナー指示 (2026-06-04 第 15 波 GGG):
//   Iris クリエイターが Stripe Connect でつないだ「Connected Account」の
//   - charges_enabled / payouts_enabled / requirements / payout schedule
//   を 1 リクエストで取得 → UI で「いま振込可能ですか?」を即可視化。
//
// POST { stripe_user_key }   (rk_live_xxx or oauth access_token)
//   → 200: { connected, accountId, chargesEnabled, payoutsEnabled,
//            requirements: [...], defaultCurrency, country, businessProfile }
//
// セキュリティ:
//   - rk_live を body で受け取る (URL に乗せない / ログにも残さない)
//   - 失敗時はメッセージのみ返す (Stripe 側 raw を晒さない)
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
    'Vary': 'Origin',
  };
}

function json(data: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

interface StripeAccount {
  id?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  default_currency?: string;
  country?: string;
  details_submitted?: boolean;
  business_profile?: { name?: string; url?: string };
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    past_due?: string[];
    disabled_reason?: string | null;
    pending_verification?: string[];
  };
  settings?: {
    payouts?: {
      schedule?: { interval?: string; delay_days?: number };
    };
  };
}

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, ch);

  let body: { stripe_user_key?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400, ch); }

  const key = String(body.stripe_user_key || '').trim();
  if (!key.startsWith('sk_') && !key.startsWith('rk_') && !key.startsWith('ac_')) {
    return json({ error: 'invalid_key_format' }, 400, ch);
  }

  // Stripe API: /v1/account を Bearer で取得 → Connected Account の状況
  try {
    const res = await fetch('https://api.stripe.com/v1/account', {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      let msg = `Stripe ${res.status}`;
      try {
        const j = JSON.parse(t) as { error?: { message?: string; code?: string } };
        msg = j.error?.message || msg;
        // 一般的 ヒント
        if (j.error?.code === 'api_key_expired') msg = '鍵が失効しています。Stripe Connect で再連携してください。';
      } catch { /* */ }
      return json({ connected: false, error: msg }, 200, ch);
    }
    const a = await res.json() as StripeAccount;
    const requirements = a.requirements || {};
    const isLive = key.startsWith('sk_live') || key.startsWith('rk_live');
    return json({
      connected: true,
      accountId: a.id,
      mode: isLive ? 'live' : 'test',
      chargesEnabled: !!a.charges_enabled,
      payoutsEnabled: !!a.payouts_enabled,
      detailsSubmitted: !!a.details_submitted,
      defaultCurrency: (a.default_currency || '').toUpperCase(),
      country: a.country || '',
      businessProfile: a.business_profile || {},
      requirements: {
        currently_due: requirements.currently_due || [],
        eventually_due: requirements.eventually_due || [],
        past_due: requirements.past_due || [],
        pending_verification: requirements.pending_verification || [],
        disabled_reason: requirements.disabled_reason || null,
      },
      payoutSchedule: a.settings?.payouts?.schedule || null,
      /** UI 用 ヘルパー: 「いま振込可能か?」のひとこと判定 */
      readyToReceive: !!(a.charges_enabled && a.payouts_enabled),
    }, 200, ch);
  } catch (e) {
    return json({ connected: false, error: (e as Error).message?.slice(0, 200) || 'network_error' }, 200, ch);
  }
}
