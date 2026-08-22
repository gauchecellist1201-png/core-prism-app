// ============================================================
// Sales OS — HTTP 共通 (CORS / master 認証 / 締切)
// ============================================================

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

/** 既存 api/* と同じ合言葉。env があればそちらを優先。 */
const MASTER_KEY = (typeof process !== 'undefined' && process.env?.MASTER_KEY) || 'GAUCHE2026';

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-master-key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

/** 長さの違いを漏らさない程度の素朴な比較 */
function sameKey(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * master 認証。通れば null、弾いたら Response を返す。
 * クエリ文字列では受け取らない (URL が履歴・ログ・Referer に残るため)。
 */
export function requireMaster(req: Request, ch: Record<string, string>): Response | null {
  const key = req.headers.get('x-master-key') || '';
  if (key && sameKey(key, MASTER_KEY)) return null;
  return json(
    { error: 'UNAUTHORIZED', message: 'master key が必要です。/sales を開いて合言葉を入力してください。' },
    401,
    ch,
  );
}

/** Edge の 25 秒に対して、コールドスタート分を残した自前の締切 */
export class Deadline {
  private readonly end: number;
  constructor(budgetMs = 19_000) {
    this.end = Date.now() + budgetMs;
  }
  remaining(): number {
    return Math.max(0, this.end - Date.now());
  }
  expired(): boolean {
    return this.remaining() <= 0;
  }
  /** 指定ミリ秒 (残り時間を超えない) で abort する signal */
  signal(maxMs: number): AbortSignal {
    const ms = Math.max(500, Math.min(maxMs, this.remaining() || 500));
    return AbortSignal.timeout(ms);
  }
}

export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
