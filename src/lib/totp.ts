// ============================================================
// totp.ts — Google Authenticator 互換 (RFC 6238) TOTP
//
// オーナー指示 (2026-06-04 第 25 波 LLLL):
//   2 段階認証の最小限実装。シークレット生成 / Base32 / TOTP 計算 を
//   外部ライブラリなしで提供 (Web Crypto API のみ)。
//
// 設計:
//   - シークレットは 20 bytes ランダム → Base32 で 32 字程度
//   - アルゴリズム: HMAC-SHA1, 6 桁, 30 秒 (Google Authenticator デフォ)
//   - otpauth:// URI を組み立てて QR (外部ライブラリで) に流す
// ============================================================

const TOTP_DIGITS = 6;
const TOTP_STEP_SEC = 30;

const STORAGE_KEY = 'core_totp_secret_v1';

// ─── Base32 (RFC 4648) ──────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 0x1f];
  return out;
}

export function base32ToBytes(b32: string): Uint8Array {
  const clean = b32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** 20-byte ランダム シークレット → Base32 文字列 */
export function generateSecret(): string {
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  return bytesToBase32(arr);
}

/** otpauth:// URI を組み立てる (Google Authenticator で QR 取込) */
export function buildOtpAuthUri(opts: { secret: string; account: string; issuer?: string }): string {
  const label = encodeURIComponent(`${opts.issuer || 'CORE Prism'}:${opts.account}`);
  const qs = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer || 'CORE Prism',
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SEC),
  }).toString();
  return `otpauth://totp/${label}?${qs}`;
}

/** 大きい 64bit カウンタ (number で OK / 2^53 まで耐える) → 8 byte big-endian */
function counterToBuffer(counter: number): Uint8Array {
  const buf = new Uint8Array(8);
  let n = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = n & 0xff;
    n = Math.floor(n / 256);
  }
  return buf;
}

async function hmacSha1(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const ck = await crypto.subtle.importKey('raw', key as unknown as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', ck, msg as unknown as BufferSource);
  return new Uint8Array(sig);
}

/** TOTP 算出 (引数 epoch ms / 省略時 = 今) */
export async function generateTOTP(secretBase32: string, atMs: number = Date.now()): Promise<string> {
  const key = base32ToBytes(secretBase32);
  const counter = Math.floor(atMs / 1000 / TOTP_STEP_SEC);
  const buf = counterToBuffer(counter);
  const hmac = await hmacSha1(key, buf);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  const mod = 10 ** TOTP_DIGITS;
  return String(code % mod).padStart(TOTP_DIGITS, '0');
}

/** ±1 窓 で検証 (時計ずれ対応) */
export async function verifyTOTP(secretBase32: string, code: string): Promise<boolean> {
  const clean = (code || '').replace(/\D/g, '');
  if (clean.length !== TOTP_DIGITS) return false;
  const now = Date.now();
  for (const offset of [-1, 0, 1]) {
    const t = now + offset * TOTP_STEP_SEC * 1000;
    const expected = await generateTOTP(secretBase32, t);
    if (expected === clean) return true;
  }
  return false;
}

/** localStorage 永続 (本番では Supabase 等に移すこと推奨) */
export function loadStoredSecret(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function saveStoredSecret(secret: string): void {
  try { localStorage.setItem(STORAGE_KEY, secret); } catch { /* */ }
}

export function clearStoredSecret(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}
