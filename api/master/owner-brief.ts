// ============================================================
// /api/master/owner-brief — オーナー向け 「今日 やるべき 3 件」
//
// オーナー指示 (2026-06-04 第 45 波 TTTTTT):
//   Stripe 売上 + オンボ完了率 + 最新 anomaly + 提案履歴 を 統合し、
//   AI に「今日 オーナーが 30 分以内 に やるべき 3 件」を依頼。
//
// GET (x-master-key)
//   レスポンス:
//   {
//     asOf, kpi: { revenueToday, mrr, churnPct, onboardCompletionPct, errors24h },
//     todos: [{ title, why, action, cxo? }, ...3 件],
//     note
//   }
// ============================================================

import Stripe from 'stripe';
import { logMasterAudit } from '../_lib/masterAudit';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const OK = !!(UP_URL && UP_TOK);

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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

async function fetchStripeToday(stripe: Stripe): Promise<{ revenueToday: number; mrr: number; churnPct: number }> {
  // 今日 (UTC) の Charges 合計
  const startOfDay = (() => {
    const d = new Date();
    return Math.floor(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).getTime() / 1000);
  })();
  let revenue = 0;
  try {
    const page = await stripe.charges.list({ created: { gte: startOfDay }, limit: 100 });
    for (const c of page.data) {
      if (c.status !== 'succeeded' || c.currency !== 'jpy') continue;
      revenue += c.amount;
    }
  } catch { /* */ }
  // MRR
  let mrr = 0;
  let activeCount = 0;
  try {
    let starting_after: string | undefined = undefined;
    let safety = 0;
    while (safety++ < 100) {
      const page = await stripe.subscriptions.list({ status: 'active', limit: 100, ...(starting_after ? { starting_after } : {}) });
      for (const s of page.data) {
        activeCount += 1;
        for (const item of s.items.data) {
          const p = item.price;
          if (!p || p.currency !== 'jpy') continue;
          const interval = p.recurring?.interval;
          const intervalCount = p.recurring?.interval_count || 1;
          const unit = p.unit_amount || 0;
          const qty = item.quantity || 1;
          if (interval === 'month') mrr += (unit * qty) / intervalCount;
          else if (interval === 'year') mrr += (unit * qty) / (12 * intervalCount);
        }
      }
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1].id;
    }
  } catch { /* */ }
  // Churn (当月)
  let canceled = 0;
  try {
    const monthStart = Math.floor(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).getTime() / 1000);
    let starting_after: string | undefined = undefined;
    let safety = 0;
    while (safety++ < 50) {
      const page = await stripe.subscriptions.list({ status: 'canceled', limit: 100, ...(starting_after ? { starting_after } : {}) });
      for (const s of page.data) {
        const ts = s.canceled_at || s.ended_at || 0;
        if (ts >= monthStart) canceled++;
      }
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1].id;
    }
  } catch { /* */ }
  const base = canceled + activeCount;
  const churnPct = base > 0 ? Math.round((canceled / base) * 1000) / 10 : 0;
  return { revenueToday: Math.round(revenue), mrr: Math.round(mrr), churnPct };
}

async function fetchOnboardCompletionPct(): Promise<number> {
  if (!OK) return 0;
  let totalW = 0, totalC = 0;
  for (let i = 0; i < 7; i++) {
    try {
      const d = dateOffsetDays(i);
      const r = await up(['HGETALL', `onboard:funnel:${d}`]);
      const h = parseHash(r);
      totalW += h.welcome || 0;
      totalC += h.completed || 0;
    } catch { /* */ }
  }
  return totalW > 0 ? Math.round((totalC / totalW) * 1000) / 10 : 0;
}

async function fetchErrorCount(): Promise<number> {
  if (!OK) return 0;
  try {
    const r = await up(['HGETALL', 'err:count']);
    const h = parseHash(r);
    return Object.values(h).reduce((a, b) => a + b, 0);
  } catch { return 0; }
}

interface Todo { title: string; why: string; action: string; cxo?: string; }

function fallbackTodos(kpi: { revenueToday: number; mrr: number; churnPct: number; onboardCompletionPct: number; errors24h: number }): Todo[] {
  const todos: Todo[] = [];
  if (kpi.churnPct > 5) {
    todos.push({
      title: '解約 5 名 に 個別 ヒアリング',
      why: `当月 解約率 ${kpi.churnPct}% (危険ライン超え)`,
      action: '解約者の メール + 解約理由 を ExitSurvey ログから 抽出、1 件 5 分で 返信',
      cxo: 'CSO',
    });
  }
  if (kpi.onboardCompletionPct < 60) {
    todos.push({
      title: 'オンボ 完了率 を 60% に',
      why: `直近 7 日 完了率 ${kpi.onboardCompletionPct}% (目標 60% 未達)`,
      action: '/master/onboard-funnel で 最大脱落 ステップ を確認 → CXO に 改善案 を 依頼',
      cxo: 'UXE',
    });
  }
  if (kpi.revenueToday === 0) {
    todos.push({
      title: '今日 売上 ゼロ — 営業 5 件',
      why: '本日 Stripe 入金 0 円',
      action: 'enrichLeadList → draftSalesEmail で 営業メール 5 通 送る',
      cxo: 'CSO',
    });
  }
  if (kpi.errors24h > 10) {
    todos.push({
      title: 'エラー 累計 が 10 件 超え',
      why: `累計 error count = ${kpi.errors24h}`,
      action: '/master/error-log で 最新 を確認 → 該当 CXO に 修正依頼',
      cxo: 'QAE',
    });
  }
  if (todos.length < 3) {
    todos.push({
      title: 'AI 提案 履歴 を 振り返り',
      why: 'Cmd+Shift+H で 採用率 を 確認 → CXO 別 改善',
      action: '採用率 が 50% 未満 の CXO に 「提案を もっと 具体的に」 と 依頼',
      cxo: 'CDS',
    });
  }
  return todos.slice(0, 3);
}

async function aiSummarize(kpi: any): Promise<Todo[] | null> {
  if (!process.env.CLAUDE_API_KEY) return null;
  try {
    const prompt = `今朝の KPI:
- 今日 売上: ¥${kpi.revenueToday.toLocaleString('ja-JP')}
- MRR: ¥${kpi.mrr.toLocaleString('ja-JP')}
- 当月 解約率: ${kpi.churnPct}%
- 直近 7 日 オンボ完了率: ${kpi.onboardCompletionPct}%
- エラー累計: ${kpi.errors24h}

オーナー (株式会社CORE 代表 井出直毅) が 今日 30 分以内 に やるべき 3 件を 純 JSON で返してください。

形式 (3 要素 配列):
{
  "todos": [
    { "title": "20 字以内", "why": "30 字 (数字を 1 つ以上)", "action": "60 字 具体的 アクション", "cxo": "CEO|CFO|CMO|CSO|..." }
  ]
}

ルール: 嘘禁止 / 数字 必須 / cxo は CEO / CFO / CMO / CSO / CTO / CPO / COO / CDO / CDS / CHR / CLO / CAO / CCO / QAE / UIE / UXE の中から 1 つ。`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json() as { content?: Array<{ text?: string }> };
    const raw = (j.content?.[0]?.text || '').trim();
    const cleaned = raw.replace(/```(?:json)?\s*\n?|```/g, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as { todos?: Todo[] };
    return parsed.todos?.slice(0, 3) || null;
  } catch { return null; }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const url = new URL(req.url);
  const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
  if (key !== 'GAUCHE2026') {
    await logMasterAudit(req, '/api/master/owner-brief', 'forbidden');
    return json({ error: 'forbidden' }, 403);
  }
  await logMasterAudit(req, '/api/master/owner-brief', 'ok');

  let revenueToday = 0, mrr = 0, churnPct = 0;
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
      ({ revenueToday, mrr, churnPct } = await fetchStripeToday(stripe));
    } catch { /* */ }
  }
  const onboardCompletionPct = await fetchOnboardCompletionPct();
  const errors24h = await fetchErrorCount();

  const kpi = { revenueToday, mrr, churnPct, onboardCompletionPct, errors24h };
  const aiTodos = await aiSummarize(kpi);
  const todos = aiTodos && aiTodos.length > 0 ? aiTodos : fallbackTodos(kpi);

  return json({
    ok: true,
    asOf: new Date().toISOString(),
    kpi,
    todos,
    source: aiTodos ? 'ai' : 'rule-fallback',
    note: '嘘禁止 ルール: データ無の項目は 0 で表示。AI 失敗時は ルール ベース fallback。',
  });
}
