// ============================================================
// /api/stripe/coupon-validate — Stripe Coupon / Promotion code 検証
//
// オーナー指示 (2026-06-04 第 21 波 ZZZ):
//   Checkout 直前にユーザーが入力したコード ("EARLY50" 等) を Stripe で検証し、
//   有効なら「20% OFF」「¥500 OFF 初月のみ」等の説明文を返す。
//
// POST { code }
//   → 200 { valid: true, label, percentOff?, amountOff?, currency?, duration, durationInMonths?, name? }
//   → 200 { valid: false, error }
//
// 認証なし (ユーザーが checkout 直前に入力するため公開エンドポイント)
//   レート制限: Edge instance 単位の簡易メモリ map (1 分 30 回 / IP)
// ============================================================

import Stripe from 'stripe';

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

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}

// ── レート制限 (IP / 分 30 回) ──
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const rateMap = new Map<string, number[]>();

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
       || req.headers.get('x-real-ip')
       || 'unknown');
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rateMap.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { rateMap.set(ip, arr); return true; }
  arr.push(now);
  rateMap.set(ip, arr);
  if (rateMap.size > 5000) { const k = rateMap.keys().next().value; if (k) rateMap.delete(k); }
  return false;
}

function describeDuration(d: string | undefined, months?: number | null): string {
  if (d === 'once') return '初回 1 回のみ';
  if (d === 'repeating' && months) return `${months} ヶ月間`;
  if (d === 'forever') return 'ずっと';
  return '';
}

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ valid: false, error: 'method_not_allowed' }, 405, ch);

  const ip = clientIp(req);
  if (rateLimited(ip)) return json({ valid: false, error: 'rate_limited' }, 429, { ...ch, 'Retry-After': '60' });

  let body: { code?: string };
  try { body = await req.json(); } catch { return json({ valid: false, error: 'bad_json' }, 400, ch); }
  const code = String(body.code || '').trim();
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(code)) {
    return json({ valid: false, error: 'invalid_code_format' }, 400, ch);
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ valid: false, error: 'stripe_not_configured' }, 503, ch);
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  // まず Promotion Code (顧客が入力する可読コード) を検索
  try {
    const promos = await stripe.promotionCodes.list({ code, limit: 1, active: true });
    const promo = promos.data[0];
    if (promo) {
      const c = promo.coupon;
      if (!c.valid) return json({ valid: false, error: 'expired_or_used' }, 200, ch);
      const durationText = describeDuration(c.duration, c.duration_in_months);
      const offText = c.percent_off
        ? `${c.percent_off}% OFF`
        : c.amount_off
          ? `${(c.currency || 'jpy').toUpperCase() === 'JPY' ? '¥' : ''}${c.amount_off.toLocaleString('ja-JP')} OFF`
          : '割引';
      return json({
        valid: true,
        type: 'promotion_code',
        label: `${offText}${durationText ? ' (' + durationText + ')' : ''}`,
        name: c.name || promo.code,
        percentOff: c.percent_off || null,
        amountOff: c.amount_off || null,
        currency: c.currency || null,
        duration: c.duration,
        durationInMonths: c.duration_in_months || null,
        promotionCodeId: promo.id,
      }, 200, ch);
    }
  } catch (e) {
    // promotion code 検索失敗時は coupon 直 lookup へフォールバック
    console.warn('[coupon-validate] promotionCodes.list', (e as Error).message);
  }

  // Coupon (Stripe ダッシュボードの内部 ID) — 上級者向け
  try {
    const c = await stripe.coupons.retrieve(code);
    if (!c.valid) return json({ valid: false, error: 'expired_or_used' }, 200, ch);
    const durationText = describeDuration(c.duration, c.duration_in_months);
    const offText = c.percent_off
      ? `${c.percent_off}% OFF`
      : c.amount_off
        ? `${(c.currency || 'jpy').toUpperCase() === 'JPY' ? '¥' : ''}${c.amount_off.toLocaleString('ja-JP')} OFF`
        : '割引';
    return json({
      valid: true,
      type: 'coupon',
      label: `${offText}${durationText ? ' (' + durationText + ')' : ''}`,
      name: c.name || c.id,
      percentOff: c.percent_off || null,
      amountOff: c.amount_off || null,
      currency: c.currency || null,
      duration: c.duration,
      durationInMonths: c.duration_in_months || null,
      couponId: c.id,
    }, 200, ch);
  } catch (e) {
    return json({ valid: false, error: 'not_found' }, 200, ch);
  }
}
