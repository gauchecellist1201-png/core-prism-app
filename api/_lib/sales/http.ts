// ============================================================
// Sales OS — HTTP 共通 (CORS / master 認証 / 締切)
// ============================================================

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

// ---- 合言葉 --------------------------------------------------------------
// ここが守るのは営業先の連絡先・商談メモ・受注金額 = 外に出てはいけないもの。
// 既存の /api/master/* 系が使っている 'GAUCHE2026' は、このリポジトリにも
// 配信中のクライアントバンドルにも載っている = 実質公開の文字列なので、
// それを既定値として受け付けるわけにいかない (画面に警告を出すだけでは API は守れない)。
//
// よって env の MASTER_KEY が無ければ、この API 群は誰にも開かない (fail-closed)。
// /sales は新設の画面なので、閉じても既存機能は何も壊れない。
// 既存 /api/master/* 系まで一斉に env 由来へ移すのは影響が大きいので別タスク。
const ENV_MASTER_KEY = (typeof process !== 'undefined' && process.env?.MASTER_KEY) || '';

// リポジトリとクライアントバンドルに載っている旧合言葉。env にこれを入れても
// 「設定した」ことにはならない (長さだけ見ていると素通りする)。
const PUBLISHED_KEYS = new Set(['GAUCHE2026']);

/** 合言葉がサーバー側に設定されているか (短いもの・公開ずみのものは未設定扱い) */
export function masterKeyConfigured(): boolean {
  return ENV_MASTER_KEY.length >= 8 && !PUBLISHED_KEYS.has(ENV_MASTER_KEY);
}

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
  if (!masterKeyConfigured()) {
    return json({
      error: 'MASTER_KEY_NOT_CONFIGURED',
      message: '合言葉がサーバーに設定されていません。営業先の連絡先や金額を扱うため、'
        + 'リポジトリに載っている既存の合言葉 (GAUCHE2026) では開かないようにしています。'
        + 'Vercel の環境変数に MASTER_KEY を、他で使っていない 8 文字以上の文字列で登録し、'
        + '再デプロイしてから、この画面で同じ文字列を入力してください。',
    }, 503, ch);
  }
  const key = req.headers.get('x-master-key') || '';
  if (key && sameKey(key, ENV_MASTER_KEY)) return null;
  return json(
    { error: 'UNAUTHORIZED', message: '合言葉が違います。/sales で入れ直してください。' },
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
