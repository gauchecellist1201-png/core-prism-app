// ============================================================
// /api/cron/daily-owner-email — 毎朝オーナーに日次 KPI メールを送信
//
// オーナー指示 (2026-06-03 自律): W. CORE 朝のメール
//
// 内容:
//   - 昨日の Stripe 売上 + 今月累計
//   - 新規 Subscription / Customer
//   - 重要アラート (Subscription past_due / canceled など)
//   - 翌日の主要タスク (placeholder)
//
// Vercel Cron 設定 (vercel.json):
//   "crons": [{ "path": "/api/cron/daily-owner-email", "schedule": "30 21 * * *" }]
//   ※ UTC 21:30 = JST 朝 6:30
//
// 必要な env (Vercel Production):
//   STRIPE_SECRET_KEY  = sk_live_xxx
//   RESEND_API_KEY     = re_xxx
//   OWNER_EMAIL        = naoki.ide@core-prism-app.vercel.app など (オーナーの受信先)
//   CRON_SECRET (任意) = Authorization: Bearer 検証
// ============================================================
import Stripe from 'stripe';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  // 認証
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_EMAIL || 'gauche.cellist1201@gmail.com';
  if (!stripeKey || !resendKey) {
    return jsonRes(503, { ok: false, error: 'STRIPE_SECRET_KEY / RESEND_API_KEY 未設定' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 3600_000);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yJst = new Date(yesterday.getTime() + 9 * 3600_000);

  // 売上集計
  let yesterdayRevenue = 0;
  let yesterdayCount = 0;
  let monthRevenue = 0;
  let monthCount = 0;
  let newSubscriptions = 0;
  let alertSubscriptions: Array<{ customer: string; status: string }> = [];

  try {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    let starting_after: string | undefined = undefined;
    while (true) {
      const page: Stripe.Response<Stripe.ApiList<Stripe.Charge>> = await stripe.charges.list({
        created: {
          gte: Math.floor(monthStart.getTime() / 1000),
          lte: Math.floor(now.getTime() / 1000),
        },
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      });
      for (const c of page.data) {
        if (c.status !== 'succeeded' || c.currency !== 'jpy') continue;
        monthRevenue += c.amount;
        monthCount += 1;
        // 昨日分
        const cTime = c.created * 1000;
        if (cTime >= startOfDayUtc(yesterday).getTime() && cTime <= endOfDayUtc(yesterday).getTime()) {
          yesterdayRevenue += c.amount;
          yesterdayCount += 1;
        }
      }
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1].id;
    }

    // 新規 Subscription (昨日)
    const subPage = await stripe.subscriptions.list({
      created: {
        gte: Math.floor(startOfDayUtc(yesterday).getTime() / 1000),
        lte: Math.floor(endOfDayUtc(yesterday).getTime() / 1000),
      },
      limit: 100,
    });
    newSubscriptions = subPage.data.length;

    // アラート: past_due / unpaid / canceled (直近 24h)
    const alertPage = await stripe.subscriptions.list({
      status: 'past_due',
      limit: 20,
    });
    alertSubscriptions = alertPage.data.map(s => ({
      customer: typeof s.customer === 'string' ? s.customer : s.customer.id,
      status: s.status,
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sendResendEmail(resendKey, ownerEmail, `⚠ CORE 朝のメール — Stripe エラー`, `Stripe API エラー: ${msg}`);
    return jsonRes(500, { ok: false, error: msg });
  }

  const yen = (n: number) => '¥' + Math.round(n).toLocaleString('ja-JP');
  const dateStr = `${jstNow.getFullYear()}/${jstNow.getMonth() + 1}/${jstNow.getDate()}`;
  const yDateStr = `${yJst.getMonth() + 1}/${yJst.getDate()}`;

  const html = renderHtml({
    dateStr,
    yDateStr,
    yesterdayRevenue: yen(yesterdayRevenue),
    yesterdayCount,
    monthRevenue: yen(monthRevenue),
    monthCount,
    newSubscriptions,
    alertCount: alertSubscriptions.length,
    alerts: alertSubscriptions,
  });

  await sendResendEmail(
    resendKey, ownerEmail,
    `🌅 CORE 朝のサマリ (${dateStr}) — 昨日 ${yen(yesterdayRevenue)} / ${yesterdayCount}件`,
    html,
  );

  return jsonRes(200, {
    ok: true,
    yesterday: { revenueJpy: yesterdayRevenue, count: yesterdayCount },
    month: { revenueJpy: monthRevenue, count: monthCount },
    newSubscriptions,
    alertCount: alertSubscriptions.length,
  });
}

function renderHtml(data: {
  dateStr: string;
  yDateStr: string;
  yesterdayRevenue: string;
  yesterdayCount: number;
  monthRevenue: string;
  monthCount: number;
  newSubscriptions: number;
  alertCount: number;
  alerts: Array<{ customer: string; status: string }>;
}): string {
  const alertBlock = data.alertCount === 0
    ? `<p style="font-size:13px;color:#666;margin:0">✅ 重要なアラートはありません</p>`
    : `<p style="font-size:13px;color:#DC2626;font-weight:700;margin:0 0 8px">⚠ ${data.alertCount} 件の Subscription にアラート</p>
       <ul style="margin:0;padding-left:20px;font-size:12px;color:#666;line-height:1.7">
         ${data.alerts.slice(0, 5).map(a => `<li>${a.customer} — ${a.status}</li>`).join('')}
       </ul>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#FBBF24,#E84B97);padding:32px 40px;color:#fff">
      <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-.3px">🌅 CORE 朝のサマリ</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:.9">${data.dateStr}</p>
    </div>
    <div style="padding:24px 40px;color:#1F1A2E">
      <h2 style="margin:0 0 16px;font-size:16px;font-weight:800;color:#1F1A2E">📅 昨日 (${data.yDateStr})</h2>
      <div style="background:#FAF7F0;padding:16px 18px;border-radius:10px;margin-bottom:24px">
        <div style="font-size:11px;color:#666;letter-spacing:.1em;font-weight:700;margin-bottom:4px">REVENUE</div>
        <div style="font-size:26px;font-weight:900;color:#0F2540">${data.yesterdayRevenue}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">${data.yesterdayCount} 件</div>
      </div>

      <h2 style="margin:0 0 16px;font-size:16px;font-weight:800">📈 今月累計</h2>
      <div style="background:#F0F4FA;padding:16px 18px;border-radius:10px;margin-bottom:24px">
        <div style="font-size:11px;color:#666;letter-spacing:.1em;font-weight:700;margin-bottom:4px">REVENUE</div>
        <div style="font-size:26px;font-weight:900;color:#0F2540">${data.monthRevenue}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">${data.monthCount} 件</div>
      </div>

      <h2 style="margin:0 0 12px;font-size:16px;font-weight:800">🎁 昨日の新規</h2>
      <p style="font-size:14px;color:#1F1A2E;margin:0 0 24px">
        <strong style="color:#E84B97;font-size:18px">${data.newSubscriptions} 件</strong> の新規 Subscription
      </p>

      <h2 style="margin:0 0 12px;font-size:16px;font-weight:800">⚠ 重要アラート</h2>
      ${alertBlock}

      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #eee">
        <a href="https://dashboard.stripe.com" style="display:inline-block;background:linear-gradient(135deg,#FBBF24,#E84B97);color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:13px">
          Stripe Dashboard を開く →
        </a>
      </div>

      <p style="font-size:11px;color:#999;margin:24px 0 0;line-height:1.7">
        このメールは CORE 朝のサマリ Cron から自動送信されています。<br />
        オーナー設定: 毎朝 JST 6:30 / 受信先: ${process.env.OWNER_EMAIL || 'OWNER_EMAIL'}
      </p>
    </div>
  </div>
</body></html>`;
}

async function sendResendEmail(apiKey: string, to: string, subject: string, html: string): Promise<void> {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CORE 朝のサマリ <noreply@core-prism-app.vercel.app>',
        to,
        subject,
        html,
      }),
    });
  } catch { /* silent */ }
}

function startOfDayUtc(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function endOfDayUtc(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}
function jsonRes(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
