// ============================================================
// /api/referral/redeem
// 紹介コード検証 → 紹介された側 +7 日 / 紹介した側 +7 日
//
// POST { referral_code: string, referee_email: string }
// 200  { ok: true, bonus_days: 7, message: string }
// 400  { ok: false, message: string }
//
// Supabase が設定されていれば referral_redemptions テーブルに記録し、
// 同じ紹介コード × メールの重複利用を防ぐ。未設定でも形式検証だけは通り
// クライアント側で +7 日の付与は可能 (UX を止めない)。
// ============================================================

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

interface ReqBody {
  referral_code?: string;
  referee_email?: string;
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: ch });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, message: 'Method not allowed' }, 405, ch);
  }

  let body: ReqBody;
  try {
    body = await req.json() as ReqBody;
  } catch {
    return json({ ok: false, message: 'Invalid JSON' }, 400, ch);
  }

  const code = (body.referral_code || '').trim().toUpperCase();
  const email = (body.referee_email || '').trim().toLowerCase();

  if (!code || code.length < MIN_CODE_LENGTH || !CODE_PATTERN.test(code)) {
    return json({ ok: false, message: '紹介コードの形式が不正です' }, 400, ch);
  }
  if (!email || !email.includes('@')) {
    return json({ ok: false, message: 'メールアドレスが不正です' }, 400, ch);
  }

  // ─── Supabase が設定されていれば二重利用を弾く ───
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supaUrl && supaKey) {
    // 既に同じ email がコード利用済かチェック
    try {
      const check = await fetch(
        `${supaUrl}/rest/v1/referral_redemptions?referee_email=eq.${encodeURIComponent(email)}&select=id`,
        {
          headers: {
            apikey: supaKey,
            Authorization: `Bearer ${supaKey}`,
          },
        },
      );
      if (check.ok) {
        const rows = await check.json() as { id: string }[];
        if (Array.isArray(rows) && rows.length > 0) {
          return json({
            ok: false,
            message: 'このメールアドレスは既に紹介コードを利用済です',
          }, 409, ch);
        }
      }
    } catch (e) {
      // Supabase 不通でも UX は止めない (フェイルオープン)
      console.warn('[referral/redeem] supabase check failed:', e);
    }

    // 記録 (テーブルが無い場合は黙ってスキップ)
    try {
      await fetch(`${supaUrl}/rest/v1/referral_redemptions`, {
        method: 'POST',
        headers: {
          apikey: supaKey,
          Authorization: `Bearer ${supaKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          referral_code: code,
          referee_email: email,
          bonus_days: BONUS_DAYS,
          redeemed_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.warn('[referral/redeem] supabase insert failed:', e);
    }
  }

  return json({
    ok: true,
    bonus_days: BONUS_DAYS,
    message: `🎉 友達招待ボーナスで +${BONUS_DAYS} 日のトライアル延長が適用されました!`,
  }, 200, ch);
}
