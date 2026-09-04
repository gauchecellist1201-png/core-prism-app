import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================
// 招待の「結果の控え」— 約束した側が結果を黙らないための回帰テスト。
//
// 以前は redeemPendingReferral() の戻り値のうち bonusDays しか使われず、
// ok も message も捨てられていた。そのため
//  - 成功しても「+7 日が本当に付いた」と言う画面が無い
//  - 断られた時は「合計 10 日無料」と約束したのに黙って 3 日になる
// という状態だった。成功でも失敗でも控えが残ることをここで固定する。
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
  getReferralData, redeemPendingReferral,
  peekReferralReceipt, clearReferralReceipt, saveReferralReceipt,
  REFERRAL_BONUS_DAYS,
} = await import('../referral');

function pending(code: string, from?: string) {
  session.setItem('pending_ref', code);
  if (from) session.setItem('pending_ref_from', from);
}

describe('招待の結果の控え (receipt)', () => {
  beforeEach(() => {
    local.clear();
    session.clear();
    getReferralData();
    vi.restoreAllMocks();
  });

  it('適用できたら「もらえた日数」と招待者の名前が残る', async () => {
    pending('ABCDEF', 'なおき');
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ ok: true, bonus_days: REFERRAL_BONUS_DAYS }),
    });

    const r = await redeemPendingReferral('new@example.com');
    expect(r.ok).toBe(true);

    const receipt = peekReferralReceipt();
    expect(receipt).not.toBeNull();
    expect(receipt!.ok).toBe(true);
    expect(receipt!.bonusDays).toBe(REFERRAL_BONUS_DAYS);
    expect(receipt!.inviter).toBe('なおき');
  });

  it('サーバに断られたら、その事実が 0 日として残る (黙って消えない)', async () => {
    pending('ABCDEF', 'なおき');
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: false, status: 409,
      json: async () => ({ ok: false, message: 'この招待コードは使用済みです' }),
    });

    const r = await redeemPendingReferral('new@example.com');
    expect(r.ok).toBe(false);

    const receipt = peekReferralReceipt();
    expect(receipt).not.toBeNull();
    expect(receipt!.ok).toBe(false);
    expect(receipt!.bonusDays).toBe(0);
    expect(receipt!.message).toContain('使用済み');
  });

  it('招待リンクを踏んでいない人には控えを作らない', async () => {
    const r = await redeemPendingReferral('new@example.com');
    expect(r.ok).toBe(false);
    expect(peekReferralReceipt()).toBeNull();
  });

  it('一度伝えたら消える (同じ話を毎回されない)', () => {
    saveReferralReceipt({ ok: true, bonusDays: 7, inviter: 'なおき', message: '' });
    expect(peekReferralReceipt()).not.toBeNull();
    clearReferralReceipt();
    expect(peekReferralReceipt()).toBeNull();
  });

  it('7 日より古い控えは出さない (今の話ではない)', () => {
    saveReferralReceipt({ ok: true, bonusDays: 7, inviter: '', message: '' });
    const raw = JSON.parse(local.getItem('core_referral_receipt_v1')!);
    raw.at = Date.now() - 8 * 24 * 60 * 60 * 1000;
    local.setItem('core_referral_receipt_v1', JSON.stringify(raw));
    expect(peekReferralReceipt()).toBeNull();
  });
});
