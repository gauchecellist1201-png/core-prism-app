// ============================================================
// サイト制作プランに「作ったことのない金額の実例」が並んでいないかを見る検査。
//
// なぜ要るか (2026-09-08 オーナー指摘):
//   Pro (¥50〜100万) に朝日館、Signature (¥100万〜) に RAD HOOKAH を
//   「規模の近い実例」として出していた。サイトを作ったのは事実だが、
//   その金額でお受けした案件は1件も無い。見た人は「その値段の実績がある」と読む。
//
//   これは型でもビルドでも落ちない。実例の id は WORKS に実在し、画像も出る。
//   間違っているのは「どの段に付けたか」だけなので、人が気づくまで出続ける。
//
// 直し方:
//   実例を増やしたい → 実際にその金額でお受けしてから plans.ts の
//                      MAX_DELIVERED_YEN を上げ、PLAN_EXAMPLE_OF に足す。
//   金額を変えた     → 上限を超えた段の実例を PLAN_EXAMPLE_OF から外す。
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRODUCTION_PLANS, PLAN_EXAMPLE_OF, MAX_DELIVERED_YEN, WORKS, planMaxYen } from '../plans';

const ROOT = resolve(__dirname, '../../..');

describe('プランの「規模の近い実例」は、実際にお受けした金額の段だけ', () => {
  it('金額表記から上限を正しく読める', () => {
    expect(planMaxYen('¥5万')).toBe(50_000);
    expect(planMaxYen('¥10〜30万')).toBe(300_000);
    expect(planMaxYen('¥50〜100万')).toBe(1_000_000);
    expect(planMaxYen('¥100万〜')).toBe(1_000_000);
  });

  it('MAX_DELIVERED_YEN を超える段に実例が付いていない', () => {
    for (const plan of PRODUCTION_PLANS) {
      const ex = PLAN_EXAMPLE_OF[plan.id];
      if (!ex) continue;
      const max = planMaxYen(plan.price);
      expect(
        max,
        `${plan.name} (${plan.price}) に実例「${ex}」が付いている。` +
          `実際にお受けした最高額は ¥${MAX_DELIVERED_YEN.toLocaleString('ja-JP')} なので、` +
          'この段は実績ではなく「その値段で作ったことがある」という嘘になる',
      ).toBeLessThanOrEqual(MAX_DELIVERED_YEN);
    }
  });

  it('実例の id が WORKS に実在する (消えても静かに枠が出なくなるだけなので)', () => {
    for (const [planId, workId] of Object.entries(PLAN_EXAMPLE_OF)) {
      expect(
        WORKS.some(w => w.id === workId),
        `${planId} の実例 id「${workId}」が WORKS に無い。実例枠が黙って消えている`,
      ).toBe(true);
    }
  });

  it('クローラー向けの静的HTMLにも、上限を超える段の実例が残っていない', () => {
    // 静的HTML は scripts/genRoutePages.mjs のベタ書き。SPA 側だけ直すと必ずここに残る。
    const html = readFileSync(resolve(ROOT, 'studio-plans.html'), 'utf8');
    const line = html.match(/規模の近い実例：([^<]*)/);
    expect(line, '「規模の近い実例：」の行が studio-plans.html から消えている').not.toBeNull();

    for (const plan of PRODUCTION_PLANS) {
      if (planMaxYen(plan.price) <= MAX_DELIVERED_YEN) continue;
      expect(
        line![1],
        `${plan.name} が静的HTMLの実例行に残っている: 「${line![1]}」`,
      ).not.toContain(plan.name);
    }
  });
});
