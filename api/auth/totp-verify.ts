// ============================================================
// /api/auth/totp-verify — クライアント送信の TOTP コードを Web Crypto で再検証
//
// オーナー指示 (2026-06-04 第 25 波 LLLL):
//   本来は サーバー側に シークレットを保管して検証する。
//   現状は localStorage に保管しているため、クライアント送信 secret を信頼して
//   サーバーで「コードが合うか」だけ再検証する妥協実装。
//   (将来 Supabase Auth + RPC で置き換える前提)
//
// POST { secret (base32), code }
//   → { valid: true|false }
//
// レート制限: IP 1 分 10 回
// ============================================================

export const config = { runtime: 'edge' };

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const rateMap = new Map<string, number[]>();

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown');
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rateMap.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { rateMap.set(ip, arr); return true; }
  arr.push(now);
  rateMap.set(ip, arr);
  if (rateMap.size > 5000) { const k = rateMap.keys().next().value; if (k) rateMap.delete(k); }
  return false;
}

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
    'Vary': 'Origin',
  };
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}

// ─── Base32 ──────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32ToBytes(b32: string): Uint8Array {
  const clean = b32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

function counterToBuffer(counter: number): Uint8Array {
  const buf = new Uint8Array(8);
  let n = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = n & 0xff; n = Math.floor(n / 256); }
  return buf;
}

async function totp(secretBase32: string, atMs: number): Promise<string> {
  const key = base32ToBytes(secretBase32);
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = counterToBuffer(counter);
  const ck = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', ck, buf));
  const offset = sig[sig.length - 1] & 0x0f;
  const code = ((sig[offset] & 0x7f) << 24)
    | ((sig[offset + 1] & 0xff) << 16)
    | ((sig[offset + 2] & 0xff) << 8)
    | (sig[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, ch);

  const ip = clientIp(req);
  if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429, { ...ch, 'Retry-After': '60' });

  let body: { secret?: string; code?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400, ch); }

  const secret = String(body.secret || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  const code = String(body.code || '').replace(/\D/g, '');
  if (secret.length < 16) return json({ valid: false, error: 'invalid_secret' }, 400, ch);
  if (code.length !== 6) return json({ valid: false, error: 'invalid_code_length' }, 400, ch);

  const now = Date.now();
  try {
    for (const offset of [-1, 0, 1]) {
      const expected = await totp(secret, now + offset * 30_000);
      if (expected === code) return json({ valid: true }, 200, ch);
    }
    return json({ valid: false }, 200, ch);
  } catch (e) {
    return json({ valid: false, error: (e as Error).message }, 500, ch);
  }
}
