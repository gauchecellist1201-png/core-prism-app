// ============================================================
// /api/track/knowledge-usage — 出典チップ活用度 + 資料不一致率 beacon 受信
//
// POST { event: 'citation_click', location?: string }
// POST { event: 'answer_rendered', noMatch: boolean }
// GET  ?days=14 — 直近 N 日の集計を返す (admin 用)
//
// Upstash 永続化 (なければ console.log のみ)
//   key: knowledge:usage:<YYYY-MM-DD>
//   field: citation_click / answer_total / no_match
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

const EVENTS = new Set(['citation_click', 'answer_rendered']);

async function up(cmd: (string | number)[]): Promise<any> {
  if (!UPSTASH_OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const days = Math.max(1, Math.min(60, Number(url.searchParams.get('days') || '14')));
    if (!UPSTASH_OK) {
      return json({ ok: true, configured: false, hint: 'UPSTASH_REDIS_REST_URL/TOKEN を Vercel env に追加すると永続化されます。', days: [] });
    }
    const list: Array<{ date: string; citationClicks: number; answerTotal: number; noMatch: number; noMatchRate: number }> = [];
    for (let i = 0; i < days; i++) {
      const d = dateOffsetDays(i);
      try {
        const r = await up(['HGETALL', `knowledge:usage:${d}`]);
        const arr: string[] = (r as { result?: string[] }).result || [];
        const counts: Record<string, number> = {};
        for (let j = 0; j < arr.length; j += 2) counts[arr[j]] = Number(arr[j + 1]) || 0;
        const answerTotal = counts['answer_total'] || 0;
        const noMatch = counts['no_match'] || 0;
        list.push({
          date: d,
          citationClicks: counts['citation_click'] || 0,
          answerTotal,
          noMatch,
          noMatchRate: answerTotal > 0 ? Math.round((noMatch / answerTotal) * 1000) / 10 : 0,
        });
      } catch {
        list.push({ date: d, citationClicks: 0, answerTotal: 0, noMatch: 0, noMatchRate: 0 });
      }
    }
    return json({ ok: true, configured: true, days: list.reverse() });
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let body: { event?: string; location?: string; noMatch?: boolean };
  try { body = await req.json(); } catch { body = {}; }
  const event = (body.event || '').toLowerCase();

  if (!EVENTS.has(event)) {
    return json({ ok: false, error: 'invalid_payload' }, 400);
  }

  // eslint-disable-next-line no-console
  console.log(`[knowledge-usage] ${event}`);

  if (UPSTASH_OK) {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const key = `knowledge:usage:${date}`;
      if (event === 'citation_click') {
        const location = String(body.location || '').slice(0, 40).replace(/[^a-zA-Z0-9._:-]/g, '_');
        await up(['HINCRBY', key, 'citation_click', 1]);
        if (location) await up(['HINCRBY', key, `citation_click:${location}`, 1]);
      } else {
        await up(['HINCRBY', key, 'answer_total', 1]);
        if (body.noMatch) await up(['HINCRBY', key, 'no_match', 1]);
      }
      await up(['EXPIRE', key, 100 * 86400]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[knowledge-usage] upstash error', (e as Error).message);
    }
  }

  return json({ ok: true });
}
