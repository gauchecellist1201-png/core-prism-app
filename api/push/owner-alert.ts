// ============================================================
// /api/push/owner-alert — オーナー宛 緊急 Push (master key)
//
// オーナー指示 (2026-06-04 第 36 波 SSSSS):
//   master key で 1 行 文言 を 投げると、購読中の オーナー端末 のみ に
//   即時 Push 通知。 既存 /api/push/send (全購読者) と異なり、
//   「オーナー端末 タグ」 が付いた 購読のみ を対象に絞り込む。
//
// POST { title?, body, url? }
//   ヘッダ x-master-key: GAUCHE2026 必須
//
// オーナー端末の 識別:
//   1) 購読 JSON に owner:true がある (subscribe で 付与可)
//   2) 上記が 1 件も無い場合、push:owner:endpoints セットに登録された endpoint
//   3) フォールバック: 「すべての購読」 を 1 件目 だけ送って 様子見 (起動初日 用)
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);

const VAPID_PUBLIC = process.env?.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env?.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env?.VAPID_SUBJECT || 'mailto:gauche.cellist1201@gmail.com';

interface Subscription {
  endpoint: string;
  keys?: { p256dh: string; auth: string };
  owner?: boolean;
  tag?: string;
}

async function up(cmd: (string | number)[]): Promise<any> {
  if (!UPSTASH_OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
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

async function importVapidPrivateKey(): Promise<{ privateKey: CryptoKey }> {
  const dBytes = urlBase64Decode(VAPID_PRIVATE);
  const pubBytes = urlBase64Decode(VAPID_PUBLIC);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) throw new Error('invalid VAPID_PUBLIC_KEY');
  const x = urlBase64Encode(pubBytes.slice(1, 33));
  const y = urlBase64Encode(pubBytes.slice(33, 65));
  const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', d: urlBase64Encode(dBytes), x, y, ext: true };
  const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return { privateKey };
}

async function buildVapidJwt(audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const claims = { aud: audience, exp, sub: VAPID_SUBJECT };
  const headerB64 = urlBase64Encode(new TextEncoder().encode(JSON.stringify(header)));
  const claimsB64 = urlBase64Encode(new TextEncoder().encode(JSON.stringify(claims)));
  const message = `${headerB64}.${claimsB64}`;
  const { privateKey } = await importVapidPrivateKey();
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(message));
  return `${message}.${urlBase64Encode(new Uint8Array(sig))}`;
}

async function sendOne(sub: Subscription, ttlSec = 60): Promise<{ ok: boolean; status: number; err?: string }> {
  try {
    const url = new URL(sub.endpoint);
    const aud = `${url.protocol}//${url.host}`;
    const jwt = await buildVapidJwt(aud);
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        TTL: String(ttlSec),
        Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
        'Content-Length': '0',
        Urgency: 'high',
      },
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, err: (e as Error).message };
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const key = req.headers.get('x-master-key') || '';
  if (key !== 'GAUCHE2026') return json({ ok: false, error: 'forbidden' }, 403);

  if (!UPSTASH_OK) return json({ ok: false, error: 'upstash_not_configured' }, 503);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ ok: false, error: 'vapid_not_configured', hint: 'node scripts/generateVapid.mjs で 鍵 → Vercel env に追加' }, 503);
  }

  let body: { title?: string; body?: string; url?: string };
  try { body = await req.json(); } catch { body = {}; }
  const title = String(body.title || '🚨 CORE 緊急').slice(0, 80);
  const text = String(body.body || '').slice(0, 200);
  const targetUrl = String(body.url || '/').slice(0, 200);
  if (!text) return json({ ok: false, error: 'body required' }, 400);

  // 1) push:owner:endpoints セットに登録された endpoint があれば 優先
  let subs: Subscription[] = [];
  let mode = '';
  try {
    const ownerRes = await up(['SMEMBERS', 'push:owner:endpoints']);
    const ownerEps = ((ownerRes as { result?: string[] }).result || []) as string[];
    if (ownerEps.length) {
      // 全 push:subs から endpoint 一致のもの だけ 取り出す
      const allArr = ((await up(['LRANGE', 'push:subs', 0, -1])) as { result?: string[] }).result || [];
      const all: Subscription[] = allArr.map((j) => { try { return JSON.parse(j) as Subscription; } catch { return null; } }).filter(Boolean) as Subscription[];
      const set = new Set(ownerEps);
      subs = all.filter((s) => set.has(s.endpoint));
      mode = 'owner-endpoint-set';
    }
  } catch { /* */ }

  // 2) Owner フラグ がある購読
  if (!subs.length) {
    try {
      const allArr = ((await up(['LRANGE', 'push:subs', 0, -1])) as { result?: string[] }).result || [];
      const all: Subscription[] = allArr.map((j) => { try { return JSON.parse(j) as Subscription; } catch { return null; } }).filter(Boolean) as Subscription[];
      subs = all.filter((s) => s.owner === true || s.tag === 'owner');
      mode = subs.length ? 'owner-flag' : mode;
    } catch { /* */ }
  }

  // 3) フォールバック: 「最初に購読された 1 件」 (起動初日)
  if (!subs.length) {
    try {
      const arr = ((await up(['LRANGE', 'push:subs', 0, 0])) as { result?: string[] }).result || [];
      subs = arr.map((j) => { try { return JSON.parse(j) as Subscription; } catch { return null; } }).filter(Boolean) as Subscription[];
      mode = subs.length ? 'fallback-first' : 'no-subs';
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 500);
    }
  }

  if (!subs.length) {
    return json({
      ok: false,
      error: 'no_owner_subscription',
      hint: 'オーナー端末で PWA をインストール → Push を許可 → /api/push/subscribe で push:owner:endpoints に SADD してください。',
    }, 503);
  }

  const results = await Promise.all(subs.map((s) => sendOne(s)));
  const success = results.filter((r) => r.ok).length;
  const failed = results.length - success;

  return json({
    ok: true,
    mode,
    sent: success,
    failed,
    total: subs.length,
    titleQueued: title,
    bodyQueued: text,
    urlQueued: targetUrl,
    note: 'payload-less Push のため SW 既定の文言が表示されます。完全な本文配送には web-push (Linux) の導入が必要。',
  });
}
