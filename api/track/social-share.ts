// ============================================================
// /api/track/social-share — LP の シェア ボタン クリック を記録
//
// オーナー指示 (2026-06-04 第 46 波 XXXXXX):
//   ユーザーが LP の シェア ボタン (X / FB / LinkedIn) を 押した時に 呼び出す。
//   どの ネットワーク に、どの URL を シェアしたか を 日次 で 集計。
//
// POST { network: 'x' | 'facebook' | 'linkedin' | 'copy', url }
//   - Upstash key: shares:<date>  HINCRBY network 1
//   - 累計 key: shares:total      HINCRBY network 1
//
// GET ?master_key=GAUCHE2026&days=14
//   { configured, days: [{date, networks: {x, facebook, ...}}], totals }
//
// レート: 1 IP / 60 秒 で 60 件
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const OK = !!(UP_URL && UP_TOK);

const VALID = new Set(['x', 'facebook', 'linkedin', 'copy']);

const RATE_MAX = 60;
const RATE_WIN = 60_000;
const RATE = new Map<string, { c: number; ts: number }>();
function rateOk(ip: string): boolean {
  const now = Date.now();
  const r = RATE.get(ip);
  if (!r || now - r.ts > RATE_WIN) { RATE.set(ip, { c: 1, ts: now }); return true; }
  if (r.c >= RATE_MAX) return false;
  r.c++; return true;
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type, x-master-key',
    } });
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
    if (key !== 'GAUCHE2026') return json({ error: 'forbidden' }, 403);
    if (!OK) return json({ ok: true, configured: false, days: [], totals: {} });
    const days = Math.max(1, Math.min(60, Number(url.searchParams.get('days') || '14')));
    const out: Array<{ date: string; networks: Record<string, number>; total: number }> = [];
    for (let i = 0; i < days; i++) {
      const d = dateOffsetDays(i);
      try {
        const r = await up(['HGETALL', `shares:${d}`]);
        const networks = parseHash(r);
        const total = Object.values(networks).reduce((a, b) => a + b, 0);
        out.push({ date: d, networks, total });
      } catch {
        out.push({ date: d, networks: {}, total: 0 });
      }
    }
    let totals: Record<string, number> = {};
    try {
      const r = await up(['HGETALL', 'shares:total']);
      totals = parseHash(r);
    } catch { /* */ }
    return json({ ok: true, configured: true, asOf: new Date().toISOString(), days: out.reverse(), totals });
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anon').split(',')[0]?.trim();
  if (!rateOk(ip)) return json({ ok: false, error: 'rate_limited' }, 429);

  let body: { network?: string; url?: string };
  try { body = await req.json(); } catch { body = {}; }
  const network = String(body.network || '').toLowerCase();
  if (!VALID.has(network)) return json({ ok: false, error: 'invalid_network' }, 400);

  if (!OK) return json({ ok: true, configured: false });
  try {
    const today = new Date().toISOString().slice(0, 10);
    await up(['HINCRBY', `shares:${today}`, network, 1]);
    await up(['EXPIRE', `shares:${today}`, 90 * 86400]);
    await up(['HINCRBY', 'shares:total', network, 1]);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
  return json({ ok: true });
}
