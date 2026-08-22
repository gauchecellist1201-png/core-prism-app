// ============================================================
// Sales OS — Upstash Redis REST の薄いラッパ
//
// 既存 api/_lib/upstash.ts と同じ env を使うが、Sales OS で必要な
// HSET / HGETALL / LPUSH / HINCRBY / pipeline を足したいので分けている
// (共有ファイルを書き換えて他機能を巻き込まないため)。
// ============================================================

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';

export function kvConfigured(): boolean {
  return Boolean(UP_URL && UP_TOK);
}

export class KvNotConfigured extends Error {
  constructor() {
    super('UPSTASH_NOT_CONFIGURED');
    this.name = 'KvNotConfigured';
  }
}

type Cmd = (string | number)[];

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  if (!kvConfigured()) throw new KvNotConfigured();
  const res = await fetch(`${UP_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`upstash ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function cmd(c: Cmd, signal?: AbortSignal): Promise<unknown> {
  const r = (await post('', c, signal)) as { result?: unknown };
  return r?.result;
}

/** 複数コマンドを 1 往復で。返りは各コマンドの result 配列。 */
export async function pipeline(cmds: Cmd[], signal?: AbortSignal): Promise<unknown[]> {
  if (cmds.length === 0) return [];
  const r = (await post('/pipeline', cmds, signal)) as Array<{ result?: unknown; error?: string }>;
  if (!Array.isArray(r)) return [];
  return r.map(x => {
    if (x && typeof x === 'object' && 'error' in x && x.error) throw new Error(`upstash pipeline: ${x.error}`);
    return x?.result;
  });
}

export async function get(key: string): Promise<string | null> {
  const v = await cmd(['GET', key]);
  return v == null ? null : String(v);
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await get(key);
  if (raw == null) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export async function set(key: string, value: string, ttlSeconds?: number): Promise<void> {
  await cmd(ttlSeconds && ttlSeconds > 0 ? ['SET', key, value, 'EX', ttlSeconds] : ['SET', key, value]);
}

export async function setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  await set(key, JSON.stringify(value), ttlSeconds);
}

/** SET key value NX → 取れたら true */
export async function setNX(key: string, value: string): Promise<boolean> {
  const r = await cmd(['SET', key, value, 'NX']);
  return r === 'OK' || (r != null && String(r).toUpperCase() === 'OK');
}

/** SET key value NX EX ttl → 取れたら true。取り損ねた札が永久に居座らない */
export async function setNXEX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const r = await cmd(['SET', key, value, 'NX', 'EX', ttlSeconds]);
  return r === 'OK' || (r != null && String(r).toUpperCase() === 'OK');
}

export async function del(...keys: string[]): Promise<void> {
  if (!keys.length) return;
  await cmd(['DEL', ...keys]);
}

export async function hset(key: string, field: string, value: string): Promise<void> {
  await cmd(['HSET', key, field, value]);
}

export async function hdel(key: string, field: string): Promise<void> {
  await cmd(['HDEL', key, field]);
}

/** HGETALL を { field: value } に整える (Upstash は配列 or オブジェクトで返す) */
export async function hgetall(key: string): Promise<Record<string, string>> {
  const r = await cmd(['HGETALL', key]);
  const out: Record<string, string> = {};
  if (Array.isArray(r)) {
    for (let i = 0; i + 1 < r.length; i += 2) out[String(r[i])] = String(r[i + 1]);
  } else if (r && typeof r === 'object') {
    for (const [k, v] of Object.entries(r as Record<string, unknown>)) out[k] = String(v);
  }
  return out;
}

export async function hincrby(key: string, field: string, by = 1): Promise<void> {
  await cmd(['HINCRBY', key, field, by]);
}

export async function expire(key: string, seconds: number): Promise<void> {
  await cmd(['EXPIRE', key, seconds]);
}

export async function lpush(key: string, value: string): Promise<void> {
  await cmd(['LPUSH', key, value]);
}

export async function ltrim(key: string, start: number, stop: number): Promise<void> {
  await cmd(['LTRIM', key, start, stop]);
}

export async function lrange(key: string, start: number, stop: number): Promise<string[]> {
  const r = await cmd(['LRANGE', key, start, stop]);
  return Array.isArray(r) ? r.map(String) : [];
}

export async function ping(): Promise<boolean> {
  try { return String(await cmd(['PING'])).toUpperCase() === 'PONG'; } catch { return false; }
}
