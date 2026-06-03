// ============================================================
// /api/push/subscribe — Web Push 購読 endpoint (Edge runtime)
//
// オーナー指示 (2026-06-03 第 10 波 SS): SS. Web Push 通知の土台
//
// POST   { endpoint, keys: { p256dh, auth } }   購読登録
// DELETE { endpoint }                           購読解除
//
// 永続化:
//   Upstash REST に "push:subs" (LIST) として全購読を JSON 文字列で保存。
//   重複は endpoint で先頭に LREM して付け替え。
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);
const SUBS_KEY = 'push:subs';

interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  ua?: string;
  createdAt: string;
}

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidSub(o: unknown): o is Subscription {
  if (!o || typeof o !== 'object') return false;
  const s = o as Subscription;
  return typeof s.endpoint === 'string'
    && s.endpoint.startsWith('https://')
    && !!s.keys
    && typeof s.keys.p256dh === 'string'
    && typeof s.keys.auth === 'string';
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try { body = await req.json(); } catch { body = {}; }
  const endpoint = String(body.endpoint || '');

  if (!UPSTASH_OK) {
    return json({ ok: false, configured: false, hint: 'UPSTASH_REDIS_REST_URL/TOKEN を Vercel env に設定してください。' }, 503);
  }

  if (req.method === 'DELETE') {
    if (!endpoint) return json({ ok: false, error: 'endpoint required' }, 400);
    // LRANGE 全取得 → endpoint と一致するものを除外
    try {
      const arr = ((await up(['LRANGE', SUBS_KEY, 0, -1])) as { result?: string[] }).result || [];
      // 全削除 → 残りを再 PUSH
      await up(['DEL', SUBS_KEY]);
      const remaining = arr.filter(j => {
        try { return (JSON.parse(j) as Subscription).endpoint !== endpoint; } catch { return false; }
      });
      if (remaining.length > 0) {
        await up(['RPUSH', SUBS_KEY, ...remaining]);
      }
      return json({ ok: true, removed: arr.length - remaining.length });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 500);
    }
  }

  // POST: 購読登録
  if (!isValidSub({ endpoint, keys: body.keys })) {
    return json({ ok: false, error: 'invalid_subscription' }, 400);
  }
  const sub: Subscription = {
    endpoint,
    keys: { p256dh: body.keys!.p256dh!, auth: body.keys!.auth! },
    ua: (req.headers.get('user-agent') || '').slice(0, 200),
    createdAt: new Date().toISOString(),
  };
  try {
    // 同 endpoint があれば置き換え (LREM 0 で全削除 → RPUSH)
    const arr = ((await up(['LRANGE', SUBS_KEY, 0, -1])) as { result?: string[] }).result || [];
    const kept = arr.filter(j => {
      try { return (JSON.parse(j) as Subscription).endpoint !== endpoint; } catch { return false; }
    });
    await up(['DEL', SUBS_KEY]);
    if (kept.length) await up(['RPUSH', SUBS_KEY, ...kept]);
    await up(['RPUSH', SUBS_KEY, JSON.stringify(sub)]);
    return json({ ok: true, total: kept.length + 1 });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
}
