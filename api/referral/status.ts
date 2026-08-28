// ============================================================
// /api/referral/status
// 招待者が「自分の紹介コードで実際に登録した人数」を取得する。
// 紹介の手応え (両者 +7 日) を招待者側に返すための読み取り API。
//
// GET /api/referral/status?code=XXXXXX
// 200 { ok: true, referred_count: number, bonus_days: number }
// 400 { ok: false, message: string }
//
// 数える場所は 2 つ:
//   1. Upstash Redis の集合 ref:redeemed:<CODE> (本番で実際に効いている)
//   2. Supabase referral_redemptions (env が設定されていれば併用)
// 多い方を採用する (移行期に片方だけへ書かれた分を取りこぼさないため)。
// どちらも読めない時は referred_count: 0 でフェイルオープン
// (UX を止めない・嘘の数字も出さない)。
// ============================================================

import { countRedemptions } from '../_lib/referralStore';

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const BONUS_DAYS = 7;
const MIN_CODE_LENGTH = 6;
const CODE_PATTERN = /^[A-Z0-9]+$/i;

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
    return json({ ok: false, message: 'Method not allowed' }, 405, ch);
  }

  const url = new URL(req.url);
  const code = (url.searchParams.get('code') || '').trim().toUpperCase();

  if (!code || code.length < MIN_CODE_LENGTH || !CODE_PATTERN.test(code)) {
    return json({ ok: false, message: '紹介コードの形式が不正です' }, 400, ch);
  }

  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let referredCount = 0;
  let source: 'none' | 'kv' | 'supabase' = 'none';

  // ─── 1. Upstash Redis (本番で実際に記録されている場所) ───
  const kvCount = await countRedemptions(code);
  if (kvCount !== null) {
    referredCount = kvCount;
    source = 'kv';
  }

  if (supaUrl && supaKey) {
    try {
      // count=exact で件数だけを取得 (Content-Range ヘッダに total が入る)
      const resp = await fetch(
        `${supaUrl}/rest/v1/referral_redemptions?referral_code=eq.${encodeURIComponent(code)}&select=id`,
        {
          headers: {
            apikey: supaKey,
            Authorization: `Bearer ${supaKey}`,
            Prefer: 'count=exact',
            Range: '0-0',
          },
        },
      );
      if (resp.ok) {
        // Content-Range: "0-0/N" の N が総件数
        const cr = resp.headers.get('content-range') || '';
        const total = parseInt(cr.split('/')[1] || '', 10);
        // ★代入ではなく「多い方を採る」。代入にすると、Upstash に記録済みの
        //   実績が、テーブルが空の Supabase の 0 で上書きされて消える。
        if (Number.isFinite(total) && total >= 0) {
          if (total > referredCount) { referredCount = total; source = 'supabase'; }
        } else {
          // count ヘッダが無い環境向けフォールバック: 行を数える
          const rows = await resp.json() as { id: string }[];
          if (Array.isArray(rows) && rows.length > referredCount) {
            referredCount = rows.length;
            source = 'supabase';
          }
        }
      }
    } catch (e) {
      // Supabase 不通でもフェイルオープン (0 を返す)
      console.warn('[referral/status] supabase query failed:', e);
    }
  }

  return json({
    ok: true,
    referred_count: referredCount,
    bonus_days: referredCount * BONUS_DAYS,
    // 'none' = どこにも記録が残っていない (人数を保証できない状態)
    source,
  }, 200, ch);
}
