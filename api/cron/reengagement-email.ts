// ============================================================
// /api/cron/reengagement-email — 14 日 ご無沙汰 ユーザーに「待っています」メール
//
// オーナー指示 (2026-06-04 第 13 波 BBB):
//   14 日間 アクティビティが無い既存ユーザーへ Resend で再エンゲージメント。
//
// アクティビティ源:
//   Stripe Customer の last_charge (succeeded) を「最終アクティブ」と見なす。
//   匿名 DAU (RR) と紐付かないため、現状の最善近似。
//
// 実装ガード:
//   - 1 ユーザーにつき 30 日に 1 回まで (Upstash `reengage:sent:<customer>` TTL 30 日)
//   - 1 実行で最大 30 件まで (cron 1 回 = 30 通の安全弁)
//   - RESEND / Stripe / Upstash いずれか欠ければ 503
//
// vercel.json 推奨 cron: "0 0 * * 1" (毎週月曜 JST 9:00 = UTC 月曜 0:00)
// ============================================================

import Stripe from 'stripe';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

const STALE_DAYS = 14;
const MAX_PER_RUN = 30;
const SUPPRESS_TTL_SEC = 30 * 86400; // 30 日間 再送抑止

interface Candidate {
  customerId: string;
  email: string;
  lastChargeAt: number | null; // unix ms; null = 一度も成功 charge なし (新規顧客)
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

function jsonRes(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sendResendEmail(apiKey: string, to: string, subject: string, html: string): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'CORE Prism <noreply@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  });
}

function reengagementHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#FBBF24,#A78BFA,#F472B6);padding:32px;color:#fff;text-align:center">
      <h1 style="margin:0;font-size:24px;font-weight:900;letter-spacing:-.3px">最近どうですか?</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:.95">13 役員 + 採用 1 名、あなたを待っています。</p>
    </div>
    <div style="padding:28px 32px;color:#1F1A2E;line-height:1.7;font-size:14px">
      <p style="margin:0 0 16px">2 週間ほどログインがなかったので、お元気かなと思ってご連絡しました。</p>
      <p style="margin:0 0 16px">
        この間も <strong style="color:#1F1A2E">CORE Prism の 14 役員</strong> は黙々と動ける状態で待機しています。
        — 経営判断、営業文の下書き、財務サマリ、デザイン提案、SNS 投稿、エラーチェック、採用相場、すべて。
      </p>
      <div style="background:#FAF7F0;padding:16px 18px;border-radius:10px;margin:16px 0;font-size:13px;line-height:1.8">
        <strong>👋 戻ってきたら、まず試してほしい 3 つ</strong><br />
        ① 「今週の優先 3 つを決める」を CEO に頼む<br />
        ② 「営業先 5 社に提案文を作る」を CSO に頼む<br />
        ③ 「今月の数字を整理する」を CFO に頼む
      </div>
      <div style="margin-top:24px;text-align:center">
        <a href="https://core-prism-app.vercel.app/?utm_source=reengagement" style="display:inline-block;background:linear-gradient(135deg,#FBBF24,#E84B97);color:#fff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:800;font-size:14px;box-shadow:0 8px 20px rgba(232,75,151,.3)">
          ✨ いま開く
        </a>
      </div>
      <p style="font-size:11px;color:#999;margin:32px 0 0;line-height:1.7;border-top:1px solid #eee;padding-top:16px">
        このメールは 14 日間アクティビティが無い場合に、月 1 回まで自動送信されます。<br />
        もう不要な場合は、お手数ですが <a href="mailto:gauche.cellist1201@gmail.com?subject=配信停止希望" style="color:#999">こちらから</a> ご連絡ください。
      </p>
    </div>
  </div>
</body></html>`;
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
      hint: 'STRIPE_SECRET_KEY / RESEND_API_KEY / UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN を Vercel env に追加してください',
      have: { stripeKey: !!stripeKey, resendKey: !!resendKey, upstash: UPSTASH_OK },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });
  const cutoff = Date.now() - STALE_DAYS * 86400_000;

  // Stripe Customers をペジ走査 (最大 500 顧客で打ち切り — 安全弁)
  const candidates: Candidate[] = [];
  let starting_after: string | undefined;
  let walked = 0;
  while (walked < 500) {
    const page = await stripe.customers.list({ limit: 100, ...(starting_after ? { starting_after } : {}) });
    for (const c of page.data) {
      walked++;
      if (!c.email) continue;
      // 過去 14 日に成功 charge が 1 件もないか確認
      let lastChargeAt: number | null = null;
      try {
        const charges = await stripe.charges.list({ customer: c.id, limit: 5 });
        for (const ch of charges.data) {
          if (ch.status === 'succeeded' && (lastChargeAt === null || (ch.created * 1000) > lastChargeAt)) {
            lastChargeAt = ch.created * 1000;
          }
        }
      } catch { /* */ }
      // 最終 charge が cutoff より古い (= 14 日無活動) なら候補に
      if (lastChargeAt !== null && lastChargeAt < cutoff) {
        candidates.push({ customerId: c.id, email: c.email, lastChargeAt });
      }
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1]?.id;
    if (!starting_after) break;
  }

  // 候補から「直近 30 日以内に既に送ったユーザー」を除外
  let sent = 0;
  let skipped = 0;
  for (const cand of candidates) {
    if (sent >= MAX_PER_RUN) break;
    try {
      const seenRes = await up(['GET', `reengage:sent:${cand.customerId}`]);
      if ((seenRes as { result?: string | null }).result) {
        skipped++;
        continue;
      }
    } catch { /* */ }
    try {
      await sendResendEmail(resendKey, cand.email, '最近どうですか? — CORE Prism の 13 役員が待っています', reengagementHtml());
      await up(['SET', `reengage:sent:${cand.customerId}`, new Date().toISOString(), 'EX', SUPPRESS_TTL_SEC]);
      sent++;
    } catch (e) {
      console.error('[reengage] send failed', cand.customerId, (e as Error).message);
    }
  }

  return jsonRes(200, {
    ok: true,
    walked,
    candidates: candidates.length,
    sent,
    skipped,
    cap: MAX_PER_RUN,
    cutoffDays: STALE_DAYS,
  });
}
