// ============================================================
// /api/cron/daily-stripe-slack — 毎朝の Stripe 売上を Slack に通知
//
// オーナー指示 (2026-06-03 自律): Q. Stripe → Slack 通知 cron
//
// Vercel Cron 設定 (vercel.json):
//   "crons": [{ "path": "/api/cron/daily-stripe-slack", "schedule": "0 21 * * *" }]
//   ※ UTC 21:00 = JST 朝 6:00
//
// 必要な env (Vercel Production):
//   STRIPE_SECRET_KEY  = sk_live_xxx (オーナーの rk_live でも可、Charges:read 必要)
//   SLACK_WEBHOOK_URL  = https://hooks.slack.com/services/T.../B.../xxx
//   CRON_SECRET (任意) = Vercel 推奨。Authorization: Bearer <CRON_SECRET> 検証
// ============================================================
import Stripe from 'stripe';

export const config = { runtime: 'edge' };

interface DayStat { charges: number; revenueJpy: number; }

export default async function handler(req: Request): Promise<Response> {
  // 認証 (Vercel Cron は Authorization: Bearer ヘッダーを付ける)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (!stripeKey || !slackUrl) {
    return jsonRes(503, { ok: false, error: 'STRIPE_SECRET_KEY / SLACK_WEBHOOK_URL が未設定' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  // 計算期間
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStart = startOfDay(yesterday);
  const yesterdayEnd = endOfDay(yesterday);
  const monthStart = startOfMonth(now);

  let yStat: DayStat = { charges: 0, revenueJpy: 0 };
  let mStat: DayStat = { charges: 0, revenueJpy: 0 };

  try {
    // 昨日の Charges
    yStat = await sumCharges(stripe, yesterdayStart, yesterdayEnd);
    // 今月の Charges (1 日 〜 現在)
    mStat = await sumCharges(stripe, monthStart, now);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await notifySlack(slackUrl, `⚠ CORE 自動レポート: Stripe API エラー\n${msg}`).catch(() => { /* */ });
    return jsonRes(500, { ok: false, error: msg });
  }

  // Slack に送信
  const yen = (n: number) => '¥' + Math.round(n).toLocaleString('ja-JP');
  const today = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const yKey = new Date(yesterday.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const text = [
    `🌅 *CORE Prism 朝の売上サマリ* (${today})`,
    ``,
    `📅 *昨日 (${yKey})*`,
    `   売上: ${yen(yStat.revenueJpy)} (${yStat.charges} 件)`,
    ``,
    `📈 *今月累計*`,
    `   売上: ${yen(mStat.revenueJpy)} (${mStat.charges} 件)`,
    ``,
    `_(Live / 全通貨 JPY 換算前 — 円のみ集計)_`,
  ].join('\n');

  await notifySlack(slackUrl, text);
  return jsonRes(200, {
    ok: true,
    yesterday: yStat,
    month: mStat,
  });
}

async function sumCharges(stripe: Stripe, from: Date, to: Date): Promise<DayStat> {
  let total = 0;
  let count = 0;
  let starting_after: string | undefined = undefined;
  while (true) {
    const page: Stripe.Response<Stripe.ApiList<Stripe.Charge>> = await stripe.charges.list({
      created: {
        gte: Math.floor(from.getTime() / 1000),
        lte: Math.floor(to.getTime() / 1000),
      },
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });
    for (const c of page.data) {
      if (c.status !== 'succeeded') continue;
      if (c.currency !== 'jpy') continue;
      total += c.amount;
      count += 1;
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return { revenueJpy: total, charges: count };
}

async function notifySlack(url: string, text: string): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}
function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}
function jsonRes(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
