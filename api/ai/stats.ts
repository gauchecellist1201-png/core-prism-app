// ============================================================
// /api/ai/stats — AI 使用量集計エンドポイント (Vercel Edge)
//
// GET /api/ai/stats?days=7 → 直近 N 日の集計を JSON で返す
//   x-master-key: GAUCHE2026 を要求 (オーナー専用)
//
// 同ファイルで logAiUsage / readAiStats を named export し、
// /api/ai.ts から呼ぶ (Upstash があれば KV、なければモジュール内メモリ)。
// ============================================================

export const config = { runtime: 'edge' };

// ─── Upstash REST ───
const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

// メモリ集計 (Upstash 未設定時のフォールバック。Edge 再起動で消える)
const MEM: Record<string, Record<string, number>> = {};

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

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoUTC(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// route → 4 つのバケットに正規化
export function bucketRoute(route: string): 'master:claude' | 'master:claude-rescue' | 'light:gemini' | 'fallback:claude' | 'unknown' {
  if (!route) return 'unknown';
  if (route.startsWith('master:claude-rescue')) return 'master:claude-rescue';
  if (route.startsWith('fallback:claude')) return 'fallback:claude';
  if (route.startsWith('master:claude')) return 'master:claude';
  if (route.startsWith('master:gemini') || route.startsWith('public:gemini') || route.startsWith('light:gemini')) {
    return 'light:gemini';
  }
  return 'unknown';
}

// 1 件の AI 呼び出しを記録
export async function logAiUsage(entry: {
  route: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
}): Promise<void> {
  const date = todayUTC();
  const bucket = bucketRoute(entry.route);
  const model = (entry.model || 'unknown').slice(0, 60).replace(/[^a-zA-Z0-9._-]/g, '_');
  const tIn = Math.max(0, Math.round(entry.tokens_in || 0));
  const tOut = Math.max(0, Math.round(entry.tokens_out || 0));
  const lat = Math.max(0, Math.round(entry.latency_ms || 0));

  const fields: Array<[string, number]> = [
    ['total:calls', 1],
    ['total:tokens_in', tIn],
    ['total:tokens_out', tOut],
    ['total:latency_ms', lat],
    [`route:${bucket}:calls`, 1],
    [`route:${bucket}:tokens_in`, tIn],
    [`route:${bucket}:tokens_out`, tOut],
    [`route:${bucket}:latency_ms`, lat],
    [`model:${model}:calls`, 1],
    [`model:${model}:tokens_in`, tIn],
    [`model:${model}:tokens_out`, tOut],
  ];
  // Gemini の 1日 1500 リクエスト無料枠カウントに使う
  if (bucket === 'light:gemini' || bucket === 'fallback:claude') {
    // light:gemini はそのまま、fallback:claude は Claude が応答しているので無料枠は消費しない
  }

  if (UPSTASH_OK) {
    try {
      const key = `ai:stats:${date}`;
      // 非ゼロ値だけ HINCRBY
      const tasks = fields
        .filter(([, v]) => v !== 0)
        .map(([f, v]) => up(['HINCRBY', key, f, v]));
      await Promise.all(tasks);
      await up(['EXPIRE', key, 60 * 60 * 24 * 35]); // 35 日 TTL
      return;
    } catch {
      // メモリにフォールバック
    }
  }
  const m = MEM[date] || (MEM[date] = {});
  for (const [f, v] of fields) m[f] = (m[f] || 0) + v;
}

// 1 日分のフラットなフィールド辞書を取得
export async function readAiStats(date: string): Promise<Record<string, number>> {
  if (UPSTASH_OK) {
    try {
      const r = await up(['HGETALL', `ai:stats:${date}`]);
      const raw = r?.result;
      const out: Record<string, number> = {};
      if (Array.isArray(raw)) {
        for (let i = 0; i + 1 < raw.length; i += 2) {
          out[String(raw[i])] = Number(raw[i + 1]) || 0;
        }
      } else if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) out[k] = Number(v) || 0;
      }
      return out;
    } catch {
      // メモリへフォールバック
    }
  }
  return { ...(MEM[date] || {}) };
}

// フラット辞書を構造化 JSON へ
function structurize(flat: Record<string, number>) {
  const total = {
    calls: flat['total:calls'] || 0,
    tokens_in: flat['total:tokens_in'] || 0,
    tokens_out: flat['total:tokens_out'] || 0,
    latency_ms: flat['total:latency_ms'] || 0,
  };
  const routes: Record<string, { calls: number; tokens_in: number; tokens_out: number; latency_ms: number }> = {};
  const models: Record<string, { calls: number; tokens_in: number; tokens_out: number }> = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split(':');
    if (parts[0] === 'route' && parts.length >= 3) {
      const bucket = parts.slice(1, -1).join(':'); // route:master:claude:calls → master:claude
      const metric = parts[parts.length - 1];
      const r = routes[bucket] || (routes[bucket] = { calls: 0, tokens_in: 0, tokens_out: 0, latency_ms: 0 });
      if (metric in r) (r as any)[metric] = v;
    } else if (parts[0] === 'model' && parts.length >= 3) {
      const name = parts.slice(1, -1).join(':');
      const metric = parts[parts.length - 1];
      const m = models[name] || (models[name] = { calls: 0, tokens_in: 0, tokens_out: 0 });
      if (metric in m) (m as any)[metric] = v;
    }
  }
  return { total, routes, models };
}

// ─── HTTP ハンドラ ───
const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-master-key',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default async function handler(req: Request) {
  const ch = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, ch);
  }

  // マスター認証 (ヘッダー or クエリ。クライアントは localStorage の核を渡す)
  const url = new URL(req.url);
  const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
  if (key !== 'GAUCHE2026') {
    return json({ error: 'Forbidden' }, 403, ch);
  }

  const daysParam = Number(url.searchParams.get('days') || '7');
  const days = Math.min(Math.max(daysParam, 1), 30);

  const dates: string[] = [];
  for (let i = 0; i < days; i++) dates.push(daysAgoUTC(i));

  const perDay: Array<{ date: string; total: any; routes: any; models: any }> = [];
  for (const d of dates) {
    const flat = await readAiStats(d);
    const s = structurize(flat);
    perDay.push({ date: d, total: s.total, routes: s.routes, models: s.models });
  }

  const today = perDay[0];
  // 過去 N 日の合算
  const aggregate = perDay.reduce(
    (acc, day) => {
      acc.total.calls += day.total.calls;
      acc.total.tokens_in += day.total.tokens_in;
      acc.total.tokens_out += day.total.tokens_out;
      acc.total.latency_ms += day.total.latency_ms;
      for (const [r, v] of Object.entries(day.routes) as Array<[string, any]>) {
        const a = acc.routes[r] || (acc.routes[r] = { calls: 0, tokens_in: 0, tokens_out: 0, latency_ms: 0 });
        a.calls += v.calls; a.tokens_in += v.tokens_in; a.tokens_out += v.tokens_out; a.latency_ms += v.latency_ms;
      }
      for (const [m, v] of Object.entries(day.models) as Array<[string, any]>) {
        const a = acc.models[m] || (acc.models[m] = { calls: 0, tokens_in: 0, tokens_out: 0 });
        a.calls += v.calls; a.tokens_in += v.tokens_in; a.tokens_out += v.tokens_out;
      }
      return acc;
    },
    { total: { calls: 0, tokens_in: 0, tokens_out: 0, latency_ms: 0 }, routes: {} as any, models: {} as any },
  );

  // Gemini 残量推定 (1500 req/日 free tier)
  const GEMINI_DAILY_FREE = 1500;
  const geminiUsedToday =
    (today?.routes?.['light:gemini']?.calls || 0);
  const geminiRemaining = Math.max(0, GEMINI_DAILY_FREE - geminiUsedToday);

  return json(
    {
      asOfUTC: new Date().toISOString(),
      storage: UPSTASH_OK ? 'upstash' : 'memory',
      today,
      aggregate,
      perDay,
      gemini: {
        dailyFreeQuota: GEMINI_DAILY_FREE,
        usedToday: geminiUsedToday,
        remaining: geminiRemaining,
      },
    },
    200,
    ch,
  );
}
