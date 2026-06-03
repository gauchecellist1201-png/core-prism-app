// ============================================================
// /api/team/invite — チーム招待メール送信
//
// オーナー指示 (2026-06-04 第 18 波 QQQ):
//   親 user が他メンバーを招待する。Resend で招待リンク付きメール送付。
//
// POST { invitedBy, email, role, inviteUrl, parentBrand? }
//
// 永続化:
//   Upstash 設定済なら team:invites:<parentEmail> LIST に {email, role, token, ts}
//   を RPUSH (60 日 TTL)。本番では Supabase / Auth に置き換える前提。
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

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

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}

function isValidEmail(e: unknown): e is string {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
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

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, ch);

  let body: { invitedBy?: string; email?: string; role?: string; inviteUrl?: string; parentBrand?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400, ch); }

  const invitedBy = String(body.invitedBy || '').slice(0, 200);
  const inviteUrl = String(body.inviteUrl || '').slice(0, 500);
  const role = (['admin', 'editor', 'viewer'] as const).includes(body.role as never) ? body.role : 'viewer';
  const brand = body.parentBrand === 'iris' ? 'iris' : 'prism';

  if (!isValidEmail(body.email)) return json({ error: 'invalid_email' }, 400, ch);
  if (!isValidEmail(invitedBy)) return json({ error: 'invalid_invitedBy' }, 400, ch);
  if (!/^https?:\/\//.test(inviteUrl)) return json({ error: 'invalid_inviteUrl' }, 400, ch);

  // Upstash 永続化
  if (UPSTASH_OK) {
    try {
      const key = `team:invites:${invitedBy.toLowerCase()}`;
      await up(['RPUSH', key, JSON.stringify({ email: body.email, role, inviteUrl, ts: Date.now(), brand })]);
      await up(['EXPIRE', key, 60 * 86400]);
    } catch (e) {
      console.error('[team-invite] upstash', (e as Error).message);
    }
  }

  // Resend で招待メール送付
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return json({ ok: true, delivered: false, reason: 'resend_not_configured' }, 200, ch);
  }
  const brandLabel = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,'Hiragino Sans','Yu Gothic',sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
<div style="background:linear-gradient(135deg,#A78BFA,#F472B6);padding:32px;color:#fff;text-align:center">
<h1 style="margin:0;font-size:22px;font-weight:900">${esc(brandLabel)} へ招待されました</h1>
<p style="margin:8px 0 0;font-size:14px;opacity:.95">${esc(invitedBy)} さんからのお誘いです</p>
</div>
<div style="padding:28px 32px;color:#1F1A2E;line-height:1.7;font-size:14px">
<p style="margin:0 0 16px">こんにちは。<br /><strong>${esc(invitedBy)}</strong> さんが、あなたを <strong>${esc(brandLabel)}</strong> のチームに招待しました。</p>
<div style="background:#FAF7F0;padding:14px 16px;border-radius:10px;margin:16px 0;font-size:13px">
<div style="color:#666;font-size:11px;letter-spacing:.05em;font-weight:700;margin-bottom:4px">あなたの役割</div>
<div style="font-size:18px;font-weight:900;color:#1F1A2E">${role === 'admin' ? '👑 管理者' : role === 'editor' ? '✍️ 編集' : '👁 閲覧'}</div>
</div>
<div style="text-align:center;margin:24px 0 12px">
<a href="${esc(inviteUrl)}" style="display:inline-block;background:linear-gradient(135deg,#A78BFA,#F472B6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:800;font-size:14px;box-shadow:0 8px 20px rgba(167,139,250,.35)">
招待を受け取る →
</a>
</div>
<p style="font-size:12px;color:#666;margin:16px 0 0">うまく開けない場合は次の URL を直接ブラウザに貼ってください:<br /><span style="font-family:Menlo,monospace;color:#A78BFA;word-break:break-all">${esc(inviteUrl)}</span></p>
<p style="font-size:11px;color:#999;margin:24px 0 0;border-top:1px solid #eee;padding-top:16px">
${esc(brandLabel)} は AI 役員 14 名があなたの業務を補助する SaaS です。<br />
このメールに心当たりがない場合は、安全のためそのまま破棄してください。
</p>
</div></div></body></html>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CORE Prism <noreply@resend.dev>',
        to: [body.email],
        subject: `${invitedBy} さんから ${brandLabel} に招待されました`,
        html,
      }),
    });
    if (!r.ok) return json({ ok: true, delivered: false, reason: `resend_${r.status}` }, 200, ch);
    return json({ ok: true, delivered: true }, 200, ch);
  } catch (e) {
    return json({ ok: true, delivered: false, reason: (e as Error).message }, 200, ch);
  }
}
