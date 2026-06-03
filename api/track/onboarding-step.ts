// ============================================================
// /api/track/onboarding-step — オンボ funnel beacon 受信
//
// POST { step: 'welcome'|'name'|'industry'|'apikey'|'model'|'completed',
//        date: 'YYYY-MM-DD' }
//
// 動作:
//   1) コンソールに log (Vercel ログ可視)
//   2) Upstash REST が設定済なら HINCRBY で日次カウンタを更新
//      Key: onboard:funnel:<YYYY-MM-DD>  Field: <step>
//      TTL: 100 日
//
// GET ?days=14 — 直近 N 日のカウンタを返す (admin / cron / script 用)
// ============================================================

export const config = { runtime: 'edge' };

const ALLOWED_STEPS = new Set([
  'welcome', 'name', 'industry', 'apikey', 'model', 'completed',
]);

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_CONFIGURED = !!(UP_URL && UP_TOK);

async function upstash(cmd: (string | number)[]): Promise<any> {
  if (!UPSTASH_CONFIGURED) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UP_TOK}`,
      'Content-Type': 'application/json',
    },
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

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    // 集計 取得
    const url = new URL(req.url);
    const days = Math.max(1, Math.min(60, Number(url.searchParams.get('days') || '14')));
    if (!UPSTASH_CONFIGURED) {
      return json({
        ok: true,
        configured: false,
        hint: 'UPSTASH_REDIS_REST_URL/TOKEN を Vercel env に設定すると集計が永続化されます。',
        days: [],
      });
    }
    const list: { date: string; data: Record<string, number>; dropRate: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = dateOffsetDays(i);
      try {
        const r = await upstash(['HGETALL', `onboard:funnel:${d}`]);
        const arr: string[] = (r as { result?: string[] }).result || [];
        const data: Record<string, number> = {};
        for (let j = 0; j < arr.length; j += 2) {
          data[arr[j]] = Number(arr[j + 1]) || 0;
        }
        const welcome = data.welcome || 0;
        const completed = data.completed || 0;
        const dropRate = welcome > 0 ? Math.round((1 - completed / welcome) * 1000) / 10 : 0;
        list.push({ date: d, data, dropRate });
      } catch {
        list.push({ date: d, data: {}, dropRate: 0 });
      }
    }
    return json({ ok: true, configured: true, days: list.reverse() });
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let body: { step?: string; date?: string };
  try { body = await req.json(); } catch { body = {}; }
  const step = (body.step || '').toLowerCase();
  const date = (body.date && isValidDate(body.date)) ? body.date : new Date().toISOString().slice(0, 10);

  if (!ALLOWED_STEPS.has(step)) {
    return json({ ok: false, error: 'invalid_step' }, 400);
  }

  // Vercel ログ
  // eslint-disable-next-line no-console
  console.log(`[onboard] step=${step} date=${date}`);

  if (UPSTASH_CONFIGURED) {
    try {
      const key = `onboard:funnel:${date}`;
      await upstash(['HINCRBY', key, step, 1]);
      // TTL: 100 日 (一度しか set されないので EXPIRE が NX) — 単純に毎回打つ
      await upstash(['EXPIRE', key, 100 * 86400]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[onboard] upstash error', (e as Error).message);
    }
  }

  return json({ ok: true });
}
