// ============================================================
// 招待文の「嘘」を止めるための回帰テスト (2026-08-23)
//
// この 4 つの文章は、アプリの中で唯一「あなた以外の人」に届く文章。
// 受け取った友達は中身を確かめられないので、ここが間違っていると
// そのまま信じたまま登録画面に来てしまう。
//
// 実際に起きていたこと:
//  - Iris (リールを作るアプリ) の招待文に、Prism の「AI 役員」の話が入っていた
//  - LINE は「AI 13 役員」、X は「14 人の AI 役員」と、
//    同じ画面から送る 2 つの文章で人数が食い違っていた
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  productPitch, shareTextLine, shareTextX, shareTextMail, shareTextGeneric,
} from '../inviteShareText';
import { TRIAL_BASE_DAYS, REFERRAL_BONUS_DAYS, TRIAL_WITH_REFERRAL_DAYS } from '../../lib/referral';

const URL_IRIS = 'https://example.test/?ref=ABC234';

/** 文章に出てくる数字を全部拾う */
function numbersIn(s: string): number[] {
  return (s.match(/\d+/g) || []).map(Number);
}

describe('招待文 — 受け取った人に嘘をつかない', () => {
  it('Iris の紹介文は、Prism の機能 (AI 役員) を名乗らない', () => {
    const pitch = productPitch('iris');
    expect(pitch).not.toMatch(/役員/);
    // リール制作アプリだと分かる語が入っていること
    expect(pitch).toMatch(/リール|字幕|投稿文/);
  });

  it('Prism の紹介文は、Prism がやることを書いている', () => {
    expect(productPitch('prism')).toMatch(/役員|請求書|議事録/);
  });

  it('紹介文に「N 人 / N 役員」のような、確かめられない人数を書かない', () => {
    // 人数はアプリ内でも 13 / 14 が混在しているので、招待文には載せない
    for (const brand of ['iris', 'prism'] as const) {
      expect(productPitch(brand)).not.toMatch(/\d+\s*(人|名|役員)/);
    }
  });

  it('LINE と X の招待文で、日数の言い分が食い違わない', () => {
    for (const brand of ['iris', 'prism'] as const) {
      const line = new Set(numbersIn(shareTextLine(URL_IRIS, brand, 'なお')));
      const x = new Set(numbersIn(shareTextX(URL_IRIS, brand, 'なお')));
      // URL 由来の数字を除いて、片方だけに出る「日数っぽい数」が無いこと
      const urlNums = new Set(numbersIn(URL_IRIS));
      const only = (a: Set<number>, b: Set<number>) =>
        [...a].filter((n) => !b.has(n) && !urlNums.has(n));
      expect(only(line, x)).toEqual([]);
      expect(only(x, line)).toEqual([]);
    }
  });

  it('4 チャネルすべてが、同じ無料日数 (3 / 7 / 10) を約束する', () => {
    for (const brand of ['iris', 'prism'] as const) {
      const texts = [
        shareTextLine(URL_IRIS, brand, ''),
        shareTextX(URL_IRIS, brand, ''),
        shareTextMail(URL_IRIS, brand, '').body,
        shareTextGeneric(URL_IRIS, brand, ''),
      ];
      for (const t of texts) {
        expect(t).toContain(String(TRIAL_BASE_DAYS));
        expect(t).toContain(String(REFERRAL_BONUS_DAYS));
        expect(t).toContain(String(TRIAL_WITH_REFERRAL_DAYS));
      }
    }
  });

  it('4 チャネルすべてに、招待リンクが入っている', () => {
    for (const brand of ['iris', 'prism'] as const) {
      expect(shareTextLine(URL_IRIS, brand, '')).toContain(URL_IRIS);
      expect(shareTextX(URL_IRIS, brand, '')).toContain(URL_IRIS);
      expect(shareTextMail(URL_IRIS, brand, '').body).toContain(URL_IRIS);
      expect(shareTextGeneric(URL_IRIS, brand, '')).toContain(URL_IRIS);
    }
  });
});
