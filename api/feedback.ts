// ============================================================
// /api/feedback — ベータ版フィードバック受信エンドポイント
// POST { brand, nps, comment, email, ... }
// RESEND_API_KEY が設定されていればオーナー宛にメール通知
// 未設定なら受信のみ (200 OK で noop)
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

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

interface FeedbackBody {
  brand?: 'prism' | 'iris';
  nps?: number;
  comment?: string;
  email?: string;
  url?: string;
  userAgent?: string;
  ts?: number;
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);

  let body: FeedbackBody;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400, ch); }

  const brand = body.brand === 'iris' ? 'iris' : 'prism';
  const nps = typeof body.nps === 'number' ? Math.max(0, Math.min(10, Math.round(body.nps))) : -1;
  const comment = String(body.comment ?? '').slice(0, 4000);
  const email = String(body.email ?? '').slice(0, 200);
  const url = String(body.url ?? '').slice(0, 500);
  const userAgent = String(body.userAgent ?? '').slice(0, 300);

  if (nps < 0) return json({ error: 'nps required (0-10)' }, 400, ch);

  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.FEEDBACK_TO_EMAIL || process.env.EMAIL_FROM;

  // env が無ければ noop で 200 を返す (フロントの localStorage に蓄積される)
  if (!apiKey || !ownerEmail) {
    return json({ success: true, delivered: false, reason: 'mail_not_configured' }, 200, ch);
  }

  const from = process.env.EMAIL_FROM || 'noreply@coreprism.app';
  const brandLabel = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const subject = `[Beta フィードバック] ${brandLabel} NPS=${nps} ${email ? `from ${email}` : ''}`;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f4f4f7;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;">
<h2 style="margin:0 0 16px;">${esc(brandLabel)} ベータ フィードバック</h2>
<table style="width:100%;font-size:14px;line-height:1.7;">
<tr><td style="color:#8A8593;width:120px;">NPS</td><td><strong style="font-size:18px;">${nps} / 10</strong></td></tr>
<tr><td style="color:#8A8593;">Email</td><td>${esc(email || '(未記入)')}</td></tr>
<tr><td style="color:#8A8593;">URL</td><td><a href="${esc(url)}">${esc(url)}</a></td></tr>
<tr><td style="color:#8A8593;">UA</td><td style="font-size:11px;color:#555;">${esc(userAgent)}</td></tr>
</table>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
<div style="white-space:pre-wrap;font-size:14px;line-height:1.7;">${esc(comment || '(コメント無し)')}</div>
</div></body></html>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: ownerEmail, subject, html }),
    });
    if (!resp.ok) {
      return json({ success: true, delivered: false, reason: 'mail_failed' }, 200, ch);
    }
    return json({ success: true, delivered: true }, 200, ch);
  } catch {
    return json({ success: true, delivered: false, reason: 'mail_exception' }, 200, ch);
  }
}
