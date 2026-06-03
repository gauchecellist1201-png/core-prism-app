// ============================================================
// /api/user/export — サーバ側で持っているユーザーデータを返却
//
// オーナー指示 (2026-06-04 第 16 波 JJJ): GDPR / 個情法 対応
//
// POST { stripeUserKey?: string; deviceId?: string }
//   - stripeUserKey が渡ってきたら Stripe 顧客本人として:
//       /v1/account / /v1/subscriptions / /v1/charges を返却
//   - deviceId が渡ってきたら Upstash 保存分:
//       オンボ funnel カウンタ (集計の素データではなく totals)
//       feedback (最近の feedback:<date> 内で同一 url が含まれるもの)
//       retention の自端末分のみ
// ============================================================

import Stripe from 'stripe';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function up(cmd: (string | number)[]): Promise<unknown> {
  if (!UPSTASH_OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

function isValidDeviceId(s: unknown): s is string {
  return typeof s === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(s);
}

function isValidStripeKey(s: unknown): s is string {
  return typeof s === 'string' && /^(sk|rk|ac)_[A-Za-z0-9_]+$/.test(s);
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { stripeUserKey?: string; deviceId?: string };
  try { body = await req.json(); } catch { body = {}; }

  const out: {
    stripe?: unknown;
    subscriptions?: unknown;
    charges?: unknown;
    retention?: unknown;
    notes: string[];
  } = { notes: [] };

  // ─── Stripe (顧客本人の鍵を持参している場合のみ自分のデータを返す) ───
  if (isValidStripeKey(body.stripeUserKey)) {
    const stripeKey = body.stripeUserKey as string;
    try {
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });
      const acct = await stripe.accounts.retrieve();
      out.stripe = {
        id: acct.id,
        email: acct.email,
        country: acct.country,
        default_currency: acct.default_currency,
        business_profile: acct.business_profile,
        charges_enabled: acct.charges_enabled,
        payouts_enabled: acct.payouts_enabled,
      };
      const subs = await stripe.subscriptions.list({ limit: 20 });
      out.subscriptions = subs.data.map(s => ({
        id: s.id,
        status: s.status,
        current_period_end: s.current_period_end,
        trial_end: s.trial_end,
        cancel_at_period_end: s.cancel_at_period_end,
        items: s.items.data.map(i => ({ price_id: i.price.id, product: i.price.product, unit_amount: i.price.unit_amount, currency: i.price.currency })),
        metadata: s.metadata,
      }));
      const charges = await stripe.charges.list({ limit: 20 });
      out.charges = charges.data.map(c => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        created: c.created,
        receipt_url: c.receipt_url,
        description: c.description,
      }));
    } catch (e) {
      out.notes.push(`stripe_error: ${(e as Error).message?.slice(0, 200)}`);
    }
  } else if (body.stripeUserKey) {
    out.notes.push('stripeUserKey 形式が不正のため Stripe 側はスキップしました。');
  }

  // ─── Upstash: deviceId を持っている場合 (リテンション履歴 / 自端末 ping) ───
  if (UPSTASH_OK && isValidDeviceId(body.deviceId)) {
    const deviceId = body.deviceId as string;
    const seenDates: string[] = [];
    try {
      // 直近 30 日 active:<date> SET に deviceId が含まれるかチェック (SISMEMBER)
      for (let i = 0; i < 30; i++) {
        const d = dateOffsetDays(i);
        try {
          const r = await up(['SISMEMBER', `active:${d}`, deviceId]);
          if (((r as { result?: number }).result || 0) === 1) seenDates.push(d);
        } catch { /* */ }
      }
      // 自端末の最終訪問日
      let lastDate: string | null = null;
      try {
        const r = await up(['GET', `dev:${deviceId}:last`]);
        const v = (r as { result?: string | null }).result;
        if (typeof v === 'string') lastDate = v;
      } catch { /* */ }
      out.retention = { deviceId, lastDate, activeDates: seenDates };
    } catch (e) {
      out.notes.push(`upstash_error: ${(e as Error).message?.slice(0, 200)}`);
    }
  } else if (body.deviceId) {
    out.notes.push('deviceId 形式が不正のためサーバ側履歴はスキップしました。');
  } else {
    out.notes.push('deviceId が無いため サーバ側リテンション履歴はスキップしました。');
  }

  return json(out, 200);
}
