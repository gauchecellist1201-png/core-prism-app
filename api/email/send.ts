// ============================================================
// /api/email/send — Resend メール送信
// POST { to, template: 'welcome'|'trial_ending'|'cancel_save'|'reengagement', data: {...} }
// env RESEND_API_KEY 未設定 → 503 EMAIL_NOT_CONFIGURED
// クライアントは 503 を受けたら次の経路 (Gmail SMTP / アプリ内通知) にフォールバック
// ============================================================
import { buildEmail, VALID_TEMPLATES, type Template, type TemplateData } from '../_lib/email-templates.js';

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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return json({ error: 'EMAIL_NOT_CONFIGURED' }, 503, ch);
  }

  let body: { to?: string; template?: string; data?: TemplateData };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, ch);
  }

  const { to, template, data = {} } = body;
  if (!to || !template) {
    return json({ error: 'Missing to or template' }, 400, ch);
  }
  if (!VALID_TEMPLATES.includes(template as Template)) {
    return json({ error: 'Unknown template' }, 400, ch);
  }

  const from = process.env.EMAIL_FROM || 'noreply@coreprism.app';
  const { subject, html } = buildEmail(template as Template, data);

  let resp: Response;
  try {
    resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
  } catch (e: any) {
    return json({ error: `Resend unreachable: ${e.message}` }, 502, ch);
  }

  const result = await resp.json() as { id?: string; message?: string; name?: string; statusCode?: number };
  if (!resp.ok) {
    return json({
      error: 'Send failed',
      from,
      resend_status: resp.status,
      resend_name: result.name,
      resend_message: result.message,
    }, resp.status === 401 || resp.status === 403 ? 502 : 500, ch);
  }

  return json({ success: true, id: result.id, from, via: 'resend' }, 200, ch);
}
