// ============================================================
// /api/signup-count — 累計 サインアップ 数 (公開)
//
// オーナー指示 (2026-06-04 第 45 波 SSSSSS):
//   /lp/* の「累計 N 社が 始めました」 用 の 公開エンドポイント。
//   - Upstash の signup:count を読み取り
//   - 無設定 / 0 なら env DEMO_SIGNUPS を 返す (UI 確認 用フォールバック)
//   - 嘘禁止: real / demo を フラグで明示
//
// GET → { count, source: 'live' | 'demo' | 'fallback', asOf }
// POST (master key) { delta = 1 } → 増加 / オーナー手動修正用
//
// Cache: public, s-maxage=60 (CDN 1 分)
// ============================================================

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
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': status === 200 ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' : 'no-store',
    },
  });
}

const DEMO = Number(process.env.DEMO_SIGNUPS || '0');

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-master-key',
    } });
  }

  if (req.method === 'GET') {
    let count = 0;
    let source: 'live' | 'demo' | 'fallback' = 'fallback';
    if (OK) {
      try {
        const r = await up(['GET', 'signup:count']);
        const v = Number((r as { result?: string }).result || '0');
        if (v > 0) { count = v; source = 'live'; }
      } catch { /* */ }
    }
    if (count === 0 && DEMO > 0) {
      count = DEMO;
      source = 'demo';
    }
    return json({ ok: true, count, source, asOf: new Date().toISOString() });
  }

  if (req.method === 'POST') {
    const key = req.headers.get('x-master-key') || '';
    if (key !== 'GAUCHE2026') return json({ error: 'forbidden' }, 403);
    if (!OK) return json({ error: 'upstash_not_configured' }, 503);
    let body: { delta?: number; set?: number };
    try { body = await req.json(); } catch { body = {}; }
    try {
      if (typeof body.set === 'number') {
        await up(['SET', 'signup:count', String(Math.max(0, Math.floor(body.set)))]);
      } else {
        const delta = Number(body.delta ?? 1) | 0;
        await up(['INCRBY', 'signup:count', delta]);
      }
      const r = await up(['GET', 'signup:count']);
      return json({ ok: true, count: Number((r as { result?: string }).result || '0') });
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }
  }

  return json({ error: 'method_not_allowed' }, 405);
}
