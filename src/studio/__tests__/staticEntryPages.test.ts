// ============================================================
// 生成HTML（scripts/genRoutePages.mjs）と、画面が使うデータ（src/studio/*.ts）が
// 食い違っていないかを見る検査。
//
// なぜ要るか（2026-09-07 に2回続けて事故ったため）:
//   同じ事実が2箇所に書かれている。
//     ・SPA本文   … src/studio/film.ts / plans.ts （型があり、テストも通る）
//     ・静的HTML … scripts/genRoutePages.mjs にベタ書き（誰も見ていない）
//   静的HTMLは JSを実行しないクローラー（GPTBot / ClaudeBot / Google）に
//   本文として渡る面なので、ここが古いと「AI検索が古い条件を答える」状態になる。
//   実際 2026-09-07 に修正回数を変えたとき、SPA側だけ直して静的HTML側に
//   「修正無制限」が残ったまま本番に出た。過去にも実績数が「6+」のまま残っている。
//
// ★この検査は npm run build ではなく vitest で回す。
//   専用の npm script にすると「走らせ忘れ」が起きるため、既存のテスト一式に混ぜる。
//
// 直し方: 落ちたら scripts/genRoutePages.mjs を直して `node scripts/genRoutePages.mjs`。
//         生成されたHTMLを直接編集しても次の build で消える。
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FILM_PLANS, REVISION, MONTHLY_PLANS } from '../film';
import { PRODUCTION_PLANS, DEV_TIERS, CARE_PLANS, WORKS } from '../plans';

const ROOT = resolve(__dirname, '../../..');
const read = (file: string) => readFileSync(resolve(ROOT, file), 'utf8');

describe('静的入口HTMLが、画面のデータと食い違っていない', () => {
  it('映像制作: 3プランの金額が生成HTMLに載っている', () => {
    const html = read('studio-film.html');
    for (const plan of FILM_PLANS) {
      expect(html, `${plan.name} の金額 ${plan.price} が studio-film.html に無い`).toContain(plan.price);
    }
  });

  it('映像制作: 月額の最小金額が生成HTMLに載っている', () => {
    const html = read('studio-film.html');
    const cheapest = Math.min(...MONTHLY_PLANS.map(m => m.priceYen));
    expect(html).toContain(`¥${cheapest.toLocaleString('ja-JP')}`);
  });

  it('映像制作: 修正回数が REVISION.rules と一致し、古い「無制限」が残っていない', () => {
    const html = read('studio-film.html');
    // 全プランで同じ回数にしている前提が崩れたら、静的HTMLの1行では表せなくなる
    const counts = new Set(REVISION.rules.map(r => r.count));
    expect(counts.size, `プランごとに修正回数が違う（${[...counts].join(' / ')}）。静的HTMLは1行で書いているので、genRoutePages.mjs の書き方から見直すこと`).toBe(1);

    const count = REVISION.rules[0].count;
    expect(html, `修正回数「${count}」が studio-film.html に無い`).toContain(count);
    expect(html, '古い「無制限」が studio-film.html に残っている').not.toContain('無制限');
  });

  it('サイト制作: 4プランの金額が生成HTMLに載っている', () => {
    const html = read('studio-plans.html');
    for (const plan of PRODUCTION_PLANS) {
      expect(html, `${plan.name} の金額 ${plan.price} が studio-plans.html に無い`).toContain(plan.price);
    }
  });

  it('サイト制作: 実績件数の主張が WORKS の実数と一致する', () => {
    const html = read('studio-plans.html');
    // 「公開中の実績は8件です」— 数えられる主張なので、数え直して合っているかを見る
    const claimed = html.match(/公開中の実績は(\d+)件/);
    expect(claimed, '「公開中の実績は◯件」の記述が studio-plans.html から消えている').not.toBeNull();
    expect(Number(claimed![1]), `静的HTMLは${claimed![1]}件と書いているが、WORKS は ${WORKS.length} 件`).toBe(WORKS.length);
  });

  it('受託開発: 4Tierの金額が生成HTMLに載っている', () => {
    const html = read('studio-dev.html');
    for (const tier of DEV_TIERS) {
      expect(html, `${tier.name} の金額 ${tier.price} が studio-dev.html に無い`).toContain(tier.price);
    }
  });

  it('運用: 2プランの金額が生成HTMLに載っている', () => {
    const html = read('studio-care.html');
    for (const plan of CARE_PLANS) {
      expect(html, `${plan.name} の金額 ${plan.price} が studio-care.html に無い`).toContain(plan.price);
    }
  });
});
