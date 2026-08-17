import { describe, it, expect } from 'vitest';
import {
  REAL_OPEN_CALLS, OPEN_CALL_FRESH_DAYS,
  verifiedAgeDays, verifiedLabel, oldestVerifiedAgeDays, openCallsBadge,
  rankOpenCalls, inferPreferredCategories,
  type OpenCall,
} from '../realOpenCalls';

// ============================================================
// 本物の公開募集 — 「検証済み」という札が、勝手に古くならないこと
//
// なぜこのテストが要るか:
//   この一覧は、Iris の中で唯一「本当にお金につながる」場所。
//   2026-06-14 に人が手で 6 件確認し、画面には緑のチェックで
//   「実在・検証済み 6 件」と出していた。65 日後 (2026-08-18) に測り直すと
//   **2 件が落ちていた**（1 件はサイトごと停止、1 件は HTTP 200 を返しながら
//   中身がメンテナンス告知）。それでも札は同じ顔のままだった。
//   ここでは「日がたてば言い方が変わる」ことを固定する。
//   ＝札の文言を1回書いて終わりにできないようにする。
// ============================================================

const day = (s: string) => new Date(`${s}T12:00:00`);

function call(over: Partial<OpenCall> = {}): OpenCall {
  return {
    id: 'x', name: 'n', org: 'o', category: 'beauty', kind: 'brand',
    summary: 's', reward: 'r', requirement: 'q',
    applyUrl: 'https://example.com/apply', verifiedAt: '2026-08-18',
    ...over,
  };
}

describe('何日前に確かめたのか', () => {
  it('同じ日なら 0 日', () => {
    expect(verifiedAgeDays('2026-08-18', day('2026-08-18'))).toBe(0);
  });

  it('月をまたいでも日数で数える', () => {
    expect(verifiedAgeDays('2026-06-14', day('2026-08-18'))).toBe(65);
  });

  it('未来の日付は「今日」に丸める（先の日付で新しく見せない）', () => {
    expect(verifiedAgeDays('2026-12-31', day('2026-08-18'))).toBe(0);
  });

  it('壊れた日付は null（勝手に 0 日＝新しい、とは言わない）', () => {
    expect(verifiedAgeDays('', day('2026-08-18'))).toBeNull();
    expect(verifiedAgeDays('2026/08/18', day('2026-08-18'))).toBeNull();
  });
});

describe('画面に出す言い方', () => {
  it('今日・昨日・N日前を言い分ける', () => {
    expect(verifiedLabel('2026-08-18', day('2026-08-18'))).toBe('今日 確認');
    expect(verifiedLabel('2026-08-17', day('2026-08-18'))).toBe('昨日 確認');
    expect(verifiedLabel('2026-08-15', day('2026-08-18'))).toBe('3日前に確認');
  });

  it('日付が壊れていても、日付そのものは隠さない', () => {
    expect(verifiedLabel('こわれた', day('2026-08-18'))).toBe('こわれた 確認');
  });
});

describe('見出しの札', () => {
  const calls = [call({ verifiedAt: '2026-08-18' }), call({ id: 'y', verifiedAt: '2026-08-16' })];

  it('確認したてなら緑のチェック側（fresh）', () => {
    const b = openCallsBadge(calls, day('2026-08-18'));
    expect(b.fresh).toBe(true);
    expect(b.text).toContain('2 件');
  });

  it(`${OPEN_CALL_FRESH_DAYS} 日を超えたら「検証済み」と名乗らない`, () => {
    const b = openCallsBadge(calls, day('2026-10-01'));
    expect(b.fresh).toBe(false);
    expect(b.text).not.toContain('検証済み');
    // 何日前に見たのかは必ず言う（黙って古くならない）
    expect(b.text).toMatch(/\d+日前に確認/);
    // 古いときは「今すぐ応募できる」と言い切らず、確認をうながす
    expect(b.note).toContain('公式ページ');
  });

  it('札はいちばん古い1件に引きずられる（新しい1件で全体を新しく見せない）', () => {
    const mixed = [call({ verifiedAt: '2026-08-18' }), call({ id: 'old', verifiedAt: '2026-06-14' })];
    expect(oldestVerifiedAgeDays(mixed, day('2026-08-18'))).toBe(65);
    expect(openCallsBadge(mixed, day('2026-08-18')).fresh).toBe(false);
  });

  it('0 件でも落ちない', () => {
    expect(oldestVerifiedAgeDays([], day('2026-08-18'))).toBeNull();
    expect(() => openCallsBadge([], day('2026-08-18'))).not.toThrow();
  });
});

describe('いま載せている募集そのもの', () => {
  it('2026-08-18 に開けなかった 2 件は載っていない', () => {
    const urls = REAL_OPEN_CALLS.map(c => c.applyUrl);
    // Cloudflare Error 1000 (DNS points to prohibited IP) でサイトごと停止
    expect(urls.some(u => u.includes('brandcosme.com'))).toBe(false);
    // HTTP 200 を返しながら中身は「メンテナンスに伴うサイト一時停止のお知らせ」
    expect(urls.some(u => u.includes('dot-st.com'))).toBe(false);
  });

  it('応募先はすべて https で、id は重複しない', () => {
    for (const c of REAL_OPEN_CALLS) expect(c.applyUrl.startsWith('https://')).toBe(true);
    expect(new Set(REAL_OPEN_CALLS.map(c => c.id)).size).toBe(REAL_OPEN_CALLS.length);
  });

  it('verifiedAt は全件そろって読める形', () => {
    for (const c of REAL_OPEN_CALLS) {
      expect(verifiedAgeDays(c.verifiedAt, day('2026-08-18'))).not.toBeNull();
    }
  });
});

describe('プロフィールからの並べ替え（手掛かりが無いときは何も名乗らない）', () => {
  it('美容の言葉があれば美容の募集が先頭へ来る', () => {
    const prefs = inferPreferredCategories('スキンケアとコスメが好きな20代');
    expect(prefs[0]).toBe('beauty');
    const ranked = rankOpenCalls(prefs);
    expect(ranked[0].matched).toBe(true);
    expect(ranked[0].category).toBe('beauty');
  });

  it('手掛かりが無ければ推定しない（誤ったバッジを出さない）', () => {
    expect(inferPreferredCategories(undefined, '', '   ')).toEqual([]);
  });
});
