// ============================================================
// /api/org/invite — Org メンバー招待メール送信
// POST { to, tenant_name, inviter, role, token, brand }
// Supabase 側で invite_member RPC が token を発行 → このエンドポイントで
// 受諾リンク付きの招待メールを送る (Resend)
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
  };
}

function json(d: unknown, s: number, h: Record<string, string> = {}) {
  return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...h } });
}

function inviteHtml(p: { tenantName: string; inviter: string; role: string; acceptUrl: string; brand: string }) {
  const brandLabel = p.brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const grad = p.brand === 'iris'
    ? 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)'
    : 'linear-gradient(135deg, #0033A0, #1A4FC4)';
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,'Hiragino Sans',sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:${grad};padding:32px 40px;color:#fff;">
    <h1 style="margin:0;font-size:22px;font-weight:800;">${p.tenantName} に招待されました</h1>
    <p style="margin:6px 0 0;font-size:13px;opacity:.85;">${brandLabel} 組織への参加リクエスト</p>
  </div>
  <div style="padding:32px 40px;color:#1F1A2E;line-height:1.8;font-size:15px;">
    <p><strong>${p.inviter}</strong> さんが、あなたを <strong>${p.tenantName}</strong>（${brandLabel}）に <strong>${p.role}</strong> として招待しました。</p>
    <p>下のボタンから招待を受諾し、参加してください（リンクは 7 日間有効）。</p>
    <p style="text-align:center;margin:32px 0;">
      <a href="${p.acceptUrl}" style="display:inline-block;background:${grad};color:#fff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:700;">招待を受諾する →</a>
    </p>
    <p style="font-size:12px;color:#8A8593;">心当たりがない場合はこのメールを無視して構いません。</p>
  </div>
</div></body></html>`;
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json({ error: 'EMAIL_NOT_CONFIGURED' }, 503, ch);

  let body: { to?: string; tenant_name?: string; inviter?: string; role?: string; token?: string; brand?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400, ch); }

  const { to, tenant_name, inviter, role, token, brand } = body;
  if (!to || !tenant_name || !token) return json({ error: 'Missing fields' }, 400, ch);

  const origin = req.headers.get('origin') || 'https://core-prism-app.vercel.app';
  const acceptUrl = `${origin}/?invite=${encodeURIComponent(token)}`;

  const html = inviteHtml({
    tenantName: tenant_name,
    inviter: inviter || 'チームオーナー',
    role: role || 'member',
    acceptUrl,
    brand: brand || 'prism',
  });

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CORE <noreply@core-prism-app.vercel.app>',
        to,
        subject: `${tenant_name} への参加招待`,
        html,
      }),
    });
    const result = await r.json() as any;
    if (!r.ok) return json({ error: result.message || 'Resend error' }, 500, ch);
    return json({ ok: true, accept_url: acceptUrl }, 200, ch);
  } catch (e: any) {
    return json({ error: `Resend unreachable: ${e.message}` }, 502, ch);
  }
}
