// ============================================================
// /api/log/error — フロントの console.error / window.onerror / unhandled rejection を受信
//   - validation: message, ts 必須 / stack, url, ua, brand, version 等は任意
//   - rate limit: IP ごとに 5 req/分 (in-memory map、edge instance 単位の簡易実装)
//   - body 上限: 16 KB
//   - 受信内容は Vercel ログ (console.log) に出すのみ。永続化はしない。
//   - CORS は core-prism-app.vercel.app + localhost のみ
// ============================================================

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const MAX_BODY_BYTES = 16 * 1024; // 16 KB
const RATE_WINDOW_MS = 60_000; // 1 分
const RATE_MAX = 5;

// edge instance 単位の簡易 rate limit map
const rateMap = new Map<string, number[]>();

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

interface ErrorBody {
  type?: string;
  message?: string;
  stack?: string;
  url?: string;
  ts?: number;
  ua?: string;
  viewport?: string;
  referrer?: string;
  brand?: string;
  personaId?: string | null;
  version?: string;
}

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rateMap.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    rateMap.set(ip, arr);
    // 偶発的に巨大化しないよう trim
    if (rateMap.size > 5000) {
      const firstKey = rateMap.keys().next().value;
      if (firstKey) rateMap.delete(firstKey);
    }
    return true;
  }
  arr.push(now);
  rateMap.set(ip, arr);
  return false;
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);

  // ─── Content-Length チェック (上限 16 KB) ───
  const cl = parseInt(req.headers.get('content-length') || '0', 10);
  if (cl > MAX_BODY_BYTES) {
    return json({ logged: false, reason: 'payload_too_large' }, 413, ch);
  }

  // ─── rate limit ───
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return json({ logged: false, reason: 'rate_limited' }, 429, {
      ...ch,
      'Retry-After': '60',
    });
  }

  // ─── body 読み込み (実サイズも再チェック) ───
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json({ logged: false, reason: 'bad_body' }, 200, ch);
  }
  if (raw.length > MAX_BODY_BYTES) {
    return json({ logged: false, reason: 'payload_too_large' }, 413, ch);
  }

  let body: ErrorBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ logged: false, reason: 'bad_json' }, 200, ch);
  }

  // ─── validation (message, ts 必須) ───
  if (!body.message || typeof body.message !== 'string') {
    return json({ logged: false, reason: 'missing_message' }, 400, ch);
  }
  if (!body.ts || typeof body.ts !== 'number') {
    return json({ logged: false, reason: 'missing_ts' }, 400, ch);
  }

  const message = body.message.slice(0, 2000);
  const type = String(body.type ?? 'unknown').slice(0, 40);
  const url = String(body.url ?? '').slice(0, 500);
  const ua = String(body.ua ?? '').slice(0, 300);
  const brand = String(body.brand ?? '').slice(0, 20);
  const version = String(body.version ?? '').slice(0, 40);
  const viewport = String(body.viewport ?? '').slice(0, 20);
  const stack = body.stack ? String(body.stack).slice(0, 2000) : undefined;

  // ─── 簡易ノイズフィルタ ───
  const NOISE = [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'Script error.',
    'NotAllowedError',
  ];
  if (NOISE.some((n) => message.includes(n))) {
    return json({ logged: false, reason: 'noise' }, 200, ch);
  }

  // ─── Logflare or 標準 console.log (Vercel logs に出る) ───
  const logflareKey = process.env.LOGFLARE_API_KEY;
  const logflareSource = process.env.LOGFLARE_SOURCE_ID;

  if (logflareKey && logflareSource) {
    try {
      await fetch(`https://api.logflare.app/logs?source=${logflareSource}`, {
        method: 'POST',
        headers: {
          'X-API-KEY': logflareKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `[${type}] ${message}`,
          metadata: {
            url, type, stack, ts: body.ts,
            ua, brand, version, viewport, ip,
          },
        }),
      });
    } catch {
      /* noop */
    }
  } else {
    // Vercel logs に出るだけ。永続化はしない (スコープ広がり防止)
    console.log(
      '[client-error]',
      JSON.stringify({
        type, message, url, brand, version, viewport, ua: ua.slice(0, 80), ip,
      }),
    );
  }

  return json({ logged: true }, 200, ch);
}
