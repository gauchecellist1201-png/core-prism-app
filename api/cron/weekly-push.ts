// ============================================================
// /api/cron/weekly-push — 毎週日曜 22:00 (JST) に Web Push で
//                          「来週の 3 行動 + 投資判断」を全購読者に配信
//
// オーナー指示 (2026-06-04 第 23 波 EEEE):
//   SS で実装した /api/push/send の仕組みを cron から自動キック。
//
// 推奨 vercel.json: "0 13 * * 0" (UTC 日曜 13:00 = JST 月曜 4:00 → 一旦 22:00 JST に近づけるなら 13:00 UTC)
//   ⚠ 厳密に「日曜 22:00 JST」は土曜 13:00 UTC = "0 13 * * 6" を使用。
//
// 内容:
//   - Stripe 今週の charges / DAU から「投資判断 (買 / 待 / 保留)」を AI で 1 文に
//   - 「来週やる 3 つの行動」も AI で生成
//   - 既存 /api/push/send にメッセージを POST
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

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function aiBrief(apiOrigin: string, summary: string): Promise<{
  actions: string[]; judgement: '買' | '待' | '保留'; reason: string;
}> {
  const system = `あなたは事業オーナーの 1 週間の振り返り + 来週の計画を立てる AI です。
今週の実数字 (Stripe 売上 + DAU + 新規サブスク) を見て、来週の行動を 3 つと、
来週の「投資判断」を 買 / 待 / 保留 のいずれかで 1 つ選んでください。

判定基準 (目安):
- 売上が前週より +20% 以上 → 「買」(攻め時)
- 売上横ばい (±20%) → 「待」(様子見)
- 売上 -20% 超 → 「保留」(出血止める)

出力は JSON のみ:
{ "actions": ["...", "...", "..."], "judgement": "買|待|保留", "reason": "1 文で理由" }`;
  try {
    const res = await fetch(`${apiOrigin}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        system,
        messages: [{ role: 'user', content: summary }],
      }),
    });
    if (!res.ok) throw new Error(`ai ${res.status}`);
    const j = await res.json() as { content?: Array<{ text?: string }> };
    const raw = j.content?.[0]?.text || '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no json');
    const parsed = JSON.parse(m[0]) as { actions?: string[]; judgement?: string; reason?: string };
    const judgement = (parsed.judgement === '買' || parsed.judgement === '待' || parsed.judgement === '保留')
      ? parsed.judgement as '買' | '待' | '保留'
      : '待';
    return {
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [],
      judgement,
      reason: parsed.reason || '',
    };
  } catch {
    return { actions: ['今週の上位 1 つを優先', '止まってる案件 1 つ動かす', '休む時間を確保'], judgement: '待', reason: 'AI 取得 失敗のため既定' };
  }
}

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) return new Response('Unauthorized', { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return jsonRes(503, { ok: false, error: 'STRIPE_SECRET_KEY missing' });
  if (!UPSTASH_OK) return jsonRes(503, { ok: false, error: 'upstash_not_configured' });

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });
  const now = Date.now();
  const sevenDaysAgo = Math.floor((now - 7 * 86400_000) / 1000);
  const prevWeekStart = Math.floor((now - 14 * 86400_000) / 1000);

  // 今週と前週の charges
  let thisWeekYen = 0, thisWeekCount = 0, prevWeekYen = 0, prevWeekCount = 0;
  try {
    const charges = await stripe.charges.list({ created: { gte: prevWeekStart }, limit: 100 });
    for (const c of charges.data) {
      if (c.status !== 'succeeded' || c.currency !== 'jpy') continue;
      if (c.created >= sevenDaysAgo) { thisWeekYen += c.amount; thisWeekCount++; }
      else { prevWeekYen += c.amount; prevWeekCount++; }
    }
  } catch (e) {
    console.error('[weekly-push] stripe', (e as Error).message);
  }

  // DAU (今週 述べ)
  let dauThis = 0;
  for (let i = 0; i < 7; i++) {
    try {
      const r = await up(['SCARD', `active:${dateOffsetDays(i)}`]);
      dauThis += Number((r as { result?: number }).result || 0);
    } catch { /* */ }
  }

  const yen = (n: number) => '¥' + Math.round(n).toLocaleString('ja-JP');
  const summary = [
    `今週: 売上 ${yen(thisWeekYen)} / ${thisWeekCount} 件 / DAU 述べ ${dauThis}`,
    `前週: 売上 ${yen(prevWeekYen)} / ${prevWeekCount} 件`,
    `増減: ${prevWeekYen > 0 ? Math.round(((thisWeekYen - prevWeekYen) / prevWeekYen) * 100) : 0}%`,
  ].join('\n');

  const apiOrigin = new URL(req.url).origin;
  const brief = await aiBrief(apiOrigin, summary);

  // /api/push/send に投げる (master 認証必要)
  const title = `📊 来週の判断: ${brief.judgement}`;
  const body = `① ${brief.actions[0] || '—'}\n② ${brief.actions[1] || '—'}\n③ ${brief.actions[2] || '—'}\n💡 ${brief.reason}`;
  let pushResult: unknown = null;
  try {
    const r = await fetch(`${apiOrigin}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-master-key': 'GAUCHE2026' },
      body: JSON.stringify({ title, body, url: '/' }),
    });
    pushResult = await r.json().catch(() => ({}));
  } catch (e) {
    pushResult = { error: (e as Error).message };
  }

  return jsonRes(200, {
    ok: true,
    thisWeekYen, thisWeekCount, prevWeekYen, prevWeekCount, dauThis,
    judgement: brief.judgement, actions: brief.actions, reason: brief.reason,
    push: pushResult,
  });
}
