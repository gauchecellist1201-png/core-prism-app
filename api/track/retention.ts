// ============================================================
// /api/track/retention — DAU + 7 日リテンション ビーコン
//
// POST { deviceId, date }
//   - active:<date>  SADD <deviceId>  (DAU)
//   - dev:<deviceId>:lastDate STR     (前回訪問日記録)
//
// GET ?days=7 (master only)
//   各日の DAU + 「N 日以内に再訪問してきた割合」を返す。
//
// オーナー指示 (2026-06-03 第 10 波 RR)
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

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

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidDeviceId(s: unknown): s is string {
  return typeof s === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(s);
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    // master only
    const url = new URL(req.url);
    const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
    if (key !== 'GAUCHE2026') return json({ ok: false, error: 'forbidden' }, 403);
    const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days') || '14')));

    if (!UPSTASH_OK) {
      return json({ ok: true, configured: false, hint: 'UPSTASH_REDIS_REST_URL/TOKEN を Vercel env に追加すると永続化されます。', days: [] });
    }

    // 日次 DAU を取得 + 7 日前との重複から retention 率を出す
    const list: Array<{ date: string; dau: number; ret7dPct: number }> = [];
    for (let i = 0; i < days; i++) {
      const d = dateOffsetDays(i);
      try {
        const card = await up(['SCARD', `active:${d}`]);
        const dau = Number((card as { result?: number }).result || 0);
        // 7 日前 (1 週間前) と今日の交差サイズ
        let ret7dPct = 0;
        if (i + 7 < days + 7) {
          const ref = dateOffsetDays(i + 7);
          try {
            const interRes = await up(['SINTERSTORE', `tmp:ret:${d}:${ref}`, 2, `active:${d}`, `active:${ref}`]);
            const refCard = await up(['SCARD', `active:${ref}`]);
            const inter = Number((interRes as { result?: number }).result || 0);
            const refDau = Number((refCard as { result?: number }).result || 0);
            ret7dPct = refDau > 0 ? Math.round((inter / refDau) * 1000) / 10 : 0;
            await up(['DEL', `tmp:ret:${d}:${ref}`]); // 一時 set を片付け
          } catch { /* */ }
        }
        list.push({ date: d, dau, ret7dPct });
      } catch {
        list.push({ date: d, dau: 0, ret7dPct: 0 });
      }
    }
    return json({ ok: true, configured: true, days: list.reverse() });
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let body: { deviceId?: string; date?: string };
  try { body = await req.json(); } catch { body = {}; }
  const deviceId = body.deviceId;
  const date = isValidDate(body.date) ? body.date : new Date().toISOString().slice(0, 10);
  if (!isValidDeviceId(deviceId)) return json({ ok: false, error: 'invalid_device_id' }, 400);

  // eslint-disable-next-line no-console
  console.log(`[retention] ping deviceId=${(deviceId as string).slice(0, 8)}… date=${date}`);

  if (UPSTASH_OK) {
    try {
      const key = `active:${date}`;
      await up(['SADD', key, deviceId as string]);
      await up(['EXPIRE', key, 60 * 60 * 24 * 60]); // 60 日 TTL
      await up(['SET', `dev:${deviceId as string}:last`, date, 'EX', 60 * 60 * 24 * 60]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[retention] upstash error', (e as Error).message);
    }
  }

  return json({ ok: true });
}
