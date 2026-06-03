// ============================================================
// /api/track/cta-click — Checkout CTA A/B beacon 受信
//
// POST  { event: 'impression'|'click', variant: 'A'|'B'|'C', location: string }
// GET   ?days=14 — 直近 N 日の集計を返す (admin 用)
//
// Upstash 永続化 (なければ console.log のみ)
//   key: cta:ab:<YYYY-MM-DD>
//   field: <variant>:<event>  (impression / click)
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

const VARIANTS = new Set(['A', 'B', 'C']);
const EVENTS = new Set(['impression', 'click']);

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
    const list: Array<{ date: string; A: { impressions: number; clicks: number }; B: { impressions: number; clicks: number }; C: { impressions: number; clicks: number } }> = [];
    for (let i = 0; i < days; i++) {
      const d = dateOffsetDays(i);
      try {
        const r = await up(['HGETALL', `cta:ab:${d}`]);
        const arr: string[] = (r as { result?: string[] }).result || [];
        const counts: Record<string, number> = {};
        for (let j = 0; j < arr.length; j += 2) counts[arr[j]] = Number(arr[j + 1]) || 0;
        list.push({
          date: d,
          A: { impressions: counts['A:impression'] || 0, clicks: counts['A:click'] || 0 },
          B: { impressions: counts['B:impression'] || 0, clicks: counts['B:click'] || 0 },
          C: { impressions: counts['C:impression'] || 0, clicks: counts['C:click'] || 0 },
        });
      } catch {
        list.push({ date: d, A: { impressions: 0, clicks: 0 }, B: { impressions: 0, clicks: 0 }, C: { impressions: 0, clicks: 0 } });
      }
    }
    return json({ ok: true, configured: true, days: list.reverse() });
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let body: { event?: string; variant?: string; location?: string };
  try { body = await req.json(); } catch { body = {}; }
  const event = (body.event || '').toLowerCase();
  const variant = (body.variant || '').toUpperCase();
  const location = String(body.location || '').slice(0, 60).replace(/[^a-zA-Z0-9._:-]/g, '_');

  if (!EVENTS.has(event) || !VARIANTS.has(variant)) {
    return json({ ok: false, error: 'invalid_payload' }, 400);
  }

  // eslint-disable-next-line no-console
  console.log(`[cta-ab] ${event} variant=${variant} loc=${location}`);

  if (UPSTASH_OK) {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const key = `cta:ab:${date}`;
      await up(['HINCRBY', key, `${variant}:${event}`, 1]);
      await up(['HINCRBY', key, `${variant}:${event}:${location}`, 1]);
      await up(['EXPIRE', key, 100 * 86400]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[cta-ab] upstash error', (e as Error).message);
    }
  }

  return json({ ok: true });
}
