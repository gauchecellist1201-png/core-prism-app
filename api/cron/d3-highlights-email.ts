// ============================================================
// /api/cron/d3-highlights-email — D3 / D7 / D14 オンボ ナーチャリング
//
// オーナー指示 (2026-06-04 第 38 波 XXXXX で D7/D14 追加):
//   - D3 : 「使い方 の 3 タスク」 を 提示
//   - D7 : 「1 週間 進捗 と +2 タスク」 を 提示 (未活性ユーザー の自走 促進)
//   - D14: 「経費 か 投資 か」 の 自己判断 質問 + オーナー直 メール 30 分 オファー
//
// 抽出条件:
//   - Stripe customer.subscription.created の created_at が
//     [now - X-1 日, now - X+1 日] のレンジに入るユーザー
//   - 各ユーザー 1 cohort につき 1 回のみ
//     (Upstash `highlights:<cohort>:<customer>` で 重複 防止)
//
// 推奨 cron: "0 22 * * *" (UTC 22:00 = JST 朝 7:00) 1 日 1 回 で 3 cohort 同時処理。
// ============================================================

import Stripe from 'stripe';
import { buildEmail } from '../_lib/email-templates';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

const SUPPRESS_TTL_SEC = 35 * 86400; // 35 日 (D14 を超えて 1 ヶ月 残す)

function jsonRes(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function up(cmd: (string | number)[]): Promise<any> {
  if (!UPSTASH_OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

type Cohort = { key: 'd3' | 'd7' | 'd14'; daysAgo: number; template: 'd3_highlights' | 'd7_progress' | 'd14_results' };

const COHORTS: Cohort[] = [
  { key: 'd3',  daysAgo: 3,  template: 'd3_highlights' },
  { key: 'd7',  daysAgo: 7,  template: 'd7_progress' },
  { key: 'd14', daysAgo: 14, template: 'd14_results' },
];

async function sendCohort(stripe: Stripe, resendKey: string, cohort: Cohort) {
  const now = Date.now();
  // ± 1 日 のレンジ で当日処理 (cron が 1 日 1 回なので 漏れない)
  const from = Math.floor((now - (cohort.daysAgo + 1) * 86400_000) / 1000);
  const to = Math.floor((now - (cohort.daysAgo - 1) * 86400_000) / 1000);

  let sent = 0;
  let skipped = 0;
  let scanned = 0;
  let starting_after: string | undefined;

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
      try {
        const seen = await up(['GET', `highlights:${cohort.key}:${customerId}`]);
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
      const { subject, html } = buildEmail(cohort.template, { name: firstName });
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'CORE Prism <noreply@resend.dev>',
            to: [email],
            subject,
            html,
          }),
        });
        await up(['SET', `highlights:${cohort.key}:${customerId}`, new Date().toISOString(), 'EX', SUPPRESS_TTL_SEC]);
        sent++;
      } catch (e) {
        console.error(`[highlights ${cohort.key}] resend failed`, customerId, (e as Error).message);
      }
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1]?.id;
    if (!starting_after) break;
  }
  return { cohort: cohort.key, scanned, sent, skipped };
}

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

  // ?only=d3|d7|d14 で 1 cohort だけ実行可
  const url = new URL(req.url);
  const only = url.searchParams.get('only');
  const targets = only ? COHORTS.filter((c) => c.key === only) : COHORTS;

  const results = [];
  for (const c of targets) {
    try {
      results.push(await sendCohort(stripe, resendKey, c));
    } catch (e) {
      results.push({ cohort: c.key, error: (e as Error).message });
    }
  }
  const totals = results.reduce((acc: any, r: any) => {
    acc.scanned += r.scanned || 0;
    acc.sent += r.sent || 0;
    acc.skipped += r.skipped || 0;
    return acc;
  }, { scanned: 0, sent: 0, skipped: 0 });

  return jsonRes(200, { ok: true, results, totals });
}
