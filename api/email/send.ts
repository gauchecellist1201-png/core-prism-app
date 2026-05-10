// api/email/send.ts — Resend API でメール送信
// POST { to, template: 'welcome'|'trial_ending'|'cancel_save', data: {...} }
// env: RESEND_API_KEY, EMAIL_FROM (optional, default noreply@coreprism.app)
// 未設定時: 503 + 'EMAIL_NOT_CONFIGURED'

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function baseLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif; background:#f5f5f7; }
  .wrap { max-width:600px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .header { background:linear-gradient(135deg,#0033A0,#1A4FC4); padding:32px; text-align:center; }
  .header h1 { color:#fff; margin:0; font-size:22px; letter-spacing:.05em; }
  .body { padding:32px; color:#1a1a2e; line-height:1.8; }
  .cta { display:inline-block; background:linear-gradient(135deg,#0033A0,#1A4FC4); color:#fff!important; text-decoration:none; padding:14px 32px; border-radius:999px; font-weight:700; font-size:15px; margin:20px 0; }
  .footer { padding:20px 32px; background:#f8f8fa; font-size:12px; color:#888; text-align:center; }
  .highlight { background:#eff6ff; border-left:4px solid #0033A0; padding:12px 16px; border-radius:0 8px 8px 0; margin:16px 0; }
</style>
</head>
<body>
<div class="wrap">
${content}
<div class="footer">© 2026 CORE Prism / CORE Iris — <a href="https://core-prism-app.vercel.app/" style="color:#0033A0">coreprism.app</a></div>
</div>
</body>
</html>`;
}

function welcomeTemplate(name: string, brand: string): string {
  const brandLabel = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const appUrl = brand === 'iris'
    ? 'https://core-prism-app.vercel.app/iris?app=1'
    : 'https://core-prism-app.vercel.app/?app=1';
  const guideUrl = brand === 'iris'
    ? 'https://core-prism-app.vercel.app/iris'
    : 'https://core-prism-app.vercel.app/';

  return baseLayout(`ようこそ ${brandLabel} へ！`, `
<div class="header"><h1>✨ ようこそ、${brandLabel} へ</h1></div>
<div class="body">
  <p>${name} さん、はじめまして。</p>
  <p>${brandLabel} へご登録いただき、ありがとうございます。<br>
  最初の <strong>3 分</strong>でできることをご紹介します。</p>
  <div class="highlight">
    <strong>ステップ 1</strong> — アプリにログインする<br>
    <strong>ステップ 2</strong> — AI に今日の課題を話しかける<br>
    <strong>ステップ 3</strong> — 提案されたアクションを実行する
  </div>
  <p>困ったことがあれば、アプリ内のサポートチャットでいつでも聞いてください。</p>
  <a href="${appUrl}" class="cta">${brandLabel} を始める →</a>
  <p style="font-size:13px;color:#888">ガイドページ: <a href="${guideUrl}" style="color:#0033A0">${guideUrl}</a></p>
</div>`);
}

function trialEndingTemplate(name: string, brand: string): string {
  const brandLabel = brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const upgradeUrl = brand === 'iris'
    ? 'https://core-prism-app.vercel.app/iris?upgrade=1'
    : 'https://core-prism-app.vercel.app/?upgrade=1';

  return baseLayout('無料トライアルがもうすぐ終了します', `
<div class="header"><h1>⏰ トライアル終了まであと3日</h1></div>
<div class="body">
  <p>${name} さん、</p>
  <p>${brandLabel} の無料トライアルが <strong>あと 3 日</strong>で終了します。</p>
  <p>これまでに体験した AI 機能をそのまま継続するには、プランへのアップグレードが必要です。</p>
  <div class="highlight">
    <strong>Lite プラン</strong> — ¥1,980/月〜<br>
    <strong>Standard プラン</strong> — ¥4,980/月 (人気 No.1)<br>
    <strong>Pro プラン</strong> — ¥9,800/月
  </div>
  <p>今すぐアップグレードすると、これまでのデータがそのまま引き継がれます。</p>
  <a href="${upgradeUrl}" class="cta">今すぐアップグレード →</a>
</div>`);
}

function cancelSaveTemplate(code: string): string {
  return baseLayout('またいつでも戻ってきてください', `
<div class="header"><h1>💙 ご利用ありがとうございました</h1></div>
<div class="body">
  <p>CORE をご利用いただき、ありがとうございました。</p>
  <p>解約のお手続きが完了しました。現在の契約期間の終了まで、引き続きすべての機能をご利用いただけます。</p>
  <div class="highlight">
    <strong>🎁 特別オファー</strong><br>
    もし再開をご検討の際は、以下のクーポンコードで <strong>50% OFF</strong> で復帰できます。
  </div>
  <p style="font-size:28px;font-weight:900;text-align:center;letter-spacing:.12em;color:#0033A0">${code}</p>
  <p>このコードはいつでも使用可能です。またのご利用をお待ちしております。</p>
  <a href="https://core-prism-app.vercel.app/" class="cta">CORE を再開する →</a>
</div>`);
}

interface EmailBody {
  to: string;
  template: 'welcome' | 'trial_ending' | 'cancel_save';
  data: Record<string, string>;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json({ error: 'EMAIL_NOT_CONFIGURED' }, 503);

  let body: EmailBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { to, template, data } = body;
  const from = process.env.EMAIL_FROM || 'noreply@coreprism.app';

  let subject: string;
  let html: string;

  switch (template) {
    case 'welcome':
      subject = `ようこそ ${data.brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} へ！`;
      html = welcomeTemplate(data.name || '', data.brand || 'prism');
      break;
    case 'trial_ending':
      subject = '無料トライアルがあと3日で終了します';
      html = trialEndingTemplate(data.name || '', data.brand || 'prism');
      break;
    case 'cancel_save':
      subject = 'またいつでも戻ってきてください — 50% OFF 復帰コード';
      html = cancelSaveTemplate(data.code || 'COMEBACK50');
      break;
    default:
      return json({ error: 'Unknown template' }, 400);
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ error: err }, res.status);
    }

    const result = await res.json() as { id?: string };
    return json({ ok: true, id: result.id });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}
