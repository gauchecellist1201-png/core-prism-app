// ============================================================
// /api/mail/gmail — Gmail SMTP 経由のメール送信 (完全無料・1 日 500 通)
// env GMAIL_USER + GMAIL_APP_PASSWORD が未設定なら 503
// 注: Node ランタイム (nodemailer は TCP が必要なので Edge では不可)
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function applyCors(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

type Template = 'welcome' | 'trial_ending' | 'cancel_save' | 'reengagement';
const VALID_TEMPLATES: Template[] = ['welcome', 'trial_ending', 'cancel_save', 'reengagement'];

interface TemplateData {
  name?: string;
  brand?: string;
  plan?: string;
  code?: string;
  days?: number;
  upgradeUrl?: string;
}

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><style>body{margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic',sans-serif}.wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}.header{background:linear-gradient(135deg,#0033A0,#1A4FC4);padding:32px 40px;color:#fff}.header h1{margin:0;font-size:24px;font-weight:800;letter-spacing:-.3px}.header p{margin:8px 0 0;font-size:14px;opacity:.8}.body{padding:32px 40px;color:#1F1A2E}.body p{line-height:1.8;font-size:15px;margin:0 0 16px}.cta{display:inline-block;background:linear-gradient(135deg,#0033A0,#1A4FC4);color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px;margin:8px 0 24px}.highlight{background:#f0f4ff;border-left:3px solid #0033A0;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;font-size:14px}.footer{padding:20px 40px;background:#f4f4f7;font-size:12px;color:#8A8593;text-align:center;line-height:1.7}</style></head><body><div class="wrap">${body}<div class="footer">© 2026 CORE Inc. | <a href="https://core-prism-app.vercel.app" style="color:#0033A0;">core-prism-app.vercel.app</a><br>このメールに心当たりがない場合はご連絡ください。</div></div></body></html>`;
}

function buildEmail(template: Template, data: TemplateData): { subject: string; html: string } {
  const name = data.name || 'お客様';
  const brand = data.brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const guideUrl = data.brand === 'iris'
    ? 'https://core-prism-app.vercel.app/iris?app=1'
    : 'https://core-prism-app.vercel.app/?app=1';

  if (template === 'welcome') {
    return {
      subject: `ようこそ ${brand} へ — はじめかたガイド`,
      html: baseHtml(`${brand} へようこそ`, `<div class="header"><h1>ようこそ、${brand} へ</h1><p>アカウントが正常に作成されました</p></div><div class="body"><p>${name} さん、${brand} にご登録いただきありがとうございます。</p><p>最初の <strong>3 分</strong> で ${brand} を体感できます。</p><a class="cta" href="${guideUrl}">${brand} を今すぐ始める →</a></div>`),
    };
  }
  if (template === 'trial_ending') {
    const days = data.days ?? 3;
    return {
      subject: `【重要】無料トライアルがあと ${days} 日で終了します`,
      html: baseHtml('無料トライアル終了まであと少し', `<div class="header" style="background:linear-gradient(135deg,#7C3AED,#C026D3);"><h1>トライアルがあと ${days} 日で終了</h1></div><div class="body"><p>${name} さん、こんにちは。</p><p>無料トライアルは <strong>あと ${days} 日</strong> で終了します。</p><a class="cta" href="${data.upgradeUrl || guideUrl}">プランをアップグレード →</a></div>`),
    };
  }
  if (template === 'cancel_save') {
    const code = data.code || 'COMEBACK50';
    return {
      subject: 'ご利用ありがとうございました — 復帰クーポンをお届けします',
      html: baseHtml('またいつでも戻ってきてください', `<div class="header" style="background:linear-gradient(135deg,#374151,#6B7280);"><h1>ご利用ありがとうございました</h1></div><div class="body"><p>${name} さん、これまでのご利用、誠にありがとうございました。</p><div class="highlight" style="border-color:#10B981;background:#f0fdf4;"><strong>復帰クーポン:</strong> <span style="font-size:22px;font-weight:900;letter-spacing:3px;color:#065f46;">${code}</span><br><span style="font-size:12px;color:#6B7280;">初月 50% OFF。有効期限: 30 日間</span></div><a class="cta" style="background:linear-gradient(135deg,#059669,#10B981);" href="${guideUrl}">再開する →</a></div>`),
    };
  }
  // reengagement
  const days = data.days ?? 1;
  return {
    subject: `${brand} があなたを待っています — 今日のブリーフが準備できました`,
    html: baseHtml(`${brand} があなたを待っています`, `<div class="header" style="background:linear-gradient(135deg,#E1306C,#F77737);"><h1>${name} さん、おかえりなさい</h1><p>${days} 日ぶりのご訪問をお待ちしています</p></div><div class="body"><p>今日の朝のブリーフが準備できました。</p><a class="cta" style="background:linear-gradient(135deg,#E1306C,#F77737);" href="${guideUrl}">${brand} を開く →</a></div>`),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return res.status(503).json({ error: 'GMAIL_NOT_CONFIGURED' });
  }

  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) || {};
  const to = body.to as string | undefined;
  const template = body.template as string | undefined;
  const data: TemplateData = (body.data as TemplateData) || {};
  if (!to || !template) {
    return res.status(400).json({ error: 'Missing to or template' });
  }
  if (!VALID_TEMPLATES.includes(template as Template)) {
    return res.status(400).json({ error: 'Unknown template' });
  }

  const fromName = process.env.GMAIL_FROM_NAME || 'CORE Prism';
  const { subject, html } = buildEmail(template as Template, data);

  let nodemailer: any;
  try {
    const mod = await import('nodemailer');
    nodemailer = (mod as any).default ?? mod;
  } catch (e: any) {
    return res.status(502).json({ error: 'nodemailer load failed', detail: e?.message || 'unknown' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    const info = await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to,
      subject,
      html,
    });
    return res.status(200).json({ success: true, id: info.messageId, from: user, via: 'gmail-smtp' });
  } catch (e: any) {
    return res.status(502).json({ error: 'Gmail SMTP send failed', detail: e?.message || 'unknown' });
  }
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}
