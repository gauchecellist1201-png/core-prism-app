// ============================================================
// /api/stripe/diagnose — Stripe 接続状態の診断
// オーナー専用 (master key 認証)
//
// レスポンス:
// {
//   configured: bool,
//   secret_key_present: bool,
//   webhook_secret_present: bool,
//   prices: { env_key, present, valid?, unit_amount?, currency?, interval?, error? }[],
//   missing: string[],
//   invalid_prices: string[],
// }
// ============================================================

export const config = { runtime: 'edge' };

const MASTER_KEY = 'GAUCHE2026';

interface PriceCheckResult {
  env_key: string;
  label: string;
  brand: 'iris' | 'prism';
  plan: 'lite' | 'standard' | 'pro' | 'studio';
  cycle: 'monthly' | 'yearly';
  present: boolean;
  value_masked: string | null;
  valid?: boolean;
  unit_amount?: number;
  currency?: string;
  interval?: string;
  error?: string;
}

const PRICE_KEYS: Array<{
  env: string;
  label: string;
  brand: 'iris' | 'prism';
  plan: 'lite' | 'standard' | 'pro' | 'studio';
  cycle: 'monthly' | 'yearly';
}> = [
  // Iris monthly
  { env: 'STRIPE_PRICE_LITE',         label: 'Iris Lite (月額)',     brand: 'iris',  plan: 'lite',     cycle: 'monthly' },
  { env: 'STRIPE_PRICE_STANDARD',     label: 'Iris Standard (月額)', brand: 'iris',  plan: 'standard', cycle: 'monthly' },
  { env: 'STRIPE_PRICE_PRO',          label: 'Iris Pro (月額)',      brand: 'iris',  plan: 'pro',      cycle: 'monthly' },
  { env: 'STRIPE_PRICE_STUDIO',       label: 'Iris Studio (月額)',   brand: 'iris',  plan: 'studio',   cycle: 'monthly' },
  // Iris yearly
  { env: 'STRIPE_PRICE_LITE_YEARLY',     label: 'Iris Lite (年額)',     brand: 'iris',  plan: 'lite',     cycle: 'yearly' },
  { env: 'STRIPE_PRICE_STANDARD_YEARLY', label: 'Iris Standard (年額)', brand: 'iris',  plan: 'standard', cycle: 'yearly' },
  { env: 'STRIPE_PRICE_PRO_YEARLY',      label: 'Iris Pro (年額)',      brand: 'iris',  plan: 'pro',      cycle: 'yearly' },
  { env: 'STRIPE_PRICE_STUDIO_YEARLY',   label: 'Iris Studio (年額)',   brand: 'iris',  plan: 'studio',   cycle: 'yearly' },
  // Prism monthly
  { env: 'STRIPE_PRICE_PRISM_STARTER',   label: 'Prism Starter (月額)',   brand: 'prism', plan: 'lite',     cycle: 'monthly' },
  { env: 'STRIPE_PRICE_PRISM_STANDARD',  label: 'Prism Standard (月額)',  brand: 'prism', plan: 'standard', cycle: 'monthly' },
  { env: 'STRIPE_PRICE_PRISM_EXCLUSIVE', label: 'Prism Exclusive (月額)', brand: 'prism', plan: 'pro',      cycle: 'monthly' },
  { env: 'STRIPE_PRICE_PRISM_STUDIO',    label: 'Prism Studio (月額)',    brand: 'prism', plan: 'studio',   cycle: 'monthly' },
  // Prism yearly
  { env: 'STRIPE_PRICE_PRISM_STARTER_YEARLY',   label: 'Prism Starter (年額)',   brand: 'prism', plan: 'lite',     cycle: 'yearly' },
  { env: 'STRIPE_PRICE_PRISM_STANDARD_YEARLY',  label: 'Prism Standard (年額)',  brand: 'prism', plan: 'standard', cycle: 'yearly' },
  { env: 'STRIPE_PRICE_PRISM_EXCLUSIVE_YEARLY', label: 'Prism Exclusive (年額)', brand: 'prism', plan: 'pro',      cycle: 'yearly' },
  { env: 'STRIPE_PRICE_PRISM_STUDIO_YEARLY',    label: 'Prism Studio (年額)',    brand: 'prism', plan: 'studio',   cycle: 'yearly' },
];

function mask(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return '****';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function isAuthorized(req: Request): boolean {
  const hdr = req.headers.get('x-master-key');
  if (hdr === MASTER_KEY) return true;
  const url = new URL(req.url);
  return url.searchParams.get('master') === MASTER_KEY;
}

async function checkPrice(priceId: string, secretKey: string): Promise<{
  valid: boolean;
  unit_amount?: number;
  currency?: string;
  interval?: string;
  error?: string;
}> {
  try {
    const resp = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const data = await resp.json() as {
      id?: string;
      unit_amount?: number;
      currency?: string;
      recurring?: { interval?: string };
      error?: { message?: string };
    };
    if (!resp.ok) {
      return { valid: false, error: data.error?.message || `HTTP ${resp.status}` };
    }
    return {
      valid: true,
      unit_amount: data.unit_amount,
      currency: data.currency,
      interval: data.recurring?.interval,
    };
  } catch (e: any) {
    return { valid: false, error: e?.message || 'fetch failed' };
  }
}

export default async function handler(req: Request) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const prices: PriceCheckResult[] = [];
  const missing: string[] = [];
  const invalid_prices: string[] = [];

  for (const k of PRICE_KEYS) {
    const value = process.env[k.env];
    const present = !!value && value.length > 0 && !value.includes('price_...');
    const result: PriceCheckResult = {
      env_key: k.env,
      label: k.label,
      brand: k.brand,
      plan: k.plan,
      cycle: k.cycle,
      present,
      value_masked: mask(value),
    };

    if (!present) {
      missing.push(k.env);
    } else if (secretKey) {
      const check = await checkPrice(value as string, secretKey);
      result.valid = check.valid;
      result.unit_amount = check.unit_amount;
      result.currency = check.currency;
      result.interval = check.interval;
      result.error = check.error;
      if (!check.valid) invalid_prices.push(k.env);
    }

    prices.push(result);
  }

  const configured = !!secretKey && !!webhookSecret && missing.length === 0 && invalid_prices.length === 0;

  return new Response(JSON.stringify({
    configured,
    secret_key_present: !!secretKey,
    secret_key_mode: secretKey ? (secretKey.startsWith('sk_live_') ? 'live' : secretKey.startsWith('sk_test_') ? 'test' : 'unknown') : null,
    webhook_secret_present: !!webhookSecret,
    prices,
    missing,
    invalid_prices,
    checked_at: new Date().toISOString(),
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
