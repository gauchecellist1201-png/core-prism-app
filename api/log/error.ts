// ============================================================
// /api/log/error — フロントの console.error / window.onerror を受信
// オプトインユーザーからのみ送られる。env が無ければ noop で 200。
// ============================================================

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
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
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);

  let body: ErrorBody;
  try { body = await req.json(); }
  catch { return json({ logged: false, reason: 'bad_json' }, 200, ch); }

  const message = String(body.message ?? '').slice(0, 2000);
  const type = String(body.type ?? 'unknown').slice(0, 40);
  const url = String(body.url ?? '').slice(0, 500);

  // 簡易ノイズフィルタ
  const NOISE = [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'Script error.',
    'NotAllowedError',
  ];
  if (NOISE.some(n => message.includes(n))) {
    return json({ logged: false, reason: 'noise' }, 200, ch);
  }

  // 外部ログ env が無ければ noop で 200 (現状は console.log のみ)
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
          metadata: { url, type, stack: body.stack, ts: body.ts },
        }),
      });
    } catch { /* noop */ }
  } else {
    // dev / production-without-logflare: stdout に出して Vercel ログで見える
    console.log('[client-error]', JSON.stringify({ type, message, url }));
  }

  return json({ logged: true }, 200, ch);
}
