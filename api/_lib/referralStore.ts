// ============================================================
// api/_lib/referralStore.ts — 紹介 (招待) の記録を「本当に残す」ための保管庫
//
// なぜ必要か:
//   紹介の記録先は Supabase (referral_redemptions テーブル) しか無かったが、
//   本番の Vercel には SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が
//   1 つも設定されていない (2026-08-28 実測)。
//   その結果、
//     - /api/referral/redeem は保存を素通りして ok を返す
//     - /api/referral/status は誰が登録しても必ず referred_count: 0
//   となり、招待した人の画面 (バッジ / 「◯人が登録」/ お祝いトースト /
//   トライアル +7 日) は永久に何も起きなかった。実測でも同じコードで
//   2 回続けて登録できてしまい、重複も弾けていなかった。
//
//   本番で唯一動いている保存先は Upstash Redis (UPSTASH_REDIS_REST_URL /
//   _TOKEN) なので、そこへ紹介の記録を持つ。Supabase が将来設定されれば
//   そちらも併用する (呼び出し側で両方見る)。
//
// 保存する形:
//   ref:redeemed:<CODE>   … その招待コードで登録した人の集合 (SADD/SCARD)
//   ref:used:<HASH>       … その人が既に招待を使ったかの印 (SET NX)
//
//   メールアドレスは生のままでは保存しない。SHA-256 の先頭 32 桁だけを
//   使う (同じ人を同じ人と判定できれば十分で、住所録は要らない)。
// ============================================================

const UP_URL =
  (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK =
  (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';

/** Upstash が使えるか (未設定でも呼び出し側は止まらない) */
export function isReferralStoreConfigured(): boolean {
  return Boolean(UP_URL && UP_TOK);
}

async function up(cmd: (string | number)[]): Promise<unknown> {
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
  const body = await res.json() as { result?: unknown };
  return body?.result;
}

/** 招待コードの正規化 (前後の空白除去 + 大文字化) */
export function normalizeCode(raw: string | null | undefined): string {
  return (raw || '').trim().toUpperCase();
}

/** メールアドレスの正規化 (前後の空白除去 + 小文字化) */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw || '').trim().toLowerCase();
}

/** その招待コードで登録した人の集合キー */
export function codeKey(code: string): string {
  return `ref:redeemed:${normalizeCode(code)}`;
}

/** 「この人はもう招待を 1 回使った」の印のキー */
export function emailKey(hash: string): string {
  return `ref:used:${hash}`;
}

/**
 * メールアドレスを SHA-256 の先頭 32 桁にする。
 * 生のメールを Redis に置かないため (紹介の集計に本人の連絡先は要らない)。
 */
export async function hashEmail(email: string): Promise<string> {
  const normalized = normalizeEmail(email);
  const data = new TextEncoder().encode(`core-referral:${normalized}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 32);
}

export interface RecordResult {
  /** 記録できたか (false = 保存先が無い / 不通) */
  recorded: boolean;
  /** 同じ人が既に招待を使い終わっていたか */
  duplicate: boolean;
}

/**
 * 紹介の成立を記録する。
 *  1. ref:used:<hash> を SET NX — 既にあれば duplicate (1 人 1 回)
 *  2. ref:redeemed:<CODE> に SADD — 集合なので二重登録しても増えない
 *
 * 保存先が無い / 不通のときは recorded:false を返すだけで例外は投げない
 * (紹介ボーナスの付与そのものは止めない = フェイルオープン)。
 */
export async function recordRedemption(code: string, email: string): Promise<RecordResult> {
  if (!isReferralStoreConfigured()) return { recorded: false, duplicate: false };
  try {
    const hash = await hashEmail(email);
    const c = normalizeCode(code);
    // SET ... NX → 新規なら "OK"、既にあれば null
    const setResult = await up(['SET', emailKey(hash), c, 'NX']);
    if (setResult === null || setResult === undefined) {
      return { recorded: true, duplicate: true };
    }
    await up(['SADD', codeKey(c), hash]);
    return { recorded: true, duplicate: false };
  } catch (e) {
    console.warn('[referralStore] record failed:', e);
    return { recorded: false, duplicate: false };
  }
}

/**
 * その招待コードで実際に登録した人数。
 * 保存先が無い / 不通のときは null (「0 人」と言い切らない = 嘘の数字を出さない)。
 */
export async function countRedemptions(code: string): Promise<number | null> {
  if (!isReferralStoreConfigured()) return null;
  try {
    const n = await up(['SCARD', codeKey(code)]);
    const num = typeof n === 'number' ? n : parseInt(String(n ?? ''), 10);
    return Number.isFinite(num) && num >= 0 ? num : null;
  } catch (e) {
    console.warn('[referralStore] count failed:', e);
    return null;
  }
}
