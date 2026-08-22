// ============================================================
// 公開ページ (/studio/film) の価格と、営業OSが持っている控えがズレたら落ちるテスト。
//
// 控えが黙って古くなると、営業OSは「食い違いなし」と表示したまま
// 公開ページと違う金額を客先に出す。それが一番の事故なので、
// 正本 (src/studio/film.ts) を直接読んで突き合わせる。
// ============================================================
import { describe, expect, it } from 'vitest';
import { FILM_PLANS, MONTHLY_PLANS } from '../../studio/film';
import { PUBLISHED_PRICES, priceConflicts, mayQuotePrice } from '../shared/catalog';

const snap = (label: string) => PUBLISHED_PRICES.find(p => p.label === label);

describe('公開価格の控え', () => {
  it('単発3プランの金額が film.ts と一致している', () => {
    const byId = new Map(FILM_PLANS.map(p => [p.id, p.priceYen]));
    expect(snap('単発1本 TRIAL (20秒)')?.yen).toBe(byId.get('trial'));
    expect(snap('単発1本 STANDARD (40秒)')?.yen).toBe(byId.get('standard'));
    expect(snap('単発1本 PREMIUM (60秒)')?.yen).toBe(byId.get('premium'));
  });

  it('月額3プランの金額が film.ts と一致している', () => {
    const byId = new Map(MONTHLY_PLANS.map(p => [p.id, p.priceYen]));
    expect(snap('月4本')?.yen).toBe(byId.get('m4'));
    expect(snap('月8本')?.yen).toBe(byId.get('m8'));
    expect(snap('月12本')?.yen).toBe(byId.get('m12'));
  });

  it('食い違いがある間は、生成物に金額を書かせない', () => {
    // どちらでも成立するが、両者は必ず逆であること
    expect(mayQuotePrice()).toBe(priceConflicts().length === 0);
  });
});
