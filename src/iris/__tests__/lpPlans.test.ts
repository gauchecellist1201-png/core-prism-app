// ============================================================
// Iris LP の料金表が「実際に開ける機能」しか約束していないことを固定する。
//
// 2026-08-19 の事故:
//   LP の Standard(¥6,980) に「AI企画・台本スタジオ」と書いてあったが、
//   PLAN_LIMITS.standard に script-studio が無く（= undefined = unavailable）、
//   契約した人が台本タブを開くと「最上位プラン Pro 限定」の錠前が出ていた。
//   料金表は「お金を受け取るページ」なので、ここが実装とずれると必ず嘘になる。
// ============================================================
import { describe, it, expect } from 'vitest';
import { IRIS_LP_PLANS, LP_CLAIM_KEYWORDS, CARD_FREE_CLAIMS } from '../lpPlans';
import { checkFeature, PLAN_LIMITS } from '../../lib/billing';

describe('Iris LP 料金表 — 書いた約束はゲート表が実際に開ける', () => {
  it('requires に書いた機能は、そのプランで allowed である', () => {
    const broken: string[] = [];
    for (const plan of IRIS_LP_PLANS) {
      for (const feature of plan.requires ?? []) {
        const gate = checkFeature(plan.id, feature);
        if (!gate.allowed) {
          broken.push(`${plan.name}(${plan.price}) は「${feature}」を約束しているのに ${plan.id} では使えない（必要なプラン: ${gate.upgradeTo ?? '不明'}）`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('文言に鍵つき機能の名前を書いたら、そのプランでその機能が開いている', () => {
    // requires の書き忘れを、表示している日本語の側から捕まえる。
    const broken: string[] = [];
    for (const plan of IRIS_LP_PLANS) {
      const text = plan.features.join(' / ');
      for (const { keyword, feature } of LP_CLAIM_KEYWORDS) {
        if (!text.includes(keyword)) continue;
        const gate = checkFeature(plan.id, feature);
        if (!gate.allowed) {
          broken.push(`${plan.name} の文言に「${keyword}」があるのに ${plan.id} では ${feature} が使えない`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('逆テスト: 使えない機能を約束したら、ちゃんと落ちる', () => {
    // このテスト自身が空振りしていないことを確かめる。
    // Lite に script-studio は無いので、checkFeature は必ず not-allowed を返す。
    const gate = checkFeature('lite', 'script-studio');
    expect(gate.allowed).toBe(false);
    expect(gate.upgradeTo).toBe('pro');
  });

  it('LP に載せたプランは、ゲート表に実在する id である', () => {
    for (const plan of IRIS_LP_PLANS) {
      expect(PLAN_LIMITS[plan.id], `${plan.id} が PLAN_LIMITS に無い`).toBeTruthy();
    }
  });

  it('企画・台本スタジオを載せているのは、それが開くプランだけ', () => {
    // 2026-08-19 に直した現物そのもの。Standard に戻ってきたら落ちる。
    const withStudio = IRIS_LP_PLANS.filter(p => p.features.some(f => f.includes('台本スタジオ')));
    expect(withStudio.length).toBeGreaterThan(0);
    for (const p of withStudio) {
      expect(checkFeature(p.id, 'script-studio').allowed, `${p.name} で台本スタジオが開かない`).toBe(true);
    }
  });

  it('有料プランの但し書きに「クレカ不要」と書かない（実際はカードが要る）', () => {
    // CheckoutModal は `if (!isFree)` のときだけ /api/stripe/checkout を叩く。
    // つまり価格が付いたプランを選んだ人は必ずカードを登録する。
    const broken: string[] = [];
    for (const plan of IRIS_LP_PLANS) {
      if (!plan.cardRequired) continue;
      for (const claim of CARD_FREE_CLAIMS) {
        if (plan.note.includes(claim)) broken.push(`${plan.name} の但し書きに「${claim}」`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('有料プランは価格が0円でなく、但し書きが月額の始まりに触れている', () => {
    for (const plan of IRIS_LP_PLANS) {
      if (!plan.cardRequired) continue;
      expect(plan.price, `${plan.name} の価格`).not.toBe('¥0');
      expect(plan.note, `${plan.name} の但し書きが月額の開始に触れていない`).toMatch(/月/);
      // 表示価格と但し書きの金額がずれていないこと（片方だけ直す事故を防ぐ）
      expect(plan.note, `${plan.name} の但し書きに ${plan.price} が無い`).toContain(plan.price);
    }
  });

  it('錠前が案内する Pro は、LP に値段つきで載っている（行き止まりにしない）', () => {
    // アプリの錠前は planId 'pro' へ誘導する。LP に無ければ値段不明の行き止まりになる。
    const pro = IRIS_LP_PLANS.find(p => p.id === 'pro');
    expect(pro, 'LP に Pro カードが無い').toBeTruthy();
    expect(pro!.price).toMatch(/^¥[\d,]+$/);
  });
});
