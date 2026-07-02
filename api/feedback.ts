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

// Resend が使えない/失敗した時の Gmail SMTP フォールバック。
// リード通知の機会損失を防ぐため、必ずどちらかでオーナーに届ける。
async function gmailFallback(req: Request, subject: string, bodyText: string, replyTo?: string): Promise<boolean> {
  try {
    const u = new URL('/api/mail/gmail', req.url);
    const r = await fetch(u.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: 'lead_notify', data: { subject, bodyText, replyTo } }),
    });
    return r.ok;
  } catch { return false; }
}

interface FeedbackBody {
  brand?: 'prism' | 'iris';
  nps?: number;
  comment?: string;
  email?: string;
  url?: string;
  userAgent?: string;
  ts?: number;
  /** DDD/EEE/KKK (2026-06-04): 'suggestion' / 'exit' / 'contact' は NPS 不要 */
  kind?: 'nps' | 'suggestion' | 'exit' | 'contact';
  /** EEE (2026-06-04): 解約理由カテゴリ */
  exitReason?: 'too_expensive' | 'too_hard' | 'switching' | 'not_useful' | 'other';
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);

  let body: FeedbackBody;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400, ch); }

  const brand = body.brand === 'iris' ? 'iris' : 'prism';
  const kind: 'nps' | 'suggestion' | 'exit' | 'contact' =
    body.kind === 'suggestion' || body.kind === 'exit' || body.kind === 'contact' ? body.kind : 'nps';
  const nps = typeof body.nps === 'number' ? Math.max(0, Math.min(10, Math.round(body.nps))) : -1;
  const comment = String(body.comment ?? '').slice(0, 4000);
  const email = String(body.email ?? '').slice(0, 200);
  const url = String(body.url ?? '').slice(0, 500);
  const userAgent = String(body.userAgent ?? '').slice(0, 300);
  const exitReason = (['too_expensive', 'too_hard', 'switching', 'not_useful', 'other'] as const).includes(body.exitReason as never)
    ? body.exitReason
    : undefined;

  // NPS kind の時のみ 0-10 必須。suggestion / exit / contact は不要。
  if (kind === 'nps' && nps < 0) return json({ error: 'nps required (0-10)' }, 400, ch);
  // contact は email + comment が必須
  if (kind === 'contact') {
    if (!email || !email.includes('@')) return json({ error: 'email required' }, 400, ch);
    if (comment.trim().length < 5) return json({ error: 'comment too short' }, 400, ch);
  }

  // Vercel Functions Logs に必ず構造化記録 (mail 設定の有無に関わらず)
  // → `vercel logs --prod | grep '\[feedback\]'` で全件抽出可能
  // localStorage しか頼れない問題への保険 (Day1 振り返り 5/14 で追加)
  console.log('[feedback]', JSON.stringify({
    brand, kind, nps, exitReason, comment, email, url, userAgent,
    ts: typeof body.ts === 'number' ? body.ts : Date.now(),
  }));

  // DDD (2026-06-04): Upstash 永続化 (60 日 TTL)
  await persistFeedback({ brand, kind, nps, exitReason, comment, email, url, ts: Date.now() }).catch(() => { /* */ });

  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.FEEDBACK_TO_EMAIL || process.env.EMAIL_FROM;

  const fbBrandLabel = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const fbSubject = kind === 'contact'
    ? `[リード] ${fbBrandLabel} お問い合わせ${email ? ` from ${email}` : ''}`
    : `[Beta フィードバック] ${fbBrandLabel} NPS=${nps}`;
  const fbText = `Email: ${email || '(未記入)'}\nURL: ${url || ''}\n\n${comment || '(コメント無し)'}`;

  // Resend 未設定でも Gmail SMTP で必ずオーナーへ届ける (リード機会損失防止)
  if (!apiKey || !ownerEmail) {
    const ok = await gmailFallback(req, fbSubject, fbText, email);
    return json({ success: true, delivered: ok, reason: ok ? 'gmail_fallback' : 'mail_not_configured', logged: true }, 200, ch);
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
      const ok = await gmailFallback(req, fbSubject, fbText, email);
      return json({ success: true, delivered: ok, reason: ok ? 'gmail_fallback' : 'mail_failed' }, 200, ch);
    }

    // KKK (2026-06-04): contact kind は自動返信メールも送る
    if (kind === 'contact' && email) {
      try {
        const autoReplyHtml = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#f4f4f7;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#a78bfa,#f472b6);padding:24px 28px;color:#fff">
<h2 style="margin:0;font-size:18px;font-weight:800">お問い合わせを受け付けました</h2>
<p style="margin:6px 0 0;font-size:13px;opacity:.95">${esc(brandLabel)} サポート</p>
</div>
<div style="padding:24px 28px;color:#1F1A2E;font-size:14px;line-height:1.7">
<p style="margin:0 0 16px">${esc(email.split('@')[0])} 様</p>
<p style="margin:0 0 16px">この度は CORE Prism / Iris にお問い合わせいただきありがとうございます。<br />
内容を確認の上、通常 1〜3 営業日以内にご返信いたします。</p>
<div style="background:#FAF7F0;padding:14px 16px;border-radius:8px;margin:16px 0;">
<div style="font-size:11px;color:#666;letter-spacing:.05em;font-weight:700;margin-bottom:6px">お問い合わせ内容</div>
<div style="white-space:pre-wrap;font-size:13px;color:#1F1A2E;line-height:1.7">${esc(comment.slice(0, 1000))}</div>
</div>
<p style="margin:0 0 8px;font-size:13px;color:#666">${esc(url || '')}</p>
<p style="font-size:11px;color:#999;margin:24px 0 0;border-top:1px solid #eee;padding-top:16px">
このメールは自動送信です。返信不要です。<br />
直接ご連絡は gauche.cellist1201@gmail.com まで。
</p>
</div></div></body></html>`;
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: email,
            subject: `お問い合わせを受け付けました — ${brandLabel}`,
            html: autoReplyHtml,
          }),
        });
      } catch { /* 自動返信失敗は致命的でないので無視 */ }
    }

    return json({ success: true, delivered: true }, 200, ch);
  } catch {
    const ok = await gmailFallback(req, fbSubject, fbText, email);
    return json({ success: true, delivered: ok, reason: ok ? 'gmail_fallback' : 'mail_exception' }, 200, ch);
  }
}

// ─── Upstash 永続 (DDD 2026-06-04) ───────────────────
const UP_URL_FB = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK_FB = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';

async function persistFeedback(fb: {
  brand: string; kind: string; nps: number; exitReason?: string;
  comment: string; email: string; url: string; ts: number;
}): Promise<void> {
  if (!UP_URL_FB || !UP_TOK_FB) return;
  const date = new Date(fb.ts).toISOString().slice(0, 10);
  const key = `feedback:${date}`;
  try {
    await fetch(UP_URL_FB, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UP_TOK_FB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['RPUSH', key, JSON.stringify(fb)]),
    });
    await fetch(UP_URL_FB, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${UP_TOK_FB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EXPIRE', key, 60 * 86400]),
    });
  } catch { /* */ }
}
