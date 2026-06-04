// ============================================================
// /api/track/web-vitals — Core Web Vitals ビーコン 受信
//
// オーナー指示 (2026-06-04 第 39 波 AAAAAA):
//   ブラウザ から LCP / CLS / INP / FCP / TTFB を 送ってもらい、
//   Upstash に rolling 100 件 (path / metric 別) で 保存。
//   /master/web-vitals で p75 と 一覧 を見る。
//
// POST { name, value, id, path, rating?, ua? }
//   - name: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'
//   - value: number
//   - id: 端末ごとの 識別 (集計 重複防止)
//   - path: window.location.pathname
//   - rating: 'good' | 'needs-improvement' | 'poor'
//
// GET  ?master_key=GAUCHE2026
//   { metrics: { LCP: { p75, count, recent: [...] }, ... } }
//
// Upstash keys:
//   wv:list:<METRIC>  — 直近 100 件 (JSON 配列) を RPUSH + LTRIM
//   wv:bypath:<METRIC>:<pathHash>:list  — path 別 100 件
//
// レート: 1 IP / 60 秒 で 30 件 まで (簡易)
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const OK = !!(UP_URL && UP_TOK);

const ROLLING = 100;
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;

const VALID_METRICS = new Set(['LCP', 'CLS', 'INP', 'FCP', 'TTFB']);

interface Entry {
  name: string;
  value: number;
  id: string;
  path: string;
  rating?: string;
  ts: number;
  ua?: string;
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

// rate limit (Edge instance ローカルで OK な簡易)
const RATE = new Map<string, { c: number; ts: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const r = RATE.get(ip);
  if (!r || now - r.ts > RATE_WINDOW_MS) { RATE.set(ip, { c: 1, ts: now }); return true; }
  if (r.c >= RATE_MAX) return false;
  r.c++; return true;
}

function p75(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.75);
  return Math.round(sorted[Math.min(idx, sorted.length - 1)] * 100) / 100;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    } });
  }

  // GET: master key で 集計取得
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
    if (key !== 'GAUCHE2026') {
      const { logMasterAudit } = await import('../_lib/masterAudit');
      await logMasterAudit(req, '/api/track/web-vitals', 'forbidden');
      return json({ error: 'forbidden' }, 403);
    }
    {
      const { logMasterAudit } = await import('../_lib/masterAudit');
      await logMasterAudit(req, '/api/track/web-vitals', 'ok');
    }
    if (!OK) return json({ ok: true, configured: false, metrics: {} });
    const result: Record<string, any> = {};
    for (const m of VALID_METRICS) {
      try {
        const r = await up(['LRANGE', `wv:list:${m}`, 0, -1]);
        const items: Entry[] = ((r as { result?: string[] }).result || [])
          .map((s) => { try { return JSON.parse(s) as Entry; } catch { return null as any; } })
          .filter(Boolean);
        const values = items.map((it) => it.value);
        result[m] = {
          count: items.length,
          p75: p75(values),
          median: median(values),
          recent: items.slice(-20).reverse(),
        };
      } catch {
        result[m] = { count: 0, p75: 0, median: 0, recent: [] };
      }
    }
    return json({ ok: true, configured: true, asOf: new Date().toISOString(), metrics: result });
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anon').split(',')[0]?.trim();
  if (!checkRate(ip)) return json({ ok: false, error: 'rate_limited' }, 429);

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const name = String(body.name || '').toUpperCase();
  if (!VALID_METRICS.has(name)) return json({ ok: false, error: 'invalid_metric' }, 400);
  const value = Number(body.value);
  if (!Number.isFinite(value)) return json({ ok: false, error: 'invalid_value' }, 400);
  const id = String(body.id || '').slice(0, 64);
  const path = String(body.path || '/').slice(0, 200);
  const rating = body.rating ? String(body.rating).slice(0, 24) : undefined;
  const ua = body.ua ? String(body.ua).slice(0, 200) : undefined;

  const entry: Entry = { name, value, id, path, rating, ts: Date.now(), ua };

  if (!OK) {
    // 静かに OK 200 を返して クライアントの再送 を防ぐ (Upstash 未設定でも 成功扱い)
    return json({ ok: true, configured: false });
  }

  try {
    await up(['RPUSH', `wv:list:${name}`, JSON.stringify(entry)]);
    await up(['LTRIM', `wv:list:${name}`, -ROLLING, -1]);
    // path 別 (主要 LP のみ keep)
    if (/^\/(lp\/|pricing|iris|$)/.test(path)) {
      const safe = path.replace(/[^a-z0-9/_-]/gi, '').slice(0, 60);
      const keyPath = `wv:bypath:${name}:${safe}`;
      await up(['RPUSH', keyPath, JSON.stringify(entry)]);
      await up(['LTRIM', keyPath, -ROLLING, -1]);
      await up(['EXPIRE', keyPath, 30 * 86400]);
    }
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
  return json({ ok: true });
}
