// ============================================================
// /api/cron/weekly-diary — 毎週日曜 21:00 (JST) に「今週の日記」下書きをメール
//
// オーナー指示 (2026-06-04 第 18 波 RRR):
//   Stripe / CRM / タスク完了 を AI で要約して下書きメール。
//
// 集計対象 (オーナー1人想定 / 今週 = 日曜 0:00 - 今):
//   - Stripe 今週の Charges (件数 + 金額 + 上位 3 件)
//   - Stripe 今週の new Subscriptions
//   - Upstash 今週 active deviceId 数 (DAU 合計の代替)
//   - エラー件数 (errlog:<date>:count から合算)
//
// vercel.json 推奨 cron: "0 12 * * 0" (UTC 日曜 12:00 = JST 21:00)
// ============================================================

import Stripe from 'stripe';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

function jsonRes(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function up(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

function startOfWeekUtc(now: Date): Date {
  // 今週 = 過去 7 日 (簡易) — 「日曜 0:00 JST 」厳密化は将来
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 7);
  return d;
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function aiDraft(systemPrompt: string, summary: string, apiOrigin: string): Promise<string> {
  try {
    const res = await fetch(`${apiOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content: summary }],
      }),
    });
    if (!res.ok) throw new Error(`ai ${res.status}`);
    const j = await res.json() as { content?: Array<{ text?: string }> };
    return j.content?.[0]?.text || '(AI 下書きが空でした)';
  } catch (e) {
    return `(AI 下書き失敗: ${(e as Error).message})`;
  }
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
  if (!stripeKey || !resendKey) {
    return jsonRes(503, { ok: false, error: 'env_missing', hint: 'STRIPE_SECRET_KEY / RESEND_API_KEY が必要' });
  }
  const ownerEmail = process.env.OWNER_EMAIL || 'gauche.cellist1201@gmail.com';

  const now = new Date();
  const from = startOfWeekUtc(now);

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  // ─── Stripe 今週 ───
  let chargesCount = 0;
  let chargesYen = 0;
  const topCharges: Array<{ amount: number; desc?: string; created: number }> = [];
  let newSubs = 0;
  try {
    const charges = await stripe.charges.list({
      created: { gte: Math.floor(from.getTime() / 1000) },
      limit: 100,
    });
    for (const c of charges.data) {
      if (c.status !== 'succeeded') continue;
      if (c.currency !== 'jpy') continue;
      chargesCount++;
      chargesYen += c.amount;
      topCharges.push({ amount: c.amount, desc: c.description || undefined, created: c.created });
    }
    topCharges.sort((a, b) => b.amount - a.amount);
    topCharges.splice(3); // 上位 3 件

    const subs = await stripe.subscriptions.list({
      created: { gte: Math.floor(from.getTime() / 1000) },
      limit: 100,
    });
    newSubs = subs.data.length;
  } catch (e) {
    console.error('[weekly-diary] stripe', (e as Error).message);
  }

  // ─── Upstash: DAU + エラー ───
  let totalActive = 0;
  let totalErrors = 0;
  if (UPSTASH_OK) {
    for (let i = 0; i < 7; i++) {
      const d = dateOffsetDays(i);
      try {
        const a = await up(['SCARD', `active:${d}`]);
        totalActive += Number((a as { result?: number }).result || 0);
      } catch { /* */ }
      try {
        const e = await up(['HVALS', `errlog:${d}:count`]);
        const arr = (e as { result?: string[] }).result || [];
        for (const v of arr) totalErrors += Number(v) || 0;
      } catch { /* */ }
    }
  }

  // ─── AI に下書きしてもらう ───
  const summary = [
    `■ 今週の数字 (${from.toISOString().slice(0, 10)} - ${now.toISOString().slice(0, 10)})`,
    `- Stripe 売上: ¥${chargesYen.toLocaleString('ja-JP')} (${chargesCount} 件)`,
    `- 新規サブスク: ${newSubs} 件`,
    `- 期間中 DAU 合計 (述べ): ${totalActive}`,
    `- フロントエラー (週合計): ${totalErrors}`,
    topCharges.length ? `- 上位 charge: ${topCharges.map(t => `¥${t.amount.toLocaleString('ja-JP')}${t.desc ? ` (${t.desc})` : ''}`).join(' / ')}` : '',
  ].filter(Boolean).join('\n');

  const apiOrigin = new URL(req.url).origin;
  const draft = await aiDraft(
    'あなたは事業のオーナーの 1 週間日記の下書きアシスタントです。次の数字をもとに、「今週やったこと」「気づいたこと」「来週やりたいこと」の 3 セクションで日記の下書きを 400 字程度で書いてください。誇張せず、数字に忠実に。',
    summary,
    apiOrigin,
  );

  // ─── メール送付 ───
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,'Hiragino Sans','Yu Gothic',sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
<div style="background:linear-gradient(135deg,#A78BFA,#F472B6);padding:28px 32px;color:#fff">
<h1 style="margin:0;font-size:22px;font-weight:900">📓 今週の日記 下書き</h1>
<p style="margin:6px 0 0;font-size:14px;opacity:.95">${from.toISOString().slice(0, 10)} 〜 ${now.toISOString().slice(0, 10)}</p>
</div>
<div style="padding:24px 32px;color:#1F1A2E">
<h2 style="margin:0 0 12px;font-size:15px;font-weight:800">数字 (素データ)</h2>
<pre style="background:#FAF7F0;padding:14px 16px;border-radius:10px;font-family:Menlo,monospace;font-size:12px;color:#1F1A2E;line-height:1.7;margin:0 0 24px;white-space:pre-wrap">${summary.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c))}</pre>
<h2 style="margin:0 0 12px;font-size:15px;font-weight:800">AI 下書き</h2>
<div style="background:#F0F4FA;padding:16px 18px;border-radius:10px;font-size:14px;line-height:1.85;color:#1F1A2E;white-space:pre-wrap;margin-bottom:16px">${draft.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c))}</div>
<p style="font-size:11px;color:#999;margin:24px 0 0;line-height:1.7">
このメールは毎週日曜 21:00 (JST) に Vercel Cron から自動送信されています。<br />
不要な場合は vercel.json の crons から /api/cron/weekly-diary を削除してください。
</p>
</div></div></body></html>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CORE Prism <noreply@resend.dev>',
        to: [ownerEmail],
        subject: `📓 今週の日記 下書き (${from.toISOString().slice(0, 10)} - ${now.toISOString().slice(0, 10)})`,
        html,
      }),
    });
  } catch (e) {
    return jsonRes(500, { ok: false, error: (e as Error).message });
  }

  return jsonRes(200, { ok: true, chargesYen, chargesCount, newSubs, totalActive, totalErrors });
}
