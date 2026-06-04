// ============================================================
// /api/roadmap-votes — ロードマップ 投票 集計 (公開, 認証なし)
//
// オーナー指示 (2026-06-04 第 34 波 LLLLL):
//   /roadmap で 各項目に「投票」したい時に POST、表示時に GET。
//   Upstash が無くても 200 を返す (count=0)。
//
// GET                 → { items: { [id]: count } }
// POST { id }         → { ok: true, id, count }
//
// Upstash key:
//   roadmap:votes  (Hash) — field=item_id, value=integer count
//   roadmap:ip:<hash>:<id> (String) — 24h TTL で 二重投票 防止
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

function jsonRes(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': status === 200 ? 'public, max-age=60, s-maxage=60' : 'no-store',
    },
  });
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

async function hashIp(req: Request): Promise<string> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'anon';
  // 安易な fnv 風 (PII 漏洩防止のためハッシュのみ保存)
  const buf = new TextEncoder().encode(ip + ':roadmap');
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const arr = Array.from(new Uint8Array(digest));
  return arr.slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    } });
  }

  if (req.method === 'GET') {
    if (!OK) return jsonRes(200, { items: {}, configured: false });
    try {
      const r = await up(['HGETALL', 'roadmap:votes']);
      return jsonRes(200, { items: parseHash(r), configured: true });
    } catch (e) {
      return jsonRes(200, { items: {}, configured: true, error: (e as Error).message });
    }
  }

  if (req.method === 'POST') {
    let body: { id?: string };
    try { body = await req.json(); } catch { body = {}; }
    const id = String(body.id || '').slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id) return jsonRes(400, { ok: false, error: 'id required' });
    if (!OK) return jsonRes(200, { ok: true, configured: false, id, count: 0 });
    try {
      // 24h 二重投票防止
      const ipHash = await hashIp(req);
      const guard = `roadmap:ip:${ipHash}:${id}`;
      const exists = await up(['GET', guard]);
      if (exists?.result) {
        const r = await up(['HGET', 'roadmap:votes', id]);
        return jsonRes(200, { ok: true, id, count: Number(r?.result) || 0, alreadyVoted: true });
      }
      await up(['SET', guard, '1', 'EX', 86400]);
      const r = await up(['HINCRBY', 'roadmap:votes', id, 1]);
      return jsonRes(200, { ok: true, id, count: Number(r?.result) || 1 });
    } catch (e) {
      return jsonRes(500, { ok: false, error: (e as Error).message });
    }
  }

  return jsonRes(405, { error: 'method_not_allowed' });
}
