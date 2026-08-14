import { describe, it, expect, beforeEach, vi } from 'vitest';

// 端末の保存を模した最小 localStorage / sessionStorage
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
  getReferralData, saveReferralData, syncReferralStatus,
  consumePendingBonusDays, markReferredOne, REFERRAL_BONUS_DAYS,
} = await import('../referral');

/** /api/referral/status が「あなたのコードで登録した人数 = n」を返す状態にする */
function serverSaysReferred(n: number) {
  (globalThis as any).fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ ok: true, referred_count: n }),
  })) as any;
}

describe('紹介ボーナス日数 — 表示と実際の延長が食い違わないこと', () => {
  beforeEach(() => {
    local.clear();
    session.clear();
  });

  it('友達 1 人の登録で増える累計日数は +7 日ちょうど (二重計上しない)', async () => {
    getReferralData(); // 初期化
    serverSaysReferred(1);

    const synced = await syncReferralStatus(true);
    expect(synced.newReferrals).toBe(1);
    expect(synced.bonusDays).toBe(REFERRAL_BONUS_DAYS);

    // トライアル期限へ反映 (画面側が extendTrial に渡す日数)
    const applied = consumePendingBonusDays();
    expect(applied).toBe(REFERRAL_BONUS_DAYS);

    // 反映後も「累計獲得日数」は 7 日のまま。14 日になったら画面が嘘をつく
    expect(getReferralData().bonusDays).toBe(REFERRAL_BONUS_DAYS);
    expect(getReferralData().pendingBonusDays).toBe(0);
  });

  it('反映を 2 回呼んでも累計日数は増えない', async () => {
    getReferralData();
    serverSaysReferred(2);
    await syncReferralStatus(true);

    expect(consumePendingBonusDays()).toBe(REFERRAL_BONUS_DAYS * 2);
    expect(consumePendingBonusDays()).toBe(0);
    expect(getReferralData().bonusDays).toBe(REFERRAL_BONUS_DAYS * 2);
  });

  it('招待された側の +7 日 (usedCode 由来) が、その後の同期で消えない', async () => {
    const d = getReferralData();
    // 招待リンクから登録して受け取った 7 日
    saveReferralData({ ...d, usedCode: 'ABC234', bonusDays: REFERRAL_BONUS_DAYS });

    serverSaysReferred(1); // さらに自分も 1 人招待した
    await syncReferralStatus(true);
    consumePendingBonusDays();

    expect(getReferralData().bonusDays).toBe(REFERRAL_BONUS_DAYS * 2);
  });

  it('markReferredOne も 1 人 = +7 日で、反映後に二重計上しない', () => {
    getReferralData();
    markReferredOne();
    expect(getReferralData().referredCount).toBe(1);
    expect(getReferralData().bonusDays).toBe(REFERRAL_BONUS_DAYS);
    expect(consumePendingBonusDays()).toBe(REFERRAL_BONUS_DAYS);
    expect(getReferralData().bonusDays).toBe(REFERRAL_BONUS_DAYS);
  });
});
