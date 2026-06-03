// ============================================================
// /api/cron/d3-highlights-email — Subscription created から 3 日経った新規ユーザーへ
//                                  「初週に AI に頼めるおすすめタスク 3 つ」をメール
//
// オーナー指示 (2026-06-04 第 19 波 UUU): ROI 体感を高める
//
// 抽出条件:
//   - Stripe customer.subscription.created の created_at が
//     [now - 4 日, now - 2 日] のレンジに入るユーザー (D2.5-D3.5 帯)
//   - 各ユーザーに送るのは 1 回のみ
//     (Upstash `highlights:d3:<customer>` SET 14 日 TTL で重複防止)
//
// 推奨 cron: "0 22 * * *" (UTC 22:00 = JST 朝 7:00) 毎日 1 回。
// ============================================================

import Stripe from 'stripe';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

const SUPPRESS_TTL_SEC = 14 * 86400;

function jsonRes(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

const HIGHLIGHTS_HTML = (firstName: string) => `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,'Hiragino Sans','Yu Gothic',sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
<div style="background:linear-gradient(135deg,#A78BFA,#F472B6,#FBBF24);padding:32px;color:#fff;text-align:center">
<h1 style="margin:0;font-size:22px;font-weight:900">3 日目の確認</h1>
<p style="margin:6px 0 0;font-size:14px;opacity:.95">${esc(firstName)} さん、14 役員はちゃんと動いていますか?</p>
</div>
<div style="padding:28px 32px;color:#1F1A2E;line-height:1.7;font-size:14px">
<p style="margin:0 0 16px">CORE Prism を始めて 3 日 — 14 人の役員 を「肌で感じる」のに最適なタイミングです。</p>
<p style="margin:0 0 20px">下の <strong>3 つのタスク</strong> を 1 回ずつ AI に頼んでみてください。それぞれ 1 分で結果が返ります。</p>

<div style="background:#FAF7F0;padding:16px 18px;border-radius:12px;margin:16px 0">
<div style="font-size:11px;color:#666;letter-spacing:.08em;font-weight:700;margin-bottom:8px">タスク 1 / CFO</div>
<div style="font-size:15px;font-weight:800;color:#1F1A2E;margin-bottom:4px">📊 今月の収支を整理して</div>
<div style="font-size:12px;color:#666;line-height:1.7">CFO に頼むと、入っているお金 / 出ているお金 を一覧化して赤字 / 黒字を可視化。判断材料が 30 秒で揃います。</div>
</div>

<div style="background:#F0F4FA;padding:16px 18px;border-radius:12px;margin:16px 0">
<div style="font-size:11px;color:#666;letter-spacing:.08em;font-weight:700;margin-bottom:8px">タスク 2 / CSO (営業)</div>
<div style="font-size:15px;font-weight:800;color:#1F1A2E;margin-bottom:4px">💼 明日アプローチする 3 社を選んで</div>
<div style="font-size:12px;color:#666;line-height:1.7">CSO に頼むと、CRM 内の Deal から「いま動かすべき 3 社」と「具体的な一文」を提示。明日の朝に何を送れば良いか迷いません。</div>
</div>

<div style="background:#F5F3FF;padding:16px 18px;border-radius:12px;margin:16px 0">
<div style="font-size:11px;color:#666;letter-spacing:.08em;font-weight:700;margin-bottom:8px">タスク 3 / CMO (マーケ)</div>
<div style="font-size:15px;font-weight:800;color:#1F1A2E;margin-bottom:4px">📣 今週の SNS 投稿 3 本を生成</div>
<div style="font-size:12px;color:#666;line-height:1.7">CMO に頼むと、note / X / Instagram 用の投稿コピーを 3 本同時生成。あとはコピー → 投稿で済みます。</div>
</div>

<div style="text-align:center;margin:24px 0 12px">
<a href="https://core-prism-app.vercel.app/?utm_source=d3_highlights" style="display:inline-block;background:linear-gradient(135deg,#A78BFA,#F472B6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:800;font-size:14px;box-shadow:0 8px 20px rgba(167,139,250,.35)">
✨ いま始める →
</a>
</div>

<p style="font-size:13px;color:#1F1A2E;margin:24px 0 8px;line-height:1.7">
👉 もし「使い方が分からない」「もっとこうしたい」があれば、画面 左下 の <strong>💡 改善提案</strong> から 1 行で教えてください。次のアップデートに必ず反映します。
</p>
<p style="font-size:11px;color:#999;margin:24px 0 0;border-top:1px solid #eee;padding-top:16px;line-height:1.7">
このメールは Subscription 開始から 3 日経った方に 1 回だけお送りしています。<br />
配信停止は <a href="mailto:gauche.cellist1201@gmail.com?subject=D3配信停止" style="color:#999">gauche.cellist1201@gmail.com</a> へご連絡ください。
</p>
</div></div></body></html>`;

export default async function handler(req: Request): Promise<Response> {
  // 認証 (Vercel Cron)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) return new Response('Unauthorized', { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!stripeKey || !resendKey || !UPSTASH_OK) {
    return jsonRes(503, {
      ok: false,
      error: 'env_missing',
      have: { stripeKey: !!stripeKey, resendKey: !!resendKey, upstash: UPSTASH_OK },
    });
  }
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  // D2.5 - D3.5 帯 (created_at が now-4 日 〜 now-2 日)
  const now = Date.now();
  const from = Math.floor((now - 4 * 86400_000) / 1000);
  const to = Math.floor((now - 2 * 86400_000) / 1000);

  let sent = 0;
  let skipped = 0;
  let scanned = 0;
  let starting_after: string | undefined;

  // Stripe Subscription を created レンジで列挙
  while (scanned < 500) {
    const page = await stripe.subscriptions.list({
      created: { gte: from, lte: to },
      limit: 50,
      ...(starting_after ? { starting_after } : {}),
    });
    for (const sub of page.data) {
      scanned++;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      if (!customerId) continue;
      // 既に送ってないか確認
      try {
        const seen = await up(['GET', `highlights:d3:${customerId}`]);
        if ((seen as { result?: string | null }).result) { skipped++; continue; }
      } catch { /* */ }

      let email = '';
      try {
        const cust = await stripe.customers.retrieve(customerId);
        if (cust && !(cust as Stripe.DeletedCustomer).deleted) {
          email = (cust as Stripe.Customer).email || '';
        }
      } catch { /* */ }
      if (!email) continue;

      const firstName = email.split('@')[0];
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'CORE Prism <noreply@resend.dev>',
            to: [email],
            subject: '3 日目の確認 — 14 役員がちゃんと動いていますか?',
            html: HIGHLIGHTS_HTML(firstName),
          }),
        });
        await up(['SET', `highlights:d3:${customerId}`, new Date().toISOString(), 'EX', SUPPRESS_TTL_SEC]);
        sent++;
      } catch (e) {
        console.error('[d3-highlights] resend failed', customerId, (e as Error).message);
      }
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1]?.id;
    if (!starting_after) break;
  }

  return jsonRes(200, { ok: true, scanned, sent, skipped });
}
