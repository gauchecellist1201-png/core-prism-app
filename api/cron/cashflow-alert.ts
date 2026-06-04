// ============================================================
// /api/cron/cashflow-alert — 資金繰り 警告 (オーナー宛)
//
// オーナー指示 (2026-06-04 第 41 波 GGGGGG):
//   毎朝 UTC 22 (JST 7) に /api/master/cashflow-forecast を 内部叩きで参照し、
//   daysUntilZero <= 45 なら オーナー宛 メール (Resend) + Slack に通知。
//   重複防止: cashflow:alert:<YYYY-MM-DD> (TTL 26h)
//
// Vercel Cron:
//   { "path": "/api/cron/cashflow-alert", "schedule": "0 22 * * *" }
//
// 必要 env:
//   STRIPE_SECRET_KEY                 — MRR 計算
//   CASH_FIXED_MONTHLY                — 月次 固定費
//   CASH_CURRENT_BALANCE              — 現在 残高 (cron は env 既定値で計算)
//   RESEND_API_KEY + OWNER_EMAIL      — メール
//   SLACK_WEBHOOK_URL                 — 通知
//   UPSTASH_REDIS_REST_URL / TOKEN    — 重複防止
//   CRON_SECRET (任意)                — Bearer 検証
// ============================================================

import Stripe from 'stripe';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const SLACK = process.env.SLACK_WEBHOOK_URL || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'gauche.cellist1201@gmail.com';

const WARN_DAYS = Number(process.env.CASHFLOW_WARN_DAYS || '45');

function json(body: unknown, status = 200): Response {
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

function yen(n: number): string {
  const sign = n < 0 ? '-¥' : '¥';
  return sign + Math.abs(Math.round(n)).toLocaleString('ja-JP');
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function monthlyValueJpy(s: Stripe.Subscription): number {
  let sum = 0;
  for (const item of s.items.data) {
    const p = item.price;
    if (!p || p.currency !== 'jpy') continue;
    const interval = p.recurring?.interval;
    const intervalCount = p.recurring?.interval_count || 1;
    const unit = p.unit_amount || 0;
    const qty = item.quantity || 1;
    let perMonth = 0;
    if (interval === 'month') perMonth = (unit * qty) / intervalCount;
    else if (interval === 'year') perMonth = (unit * qty) / (12 * intervalCount);
    else if (interval === 'week') perMonth = (unit * qty) * 4.345 / intervalCount;
    else if (interval === 'day') perMonth = (unit * qty) * 30 / intervalCount;
    sum += perMonth;
  }
  return Math.round(sum);
}

async function calcMrr(stripe: Stripe): Promise<number> {
  let mrr = 0;
  let starting_after: string | undefined = undefined;
  let safety = 0;
  while (safety++ < 100) {
    const page = await stripe.subscriptions.list({
      status: 'active', limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });
    for (const s of page.data) mrr += monthlyValueJpy(s);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return mrr;
}

interface Forecast {
  mrrJpy: number;
  fixedMonthlyJpy: number;
  openingBalanceJpy: number;
  dailyNet: number;
  daysUntilZero?: number;
  zeroDate?: string;
}

async function buildForecast(): Promise<Forecast> {
  const fixedMonthlyJpy = Number(process.env.CASH_FIXED_MONTHLY || '0');
  const openingBalanceJpy = Number(process.env.CASH_CURRENT_BALANCE || '0');
  let mrrJpy = 0;
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
      mrrJpy = await calcMrr(stripe);
    } catch { mrrJpy = 0; }
  }
  const dailyNet = Math.round((mrrJpy - fixedMonthlyJpy) / 30);
  let daysUntilZero: number | undefined;
  let zeroDate: string | undefined;
  let bal = openingBalanceJpy;
  for (let i = 0; i <= 365; i++) {
    if (i > 0) bal += dailyNet;
    if (bal <= 0 && daysUntilZero === undefined) {
      daysUntilZero = i;
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + i);
      zeroDate = d.toISOString().slice(0, 10);
      break;
    }
  }
  return { mrrJpy, fixedMonthlyJpy, openingBalanceJpy, dailyNet, daysUntilZero, zeroDate };
}

// ZZZZZZ (2026-06-04): daysUntilZero ≤ 30 で AI に 24 時間 以内 にやる 3 アクション (30字×3)
async function aiUrgentActions(f: Forecast): Promise<string[] | null> {
  if (!process.env.CLAUDE_API_KEY) return null;
  try {
    const prompt = `現在 状況:
- 残高: ${yen(f.openingBalanceJpy)}
- MRR: ${yen(f.mrrJpy)}
- 固定費: ${yen(f.fixedMonthlyJpy)} / 月
- 1 日 純増減: ${yen(f.dailyNet)}
- 残高ゼロ到達: ${f.daysUntilZero} 日後 (${f.zeroDate})

オーナー (株式会社CORE 代表 井出直毅) が 24 時間 以内 に やる 3 アクション を 純 JSON で 返してください。

形式:
{ "actions": ["30 字以内", "30 字以内", "30 字以内"] }

ルール: 嘘禁止 / 抽象禁止 (例: 「営業を頑張る」 NG) / 具体的に (例: 「営業 5 件 に DM」 OK) / 数字 を 1 つ以上 入れる。`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json() as { content?: Array<{ text?: string }> };
    const raw = (j.content?.[0]?.text || '').trim();
    const m = raw.replace(/```(?:json)?\s*\n?|```/g, '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as { actions?: string[] };
    return parsed.actions?.slice(0, 3).map((s) => String(s).slice(0, 40)) || null;
  } catch { return null; }
}

function buildEmailHtml(f: Forecast, urgent?: string[] | null): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,'Hiragino Sans','Yu Gothic',sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#F87171,#DC2626);padding:28px;color:#fff">
    <h1 style="margin:0;font-size:22px;font-weight:900">🚨 資金繰り 警告</h1>
    <p style="margin:6px 0 0;font-size:14px;opacity:.95">残高 0 まで あと ${f.daysUntilZero} 日 (${f.zeroDate}) です。</p>
  </div>
  <div style="padding:28px;color:#1F1A2E;line-height:1.7;font-size:14px">
    <p style="margin:0 0 14px">井出さん、おはようございます。<br />本日 (${new Date().toLocaleString('ja-JP')}) の 自動予測 が 警告 ラインに 到達しました。</p>
    <div style="background:#FEF2F2;border:1px solid #FEE2E2;border-radius:12px;padding:16px 18px;margin:14px 0">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:4px 0;color:#7F1D1D;font-weight:700">現在 残高</td><td style="text-align:right;padding:4px 0">${yen(f.openingBalanceJpy)}</td></tr>
        <tr><td style="padding:4px 0;color:#7F1D1D;font-weight:700">MRR (月収入)</td><td style="text-align:right;padding:4px 0">${yen(f.mrrJpy)}</td></tr>
        <tr><td style="padding:4px 0;color:#7F1D1D;font-weight:700">月次 固定費</td><td style="text-align:right;padding:4px 0">${yen(f.fixedMonthlyJpy)}</td></tr>
        <tr><td style="padding:4px 0;color:#7F1D1D;font-weight:700">1 日 純増減</td><td style="text-align:right;padding:4px 0;color:${f.dailyNet < 0 ? '#DC2626' : '#16A34A'}">${yen(f.dailyNet)}</td></tr>
        <tr><td style="padding:4px 0;color:#7F1D1D;font-weight:700">残高ゼロ 到達日</td><td style="text-align:right;padding:4px 0;color:#DC2626;font-weight:800">${f.zeroDate} (あと ${f.daysUntilZero} 日)</td></tr>
      </table>
    </div>
    ${urgent && urgent.length > 0 ? `
    <div style="background:#FEF3C7;border:1px solid rgba(251,191,36,0.5);border-radius:12px;padding:16px 18px;margin:14px 0">
      <div style="font-size:11px;color:#B45309;font-weight:800;letter-spacing:.08em;margin-bottom:8px">🚀 24 時間 以内 にやる 3 アクション (AI)</div>
      <ol style="margin:0;padding-left:20px;line-height:1.9;color:#1F1A2E">
        ${urgent.map((a) => `<li><strong>${esc(a)}</strong></li>`).join('')}
      </ol>
    </div>
    ` : ''}
    <p style="margin:14px 0 0"><strong>打ち手 (優先順):</strong></p>
    <ul style="margin:8px 0 0;padding-left:18px;line-height:1.8">
      <li>営業: 営業先 リスト → AI 営業メール (scripts/draftSalesEmail.mjs) で 100 通 送信</li>
      <li>料金: 既存顧客に 値上げ案内 or 上位プラン 提案 (BBBB クーポン 一時停止)</li>
      <li>固定費: env CASH_FIXED_MONTHLY を見直し、サブスク 即解約</li>
    </ul>
    <p style="margin-top:18px;text-align:center">
      <a href="https://core-prism-app.vercel.app/master/cashflow-forecast" style="display:inline-block;background:linear-gradient(135deg,#F87171,#DC2626);color:#fff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:800;font-size:13px">📊 ダッシュで詳細を見る →</a>
    </p>
    <p style="font-size:11px;color:#999;margin:24px 0 0;border-top:1px solid #eee;padding-top:14px">
      このメール は CORE Prism の 資金繰り cron が 1 日 1 回 (JST 7:00) 自動送信しています。<br />
      警告 閾値: daysUntilZero ≤ ${WARN_DAYS} 日 (env CASHFLOW_WARN_DAYS で 調整可)
    </p>
  </div>
</div></body></html>`;
}

async function notifySlack(f: Forecast, urgent?: string[] | null): Promise<void> {
  if (!SLACK) return;
  const text = `🚨 CORE 資金繰り 警告 — 残高 0 まで あと ${f.daysUntilZero} 日 (${f.zeroDate})`;
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: '🚨 資金繰り 警告', emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `*残高 0 到達*: ${f.zeroDate} (あと <${f.daysUntilZero}> 日)\n_閾値 ${WARN_DAYS} 日_` } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*現在残高*\n${yen(f.openingBalanceJpy)}` },
        { type: 'mrkdwn', text: `*MRR*\n${yen(f.mrrJpy)}` },
        { type: 'mrkdwn', text: `*固定費 (月)*\n${yen(f.fixedMonthlyJpy)}` },
        { type: 'mrkdwn', text: `*1 日 純増減*\n${yen(f.dailyNet)}` },
      ],
    },
  ];
  // ZZZZZZ (2026-06-04): AI 推奨 3 アクション (緊急時のみ)
  if (urgent && urgent.length > 0) {
    blocks.push(
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: '*🚀 24 時間 以内 にやる 3 アクション (AI 推奨)*' } },
      ...urgent.slice(0, 3).map((a, i) => ({
        type: 'section',
        text: { type: 'mrkdwn', text: `*${i + 1}.* ${a}` },
      })),
    );
  }
  blocks.push({
    type: 'actions',
    elements: [
      { type: 'button', text: { type: 'plain_text', text: '📊 ダッシュを開く', emoji: true }, url: 'https://core-prism-app.vercel.app/master/cashflow-forecast', style: 'danger' },
    ],
  });
  try {
    await fetch(SLACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    });
  } catch { /* */ }
}

async function notifyEmail(f: Forecast, urgent?: string[] | null): Promise<boolean> {
  if (!RESEND_KEY || !OWNER_EMAIL) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CORE Prism <noreply@resend.dev>',
        to: [OWNER_EMAIL],
        subject: `🚨 資金繰り 警告 — あと ${f.daysUntilZero} 日 で 残高 0 (${f.zeroDate})`,
        html: buildEmailHtml(f, urgent),
      }),
    });
    return res.ok;
  } catch { return false; }
}

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const forceSend = url.searchParams.get('force') === '1';

  const f = await buildForecast();
  const trigger = f.daysUntilZero !== undefined && f.daysUntilZero <= WARN_DAYS;

  if (!trigger && !forceSend) {
    return json({ ok: true, triggered: false, daysUntilZero: f.daysUntilZero, threshold: WARN_DAYS, forecast: f });
  }

  // 重複防止 — 同じ日に 1 回まで (force で 上書き可)
  const today = new Date().toISOString().slice(0, 10);
  const guard = `cashflow:alert:${today}`;
  if (UPSTASH_OK && !forceSend) {
    try {
      const seen = await up(['GET', guard]);
      if ((seen as { result?: string | null }).result) {
        return json({ ok: true, skipped: 'already_sent_today', daysUntilZero: f.daysUntilZero });
      }
    } catch { /* */ }
  }

  // ZZZZZZ (2026-06-04): daysUntilZero ≤ 30 で AI に 24 時間 3 アクション
  const URGENT_DAYS = Number(process.env.CASHFLOW_URGENT_DAYS || '30');
  let urgent: string[] | null = null;
  if (f.daysUntilZero !== undefined && f.daysUntilZero <= URGENT_DAYS) {
    urgent = await aiUrgentActions(f);
  }

  if (dryRun) {
    return json({ ok: true, dryRun: true, would_send: true, forecast: f, urgent });
  }

  const [emailOk] = await Promise.all([
    notifyEmail(f, urgent).catch(() => false),
    notifySlack(f, urgent).catch(() => { /* */ }),
  ]);

  if (UPSTASH_OK) {
    try { await up(['SET', guard, new Date().toISOString(), 'EX', 26 * 3600]); } catch { /* */ }
  }

  return json({ ok: true, triggered: true, emailSent: emailOk, slackSent: !!SLACK, daysUntilZero: f.daysUntilZero, zeroDate: f.zeroDate, urgent });
}
