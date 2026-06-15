// ============================================================
// api/_lib/upstash.ts — Upstash Redis REST の小さな GET/SET/DEL ヘルパ
//
// 既存の api/status.ts と同じ env (UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN) を使い回す。X 連携のトークン保存に利用。
// Edge / Node どちらの runtime でも動く fetch ベース。
// ============================================================

const UP_URL =
  (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK =
  (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';

export function isUpstashConfigured(): boolean {
  return Boolean(UP_URL && UP_TOK);
}

async function upstash(cmd: (string | number)[]): Promise<any> {
  if (!UP_URL || !UP_TOK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UP_TOK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

/** 文字列値を取得。未設定キーは null。 */
export async function kvGet(key: string): Promise<string | null> {
  const r = await upstash(['GET', key]);
  const v = r?.result;
  return v == null ? null : String(v);
}

/** JSON 値を取得（パース失敗は null）。 */
export async function kvGetJSON<T>(key: string): Promise<T | null> {
  const raw = await kvGet(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 文字列をセット。ttlSeconds を渡すと EX で期限付き。 */
export async function kvSet(
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> {
  if (ttlSeconds && ttlSeconds > 0) {
    await upstash(['SET', key, value, 'EX', ttlSeconds]);
  } else {
    await upstash(['SET', key, value]);
  }
}

/** JSON をセット（TTL 任意）。 */
export async function kvSetJSON(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  await kvSet(key, JSON.stringify(value), ttlSeconds);
}

/** キーを削除。 */
export async function kvDel(key: string): Promise<void> {
  await upstash(['DEL', key]);
}
