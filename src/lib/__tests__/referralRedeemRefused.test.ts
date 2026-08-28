import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================
// サーバが「この招待は使えません」と答えたときの振る舞い。
//
// 以前は 4xx をすべて「API 未配備」とみなして +7 日をローカルで付けていた。
// その結果、同じ人が端末を変えるたびに無料期間だけが伸び、招待した人の
// 人数は 1 人も増えない — 画面だけの嘘になっていた。
// ============================================================

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const local = new MemStorage();
const session = new MemStorage();
(globalThis as any).localStorage = local;
(globalThis as any).sessionStorage = session;
(globalThis as any).window = globalThis;

const {
  getReferralData, redeemPendingReferral, getPendingReferral, REFERRAL_BONUS_DAYS,
} = await import('../referral');

/** 招待リンクを踏んだ状態にする */
function pending(code: string) {
  session.setItem('pending_ref', code);
}

describe('招待コードをサーバが断ったとき', () => {
  beforeEach(() => {
    local.clear();
    session.clear();
    getReferralData(); // 自分のコードを初期化
  });

  it('使用済み (409) なら日数を足さず、控えも消す', async () => {
    pending('ABC234');
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, message: 'このメールアドレスは既に紹介コードを利用済です' }),
    })) as any;

    const r = await redeemPendingReferral('friend@example.com');
    expect(r.ok).toBe(false);
    expect(r.bonusDays).toBe(0);
    expect(getReferralData().bonusDays).toBe(0);
    expect(getReferralData().usedCode).toBeUndefined();
    expect(getPendingReferral()).toBeNull();
  });

  it('サーバが落ちている (500) ときは今まで通り +7 日を付ける (体験を止めない)', async () => {
    pending('ABC234');
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, message: 'server error' }),
    })) as any;

    const r = await redeemPendingReferral('friend@example.com');
    expect(r.ok).toBe(true);
    expect(r.bonusDays).toBe(REFERRAL_BONUS_DAYS);
    expect(getReferralData().bonusDays).toBe(REFERRAL_BONUS_DAYS);
  });

  it('正常 (200) なら +7 日が付き、控えは消える', async () => {
    pending('ABC234');
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, bonus_days: 7, recorded: true, message: 'ok' }),
    })) as any;

    const r = await redeemPendingReferral('friend@example.com');
    expect(r.ok).toBe(true);
    expect(r.bonusDays).toBe(7);
    expect(getPendingReferral()).toBeNull();
  });
});
