import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================
// 紹介の記録が「本当にサーバへ残る」ことの回帰テスト。
//
// 2026-08-28 の実測では、記録先が Supabase だけで、その env が本番に
// 1 つも無かったため:
//   - 同じメールで 2 回続けて招待コードを使えてしまう
//   - 招待した人の人数は誰が登録しても 0 のまま
// という状態だった。ここでは Upstash Redis (本番で実際に効いている
// 保存先) への SET NX / SADD / SCARD が正しく呼ばれることを確かめる。
// ============================================================

process.env.UPSTASH_REDIS_REST_URL = 'https://kv.test.local';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

const {
  hashEmail, normalizeCode, codeKey, emailKey,
  recordRedemption, countRedemptions, isReferralStoreConfigured,
} = await import('../_lib/referralStore');

/** Upstash REST を模したメモリ実装 (SET NX / SADD / SCARD だけ) */
function fakeKv() {
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const calls: string[][] = [];
  (globalThis as any).fetch = vi.fn(async (_url: string, init: any) => {
    const cmd = JSON.parse(init.body) as string[];
    calls.push(cmd);
    const [op, key, ...rest] = cmd;
    let result: unknown = null;
    if (op === 'SET') {
      const nx = rest[1] === 'NX';
      if (nx && strings.has(key)) result = null;
      else { strings.set(key, rest[0]); result = 'OK'; }
    } else if (op === 'SADD') {
      const s = sets.get(key) || new Set<string>();
      const before = s.size;
      s.add(rest[0]);
      sets.set(key, s);
      result = s.size - before;
    } else if (op === 'SCARD') {
      result = sets.get(key)?.size ?? 0;
    }
    return { ok: true, json: async () => ({ result }) };
  }) as any;
  return { strings, sets, calls };
}

describe('紹介の記録 (Upstash Redis)', () => {
  beforeEach(() => { fakeKv(); });

  it('保存先が設定されていることを認識する', () => {
    expect(isReferralStoreConfigured()).toBe(true);
  });

  it('招待コードは大文字に揃えて数える (小文字のリンクを踏んでも同じ人数)', async () => {
    expect(normalizeCode(' abc234 ')).toBe('ABC234');
    expect(codeKey('abc234')).toBe('ref:redeemed:ABC234');
  });

  it('メールアドレスは生のまま保存しない (SHA-256 の 32 桁)', async () => {
    const h = await hashEmail('Friend@Example.com ');
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain('@');
    // 大文字小文字・前後の空白が違っても同じ人と判定する
    expect(await hashEmail('friend@example.com')).toBe(h);
    expect(emailKey(h)).toBe(`ref:used:${h}`);
  });

  it('1 人が登録すると、その招待コードの人数が 1 人に増える', async () => {
    const r = await recordRedemption('ABC234', 'friend@example.com');
    expect(r).toEqual({ recorded: true, duplicate: false });
    expect(await countRedemptions('ABC234')).toBe(1);
  });

  it('同じメールで 2 回目は重複として弾かれ、人数は増えない', async () => {
    await recordRedemption('ABC234', 'friend@example.com');
    const second = await recordRedemption('ABC234', 'friend@example.com');
    expect(second.duplicate).toBe(true);
    expect(await countRedemptions('ABC234')).toBe(1);
  });

  it('別の人が登録すれば人数は 2 人になる', async () => {
    await recordRedemption('ABC234', 'a@example.com');
    await recordRedemption('ABC234', 'b@example.com');
    expect(await countRedemptions('ABC234')).toBe(2);
  });

  it('保存先が落ちていても例外を投げず、人数は null (0 人と言い切らない)', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as any;
    const r = await recordRedemption('ABC234', 'c@example.com');
    expect(r.recorded).toBe(false);
    expect(await countRedemptions('ABC234')).toBeNull();
  });
});
