// ============================================================
// /api/cron/weekly-owner-highlight — 週次 ハイライト レポート (オーナー宛)
//
// オーナー指示 (2026-06-04 第 46 波 VVVVVV):
//   日曜 22 UTC (月曜 7:00 JST) に 過去 7 日 の KPI を 集計し、
//   AI に「今週 一番効いた 1 件 + 次週 注力 1 件」を 200 字 で要約。
//   Resend で オーナー宛 HTML メール + Slack に Block Kit 通知。
//
// Vercel Cron:
//   { "path": "/api/cron/weekly-owner-highlight", "schedule": "0 22 * * 0" }  // 日曜 22 UTC
//
// 必要 env:
//   STRIPE_SECRET_KEY                — 売上
//   UPSTASH_REDIS_REST_URL / _TOKEN  — オンボ完了 / エラー / 提案採用
//   CLAUDE_API_KEY                   — AI 要約 (失敗時 fallback)
//   RESEND_API_KEY + OWNER_EMAIL     — メール
//   SLACK_WEBHOOK_URL                — Slack
//   CRON_SECRET (任意)
// ============================================================

import Stripe from 'stripe';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const OK = !!(UP_URL && UP_TOK);

const RESEND = process.env.RESEND_API_KEY || '';
const SLACK = process.env.SLACK_WEBHOOK_URL || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'gauche.cellist1201@gmail.com';

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function up(cmd: (string | number)[]): Promise<any> {
  if (!OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
function parseHash(res: any): Record<string, number> {
  const out: Record<string, number> = {};
  const arr = res?.result;
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const v = Number(arr[i + 1]);
    if (Number.isFinite(v)) out[String(arr[i])] = v;
  }
  return out;
}
function yen(n: number): string { return '¥' + Math.round(n).toLocaleString('ja-JP'); }

interface WeeklyKpi {
  revenue7d: number; revenuePrev7d: number;
  charges7d: number;
  newSubs7d: number; canceled7d: number;
  onboard: { welcome: number; completed: number; pct: number };
  adopted7d: number; rejected7d: number;
  errors7d: number;
}

async function fetchStripe7d(stripe: Stripe): Promise<{ revenue7d: number; revenuePrev7d: number; charges7d: number; newSubs7d: number; canceled7d: number }> {
  const now = Date.now();
  const d7 = Math.floor((now - 7 * 86400_000) / 1000);
  const d14 = Math.floor((now - 14 * 86400_000) / 1000);
  const d0 = Math.floor(now / 1000);

  let revenue7d = 0;
  let revenuePrev7d = 0;
  let charges7d = 0;
  // 今週 + 先週 同時走査
  try {
    let sa: string | undefined = undefined;
    let safety = 0;
    while (safety++ < 50) {
      const page = await stripe.charges.list({
        created: { gte: d14, lte: d0 },
        limit: 100,
        ...(sa ? { starting_after: sa } : {}),
      });
      for (const c of page.data) {
        if (c.status !== 'succeeded' || c.currency !== 'jpy') continue;
        if (c.created >= d7) { revenue7d += c.amount; charges7d += 1; }
        else revenuePrev7d += c.amount;
      }
      if (!page.has_more) break;
      sa = page.data[page.data.length - 1].id;
    }
  } catch { /* */ }

  let newSubs7d = 0;
  try {
    let sa: string | undefined = undefined;
    let safety = 0;
    while (safety++ < 30) {
      const page = await stripe.subscriptions.list({
        created: { gte: d7 }, limit: 100,
        ...(sa ? { starting_after: sa } : {}),
      });
      newSubs7d += page.data.length;
      if (!page.has_more) break;
      sa = page.data[page.data.length - 1].id;
    }
  } catch { /* */ }

  let canceled7d = 0;
  try {
    let sa: string | undefined = undefined;
    let safety = 0;
    while (safety++ < 30) {
      const page = await stripe.subscriptions.list({
        status: 'canceled', limit: 100,
        ...(sa ? { starting_after: sa } : {}),
      });
      for (const s of page.data) {
        const ts = s.canceled_at || s.ended_at || 0;
        if (ts >= d7) canceled7d++;
      }
      if (!page.has_more) break;
      sa = page.data[page.data.length - 1].id;
    }
  } catch { /* */ }

  return { revenue7d: Math.round(revenue7d), revenuePrev7d: Math.round(revenuePrev7d), charges7d, newSubs7d, canceled7d };
}

async function fetch7dKpi(): Promise<WeeklyKpi> {
  let stripe = { revenue7d: 0, revenuePrev7d: 0, charges7d: 0, newSubs7d: 0, canceled7d: 0 };
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const s = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
      stripe = await fetchStripe7d(s);
    } catch { /* */ }
  }
  // オンボ
  let welcome = 0, completed = 0;
  for (let i = 0; i < 7; i++) {
    try {
      const r = await up(['HGETALL', `onboard:funnel:${dateOffsetDays(i)}`]);
      const h = parseHash(r);
      welcome += h.welcome || 0;
      completed += h.completed || 0;
    } catch { /* */ }
  }
  // 提案 採用 (集計は サーバ側 になく、 anomaly cta:ab を 簡易 集計 — fallback 0)
  const adopted7d = 0;
  const rejected7d = 0;
  // エラー 累計 (週次 差分 取れないので 当面 累計)
  let errors7d = 0;
  try {
    const r = await up(['HGETALL', 'err:count']);
    const h = parseHash(r);
    errors7d = Object.values(h).reduce((a, b) => a + b, 0);
  } catch { /* */ }

  return {
    revenue7d: stripe.revenue7d,
    revenuePrev7d: stripe.revenuePrev7d,
    charges7d: stripe.charges7d,
    newSubs7d: stripe.newSubs7d,
    canceled7d: stripe.canceled7d,
    onboard: { welcome, completed, pct: welcome > 0 ? Math.round((completed / welcome) * 1000) / 10 : 0 },
    adopted7d, rejected7d,
    errors7d,
  };
}

interface Highlight { thisWeek: string; nextWeek: string; }

async function aiHighlight(kpi: WeeklyKpi): Promise<Highlight | null> {
  if (!process.env.CLAUDE_API_KEY) return null;
  try {
    const deltaPct = kpi.revenuePrev7d > 0 ? Math.round(((kpi.revenue7d - kpi.revenuePrev7d) / kpi.revenuePrev7d) * 1000) / 10 : 0;
    const prompt = `週次 KPI:
- 過去 7 日 売上: ${yen(kpi.revenue7d)} (前週 ${yen(kpi.revenuePrev7d)}, ${deltaPct >= 0 ? '+' : ''}${deltaPct}%)
- 課金 件数: ${kpi.charges7d}
- 新規 サブスク: ${kpi.newSubs7d}
- 解約: ${kpi.canceled7d}
- オンボ 完了率: ${kpi.onboard.pct}% (${kpi.onboard.completed}/${kpi.onboard.welcome})
- エラー累計: ${kpi.errors7d}

純 JSON で 返してください:
{
  "thisWeek": "今週 一番 効いた 1 件 (100 字、数字必須、断言を避ける)",
  "nextWeek": "次週 注力 すべき 1 件 (100 字、具体的 アクション)"
}

ルール: 嘘禁止 / 横文字 過多禁止 / 200 字 合計 で 簡潔に。`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json() as { content?: Array<{ text?: string }> };
    const raw = (j.content?.[0]?.text || '').trim();
    const m = raw.replace(/```(?:json)?\s*\n?|```/g, '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]) as Highlight;
  } catch { return null; }
}

function fallbackHighlight(kpi: WeeklyKpi): Highlight {
  const delta = kpi.revenuePrev7d > 0 ? ((kpi.revenue7d - kpi.revenuePrev7d) / kpi.revenuePrev7d) * 100 : 0;
  const thisWeek = kpi.revenue7d > kpi.revenuePrev7d
    ? `売上 ${yen(kpi.revenue7d)} (前週比 ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%)。新規 ${kpi.newSubs7d} 件で勢いあり。`
    : `売上 ${yen(kpi.revenue7d)} (前週 ${yen(kpi.revenuePrev7d)})。オンボ完了 ${kpi.onboard.pct}% を 数字で 確認。`;
  const nextWeek = kpi.canceled7d > 0
    ? `解約 ${kpi.canceled7d} 件 の理由を 個別 ヒアリング (返信 < 24h) → 値段 / 機能 / オンボ どこで 折れたか 数字で 把握。`
    : kpi.onboard.pct < 60
      ? `オンボ 完了率 ${kpi.onboard.pct}% — /master/onboard-funnel で 最大脱落 ステップ を確認 → 改善案 1 つに 絞って 来週 反映。`
      : `営業 5 件 (enrichLeadList → draftSalesEmail) を 月曜午前 に終え、週中盤 で 数字 が動くか 確認。`;
  return { thisWeek: thisWeek.slice(0, 100), nextWeek: nextWeek.slice(0, 100) };
}

function buildEmailHtml(kpi: WeeklyKpi, hl: Highlight, src: 'ai' | 'fallback'): string {
  const delta = kpi.revenuePrev7d > 0 ? ((kpi.revenue7d - kpi.revenuePrev7d) / kpi.revenuePrev7d) * 100 : 0;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,'Hiragino Sans','Yu Gothic',sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#6366F1,#A855F7);padding:28px;color:#fff">
    <h1 style="margin:0;font-size:22px;font-weight:900">📰 今週 の ハイライト (オーナー向け)</h1>
    <p style="margin:6px 0 0;font-size:13px;opacity:.95">過去 7 日 + 来週の 注力 1 件 (${src === 'ai' ? '🤖 AI 要約' : '📋 ルール fallback'})</p>
  </div>
  <div style="padding:28px;color:#1F1A2E;line-height:1.7;font-size:14px">
    <div style="background:#F5F3FF;border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:16px 18px;margin-bottom:14px">
      <div style="font-size:11px;color:#6366F1;font-weight:800;letter-spacing:.08em;margin-bottom:6px">🎯 今週 一番 効いた</div>
      <div style="font-size:14px;line-height:1.7">${hl.thisWeek}</div>
    </div>
    <div style="background:#FEF3C7;border:1px solid rgba(251,191,36,0.3);border-radius:12px;padding:16px 18px;margin-bottom:18px">
      <div style="font-size:11px;color:#B45309;font-weight:800;letter-spacing:.08em;margin-bottom:6px">🚀 次週 の 注力</div>
      <div style="font-size:14px;line-height:1.7">${hl.nextWeek}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:14px">
      <thead>
        <tr style="color:#8A8593;text-align:left;font-weight:700">
          <th style="padding:6px 0">指標</th>
          <th style="padding:6px 0;text-align:right">今週</th>
          <th style="padding:6px 0;text-align:right">前週 / 補足</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding:6px 0">売上</td><td style="text-align:right;font-weight:800">${yen(kpi.revenue7d)}</td><td style="text-align:right;color:${delta>=0?'#10B981':'#EF4444'}">${yen(kpi.revenuePrev7d)} / ${delta>=0?'+':''}${delta.toFixed(1)}%</td></tr>
        <tr><td style="padding:6px 0">課金件数</td><td style="text-align:right;font-weight:800">${kpi.charges7d}</td><td style="text-align:right">—</td></tr>
        <tr><td style="padding:6px 0">新規サブスク</td><td style="text-align:right;font-weight:800">${kpi.newSubs7d}</td><td style="text-align:right">—</td></tr>
        <tr><td style="padding:6px 0">解約</td><td style="text-align:right;font-weight:800;color:${kpi.canceled7d>0?'#EF4444':'#10B981'}">${kpi.canceled7d}</td><td style="text-align:right">—</td></tr>
        <tr><td style="padding:6px 0">オンボ完了率</td><td style="text-align:right;font-weight:800">${kpi.onboard.pct}%</td><td style="text-align:right">${kpi.onboard.completed}/${kpi.onboard.welcome}</td></tr>
        <tr><td style="padding:6px 0">エラー (累計)</td><td style="text-align:right;font-weight:800">${kpi.errors7d}</td><td style="text-align:right">—</td></tr>
      </tbody>
    </table>

    <p style="margin-top:18px;text-align:center">
      <a href="https://core-prism-app.vercel.app/master/revenue-dashboard" style="display:inline-block;background:linear-gradient(135deg,#6366F1,#A855F7);color:#fff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:800;font-size:13px">📊 ダッシュで詳細を見る →</a>
    </p>
    <p style="font-size:11px;color:#999;margin:24px 0 0;border-top:1px solid #eee;padding-top:14px">
      毎週 月曜 7:00 (JST) に 自動 配信 / Vercel Cron weekly-owner-highlight。
    </p>
  </div>
</div></body></html>`;
}

async function notifySlack(kpi: WeeklyKpi, hl: Highlight, src: 'ai' | 'fallback') {
  if (!SLACK) return;
  const delta = kpi.revenuePrev7d > 0 ? ((kpi.revenue7d - kpi.revenuePrev7d) / kpi.revenuePrev7d) * 100 : 0;
  const text = `📰 CORE 週次 ハイライト — 売上 ${yen(kpi.revenue7d)} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)`;
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: '📰 今週 の ハイライト', emoji: true } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*売上 (7日)*\n${yen(kpi.revenue7d)}` },
        { type: 'mrkdwn', text: `*前週比*\n${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` },
        { type: 'mrkdwn', text: `*新規 サブスク*\n${kpi.newSubs7d}` },
        { type: 'mrkdwn', text: `*解約*\n${kpi.canceled7d}` },
        { type: 'mrkdwn', text: `*オンボ完了率*\n${kpi.onboard.pct}%` },
        { type: 'mrkdwn', text: `*エラー累計*\n${kpi.errors7d}` },
      ],
    },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: `*🎯 今週 効いた*\n${hl.thisWeek}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `*🚀 次週 注力*\n${hl.nextWeek}` } },
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: '📊 ダッシュを開く', emoji: true }, url: 'https://core-prism-app.vercel.app/master/revenue-dashboard' },
      ],
    },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `_${src === 'ai' ? '🤖 AI 要約' : '📋 ルール fallback'} · 毎週 月曜 7:00 JST_` }] },
  ];
  try {
    await fetch(SLACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    });
  } catch { /* */ }
}

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  const kpi = await fetch7dKpi();
  const aiHL = await aiHighlight(kpi);
  const hl = aiHL || fallbackHighlight(kpi);
  const src: 'ai' | 'fallback' = aiHL ? 'ai' : 'fallback';

  if (dryRun) {
    return jsonRes(200, { ok: true, dryRun: true, kpi, hl, src });
  }

  let emailOk = false;
  if (RESEND && OWNER_EMAIL) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'CORE Prism <noreply@resend.dev>',
          to: [OWNER_EMAIL],
          subject: `📰 今週 の ハイライト — 売上 ${yen(kpi.revenue7d)} / 解約 ${kpi.canceled7d}`,
          html: buildEmailHtml(kpi, hl, src),
        }),
      });
      emailOk = res.ok;
    } catch { /* */ }
  }
  await notifySlack(kpi, hl, src);

  return jsonRes(200, { ok: true, kpi, hl, src, emailSent: emailOk, slackSent: !!SLACK });
}
