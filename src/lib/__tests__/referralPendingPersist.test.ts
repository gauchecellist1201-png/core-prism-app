import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================
// 招待リンクを踏んでから登録するまでの間に、タブが閉じても
// 「+7 日」が消えないこと。
//
// なぜこのテストが要るか:
//   招待リンクは LINE や X から踏まれるので、多くの人は
//   アプリ内ブラウザで開く → その場では登録せず閉じる →
//   あとで Safari で開き直して登録する。
//   保留先が sessionStorage だけだと、この間に招待が消える。
//   しかも画面には何も出ないので、招待された人は 3 日しか
//   もらえなかったことに気づかないし、招待した人の人数も増えない。
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
(globalThis as any).history = { replaceState: () => {} };
(globalThis as any).location = { href: 'https://core-prism-app.vercel.app/' };

const {
  captureReferralFromUrl,
  getPendingReferral,
  getPendingReferralInviter,
  getPendingReferralMessage,
  clearPendingReferral,
  getReferralData,
  saveReferralData,
} = await import('../referral');

/** 招待リンクを踏んだ状態にする */
function visitInviteLink(qs: string) {
  (globalThis as any).location.href = `https://core-prism-app.vercel.app/${qs}`;
  (globalThis as any).window.location = (globalThis as any).location;
  captureReferralFromUrl();
}

/** タブを閉じて開き直した状態にする (sessionStorage だけが消える) */
function reopenBrowser() {
  session.clear();
}

describe('招待の保留 — タブを閉じても消えないこと', () => {
  beforeEach(() => {
    local.clear();
    session.clear();
  });

  it('リンクを踏んだあとタブを閉じても、招待コード・招待者名・一言が残る', () => {
    visitInviteLink('?ref=ABCDEF&from=なおき&msg=これ便利だったよ');

    expect(getPendingReferral()).toBe('ABCDEF');

    reopenBrowser();

    expect(getPendingReferral()).toBe('ABCDEF');
    expect(getPendingReferralInviter()).toBe('なおき');
    expect(getPendingReferralMessage()).toBe('これ便利だったよ');
  });

  it('開き直したあと sessionStorage にも戻るので、以後の読み出しも同じ答えになる', () => {
    visitInviteLink('?ref=ABCDEF&from=なおき');
    reopenBrowser();

    getPendingReferral();
    expect(session.getItem('pending_ref')).toBe('ABCDEF');
  });

  it('30 日より前に踏んだ招待は復活させない (期限切れを黙って適用しない)', () => {
    visitInviteLink('?ref=ABCDEF&from=なおき');
    reopenBrowser();

    // 保存した日時を 31 日前に書き換える
    const raw = JSON.parse(local.getItem('core_pending_ref_v1')!);
    raw.savedAt = Date.now() - 31 * 24 * 60 * 60 * 1000;
    local.setItem('core_pending_ref_v1', JSON.stringify(raw));

    expect(getPendingReferral()).toBeNull();
    expect(local.getItem('core_pending_ref_v1')).toBeNull();
  });

  it('壊れた保存が残っていても落ちず、招待なし扱いになる', () => {
    local.setItem('core_pending_ref_v1', '{"code":null');
    expect(getPendingReferral()).toBeNull();

    local.setItem('core_pending_ref_v1', '{"code":null,"savedAt":null}');
    expect(getPendingReferral()).toBeNull();
  });

  it('すでに招待を使い終わった人には、古い保留を復活させない', () => {
    visitInviteLink('?ref=ABCDEF&from=なおき');
    reopenBrowser();

    const data = getReferralData();
    data.usedCode = 'ABCDEF';
    saveReferralData(data);

    expect(getPendingReferral()).toBeNull();
  });

  it('自分の紹介コードのリンクを自分で踏んでも保留しない', () => {
    const me = getReferralData();
    visitInviteLink(`?ref=${me.myCode}&from=じぶん`);

    expect(getPendingReferral()).toBeNull();
    expect(local.getItem('core_pending_ref_v1')).toBeNull();
  });

  it('長すぎる招待コードは受け付けない (決済画面の 1 行が崩れないように)', () => {
    visitInviteLink(`?ref=${'A'.repeat(64)}&from=なおき`);
    expect(getPendingReferral()).toBeNull();
    expect(local.getItem('core_pending_ref_v1')).toBeNull();
  });

  it('clearPendingReferral は両方の保存を消す (適用後に二度と復活しない)', () => {
    visitInviteLink('?ref=ABCDEF&from=なおき&msg=どうぞ');
    clearPendingReferral();

    expect(getPendingReferral()).toBeNull();
    expect(getPendingReferralInviter()).toBe('');
    expect(getPendingReferralMessage()).toBe('');
    expect(local.getItem('core_pending_ref_v1')).toBeNull();

    reopenBrowser();
    expect(getPendingReferral()).toBeNull();
  });
});
