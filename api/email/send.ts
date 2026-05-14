// ============================================================
// /api/email/send — Resend メール送信 (3 テンプレート)
// POST { to, template: 'welcome'|'trial_ending'|'cancel_save', data: {...} }
// env RESEND_API_KEY 未設定 → 503 EMAIL_NOT_CONFIGURED
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

// ─── メールテンプレート ───

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { margin: 0; padding: 0; background: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif; }
  .wrap { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #0033A0, #1A4FC4); padding: 32px 40px; color: #fff; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.3px; }
  .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.8; }
  .body { padding: 32px 40px; color: #1F1A2E; }
  .body p { line-height: 1.8; font-size: 15px; margin: 0 0 16px; }
  .cta { display: inline-block; background: linear-gradient(135deg, #0033A0, #1A4FC4); color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 999px; font-weight: 700; font-size: 15px; margin: 8px 0 24px; }
  .highlight { background: #f0f4ff; border-left: 3px solid #0033A0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 14px; }
  .footer { padding: 20px 40px; background: #f4f4f7; font-size: 12px; color: #8A8593; text-align: center; line-height: 1.7; }
</style>
</head>
<body>
<div class="wrap">
${body}
<div class="footer">
  © 2026 CORE Inc. | <a href="https://core-prism-app.vercel.app" style="color:#0033A0;">core-prism-app.vercel.app</a><br>
  このメールに心当たりがない場合はご連絡ください。
</div>
</div>
</body>
</html>`;
}

interface TemplateData {
  name?: string;
  brand?: string;
  plan?: string;
  code?: string;
  days?: number;
  upgradeUrl?: string;
}

function welcomeHtml(data: TemplateData): string {
  const name = data.name || 'お客様';
  const brand = data.brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const guideUrl = data.brand === 'iris'
    ? 'https://core-prism-app.vercel.app/iris?app=1'
    : 'https://core-prism-app.vercel.app/?app=1';

  return baseHtml(`${brand} へようこそ`, `
<div class="header">
  <h1>ようこそ、${brand} へ</h1>
  <p>アカウントが正常に作成されました</p>
</div>
<div class="body">
  <p>${name} さん、${brand} にご登録いただきありがとうございます。</p>
  <p>最初の <strong>3 分</strong> で ${brand} を体感する手順をご案内します。</p>
  <div class="highlight">
    <strong>ステップ 1</strong> — ダッシュボードを開く<br>
    <strong>ステップ 2</strong> — 「AI 相談」でビジネス課題を入力<br>
    <strong>ステップ 3</strong> — 提案を受け取り、次のアクションを決める
  </div>
  <a class="cta" href="${guideUrl}">${brand} を今すぐ始める →</a>
  <p style="font-size:13px;color:#8A8593;">ご不明な点はいつでもサポートまでご連絡ください。</p>
</div>`);
}

function trialEndingHtml(data: TemplateData): string {
  const name = data.name || 'お客様';
  const days = data.days ?? 3;
  const upgradeUrl = data.upgradeUrl || 'https://core-prism-app.vercel.app/?app=1';

  return baseHtml('無料トライアル終了まであと少し', `
<div class="header" style="background: linear-gradient(135deg, #7C3AED, #C026D3);">
  <h1>トライアルがあと ${days} 日で終了</h1>
  <p>引き続きご利用いただくにはプランのアップグレードを</p>
</div>
<div class="body">
  <p>${name} さん、こんにちは。</p>
  <p>ご利用の無料トライアルは <strong>あと ${days} 日</strong> で終了します。</p>
  <p>トライアル終了後もすべての機能を使い続けるには、有料プランへのアップグレードをお願いします。</p>
  <div class="highlight">
    <strong>Lite</strong> — ¥1,980/月 (Iris) または ¥4,980/月 (Prism)<br>
    <strong>Standard</strong> — 人気 No.1。AI 機能が無制限に<br>
    <strong>Pro / Studio</strong> — チーム・代理店向け
  </div>
  <a class="cta" href="${upgradeUrl}">プランをアップグレード →</a>
  <p style="font-size:13px;color:#8A8593;">アップグレードしなかった場合、トライアル終了後もデータは保持されます。</p>
</div>`);
}

function cancelSaveHtml(data: TemplateData): string {
  const name = data.name || 'お客様';
  const code = data.code || 'COMEBACK50';
  const resubUrl = 'https://core-prism-app.vercel.app/?app=1';

  return baseHtml('またいつでも戻ってきてください', `
<div class="header" style="background: linear-gradient(135deg, #374151, #6B7280);">
  <h1>ご利用ありがとうございました</h1>
  <p>いつでも再開できます</p>
</div>
<div class="body">
  <p>${name} さん、これまでのご利用、誠にありがとうございました。</p>
  <p>解約のお手続きが完了しました。現在のご契約期間が終了するまでは引き続きご利用いただけます。</p>
  <p>気が変わったときのために、<strong>50% OFF の復帰クーポン</strong> をご用意しました。</p>
  <div class="highlight" style="border-color: #10B981; background: #f0fdf4;">
    <strong>復帰クーポンコード:</strong><br>
    <span style="font-size: 22px; font-weight: 900; letter-spacing: 3px; color: #065f46;">${code}</span><br>
    <span style="font-size: 12px; color: #6B7280;">初月 50% OFF。有効期限: 30 日間</span>
  </div>
  <a class="cta" style="background: linear-gradient(135deg, #059669, #10B981);" href="${resubUrl}">再開する →</a>
  <p style="font-size:13px;color:#8A8593;">またいつでもお待ちしております。</p>
</div>`);
}

function reengagementHtml(data: TemplateData): string {
  const name = data.name || 'お客様';
  const brand = data.brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const days = data.days ?? 1;
  const url = data.brand === 'iris'
    ? 'https://core-prism-app.vercel.app/iris?app=1'
    : 'https://core-prism-app.vercel.app/?app=1';

  return baseHtml(`${brand} があなたを待っています`, `
<div class="header" style="background: linear-gradient(135deg, #E1306C, #F77737);">
  <h1>${name} さん、おかえりなさい</h1>
  <p>${days} 日ぶりのご訪問をお待ちしています</p>
</div>
<div class="body">
  <p>${name} さん、おはようございます。</p>
  <p>${brand} に最後にログインしてから <strong>${days} 日</strong> が経ちました。</p>
  <p>今日の朝のブリーフ、あなたの AI マネージャがすでに準備しています。</p>
  <div class="highlight" style="border-color: #E1306C; background: #fff0f5;">
    <strong>今すぐ開くと…</strong><br>
    ・今日フォーカスすべき 3 アクション<br>
    ・進行中の案件 / 納期サマリー<br>
    ・連続日数のストリーク復帰チャンス
  </div>
  <a class="cta" style="background: linear-gradient(135deg, #E1306C, #F77737);" href="${url}">${brand} を開く →</a>
  <p style="font-size:13px;color:#8A8593;">通知が不要な場合は設定からオフにできます。</p>
</div>`);
}

type Template = 'welcome' | 'trial_ending' | 'cancel_save' | 'reengagement';

function buildEmail(template: Template, data: TemplateData): { subject: string; html: string } {
  switch (template) {
    case 'welcome':
      return {
        subject: `ようこそ ${data.brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} へ — はじめかたガイド`,
        html: welcomeHtml(data),
      };
    case 'trial_ending':
      return {
        subject: `【重要】無料トライアルがあと ${data.days ?? 3} 日で終了します`,
        html: trialEndingHtml(data),
      };
    case 'cancel_save':
      return {
        subject: 'ご利用ありがとうございました — 復帰クーポンをお届けします',
        html: cancelSaveHtml(data),
      };
    case 'reengagement':
      return {
        subject: `${data.brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} があなたを待っています — 今日のブリーフが準備できました`,
        html: reengagementHtml(data),
      };
  }
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

  const validTemplates: Template[] = ['welcome', 'trial_ending', 'cancel_save', 'reengagement'];
  if (!validTemplates.includes(template as Template)) {
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

  return json({ success: true, id: result.id, from }, 200, ch);
}
