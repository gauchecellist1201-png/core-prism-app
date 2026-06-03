// ============================================================
// /api/push/send — Web Push 配信 (master 専用)
//
// オーナー指示 (2026-06-03 第 10 波 SS): CXO の「いま考えてること」を
// プッシュ通知できる土台。
//
// POST  { title, body, url? }  全購読者へ送信
//   x-master-key: GAUCHE2026 を要求
//
// 実装:
//   web-push npm パッケージは macOS arm64 でビルド失敗するため、
//   ここでは VAPID JWT を Web Crypto API で 手書きし、
//   message 本体は暗号化なし (テスト用に空 body) で送出する。
//   暗号化された body を送りたい場合は将来 web-push を Linux で導入。
//
// 必要 env:
//   VAPID_PUBLIC_KEY    (Base64URL — uncompressed P-256 公開鍵)
//   VAPID_PRIVATE_KEY   (Base64URL — P-256 秘密鍵 d)
//   VAPID_SUBJECT       (mailto:owner@example.com)
//   UPSTASH_REDIS_REST_URL / _TOKEN
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

const VAPID_PUBLIC = process.env?.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env?.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env?.VAPID_SUBJECT || 'mailto:noreply@example.com';

interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

async function up(cmd: (string | number)[]): Promise<any> {
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function urlBase64Decode(s: string): Uint8Array {
  const padding = '='.repeat((4 - s.length % 4) % 4);
  const base64 = (s + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function urlBase64Encode(buf: Uint8Array): string {
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** P-256 秘密鍵 (d, 32 bytes) を JWK 化して importKey */
async function importVapidPrivateKey(): Promise<{ privateKey: CryptoKey; publicJwk: { x: string; y: string } }> {
  const dBytes = urlBase64Decode(VAPID_PRIVATE);
  const pubBytes = urlBase64Decode(VAPID_PUBLIC);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) throw new Error('invalid VAPID_PUBLIC_KEY format');
  const x = urlBase64Encode(pubBytes.slice(1, 33));
  const y = urlBase64Encode(pubBytes.slice(33, 65));
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: urlBase64Encode(dBytes),
    x, y,
    ext: true,
  };
  const privateKey = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  );
  return { privateKey, publicJwk: { x, y } };
}

/** Web Push の VAPID JWT (ES256) を生成 */
async function buildVapidJwt(audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12h
  const claims = { aud: audience, exp, sub: VAPID_SUBJECT };
  const headerB64 = urlBase64Encode(new TextEncoder().encode(JSON.stringify(header)));
  const claimsB64 = urlBase64Encode(new TextEncoder().encode(JSON.stringify(claims)));
  const message = `${headerB64}.${claimsB64}`;

  const { privateKey } = await importVapidPrivateKey();
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(message),
  );
  return `${message}.${urlBase64Encode(new Uint8Array(sig))}`;
}

async function sendOne(sub: Subscription, ttlSec = 60): Promise<{ ok: boolean; status: number }> {
  const url = new URL(sub.endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(aud);
  // body 暗号化を行わず空送信 (ペイロードなし通知)。
  // クライアント側 sw.js は data なしでも既定タイトル "CORE Prism" を表示する。
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'TTL': String(ttlSec),
      'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
      'Content-Length': '0',
      // payload-less push なので暗号化ヘッダ無し
    },
  });
  return { ok: res.ok, status: res.status };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const key = req.headers.get('x-master-key') || '';
  if (key !== 'GAUCHE2026') return json({ ok: false, error: 'forbidden' }, 403);

  if (!UPSTASH_OK) return json({ ok: false, error: 'upstash_not_configured' }, 503);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({
      ok: false,
      error: 'vapid_not_configured',
      hint: 'node scripts/generateVapid.mjs で鍵を生成して Vercel env に追加してください。',
    }, 503);
  }

  let body: { title?: string; body?: string; url?: string };
  try { body = await req.json(); } catch { body = {}; }
  const title = String(body.title || 'CORE Prism').slice(0, 80);
  const text = String(body.body || '').slice(0, 200);
  const url = String(body.url || '/').slice(0, 200);

  let subs: Subscription[] = [];
  try {
    const arr = ((await up(['LRANGE', 'push:subs', 0, -1])) as { result?: string[] }).result || [];
    subs = arr.map(j => { try { return JSON.parse(j) as Subscription; } catch { return null; } }).filter(Boolean) as Subscription[];
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }

  const results = await Promise.all(subs.map(async s => {
    try { return await sendOne(s); } catch (e) { return { ok: false, status: 0, err: (e as Error).message }; }
  }));
  const success = results.filter(r => r.ok).length;
  const failed = results.length - success;

  // 注: 現状は payload 無し送信のため body / url はクライアント SW で未使用。
  // クライアント側で title/body を出すには web-push 暗号化が必要 (将来対応)。
  return json({
    ok: true,
    sent: success,
    failed,
    total: subs.length,
    note: 'payload-less push のため title/body はクライアント側 SW の既定値が表示されます。' +
          'カスタム本文を送るには web-push (npm) を Linux 環境に導入してください。',
    titleQueued: title,
    bodyQueued: text,
    urlQueued: url,
  });
}
