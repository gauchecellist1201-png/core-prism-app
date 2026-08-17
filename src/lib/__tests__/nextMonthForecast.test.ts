// 「来月の見込み」に来月以外のものが混ざったら落ちるテスト。
// 2026-08-17 に実測した不具合 — 進行中案件をクローズ予定日を見ずに全部足しており、
// デモの田中さんでは確度加重 ¥1,643,000 のうち ¥1,347,000 (82%) が予定日ぎれだった。
import { describe, it, expect } from 'vitest';
import {
  computeNextMonthForecast,
  describeForecast,
  weightedAmount,
  isOpenDeal,
} from '../nextMonthForecast';
import type { CRMDeal, CRMStage } from '../../types/crm';

const NOW = new Date(2026, 7, 17, 12, 0, 0).getTime(); // 2026-08-17 (ローカル)

function deal(p: {
  title: string;
  amount?: number;
  probability?: number;
  stage?: CRMStage;
  expectedCloseDate?: string;
}): CRMDeal {
  return {
    id: p.title,
    personaId: 'p1',
    title: p.title,
    amount: p.amount,
    probability: p.probability,
    stage: p.stage ?? 'proposal',
    expectedCloseDate: p.expectedCloseDate,
    activities: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// 実際のデモデータ (core_crm_deals_v1) をそのまま写したもの
const DEMO: CRMDeal[] = [
  deal({ title: '渋谷2号店 物件契約', amount: 1200000, probability: 60, stage: 'proposal', expectedCloseDate: '2026-07-31' }),
  deal({ title: 'コーヒー豆 年間卸契約', amount: 480000, probability: 80, stage: 'negotiation', expectedCloseDate: '2026-06-15' }),
  deal({ title: '法人定期 5社目候補', amount: 600000, probability: 40, stage: 'qualified', expectedCloseDate: '2026-08-31' }),
  deal({ title: 'POS リプレース', amount: 280000, probability: 20, stage: 'lead', expectedCloseDate: '2026-09-30' }),
  deal({ title: 'コーヒー教室 法人研修', amount: 360000, probability: 50, stage: 'proposal', expectedCloseDate: '2026-07-15' }),
  deal({ title: '焙煎機リース', amount: 720000, probability: 100, stage: 'won', expectedCloseDate: '2026-04-20' }),
  deal({ title: 'コーヒー卸 (老舗)', amount: 240000, probability: 0, stage: 'lost', expectedCloseDate: '2026-03-10' }),
  deal({ title: '焼き菓子 OEM', amount: 180000, probability: 35, stage: 'qualified', expectedCloseDate: '2026-08-15' }),
];

describe('computeNextMonthForecast — 来月の話だけを来月の見込みに入れる', () => {
  it('デモの8件では、来月クローズ予定の1件 (¥56,000) だけが積まれる', () => {
    const f = computeNextMonthForecast({ baseJpy: 914414, deals: DEMO, now: NOW });
    expect(f.includedCount).toBe(1);          // POS リプレース (2026-09-30) のみ
    expect(f.pipelineJpy).toBe(56000);        // 280,000 × 20%
    expect(f.totalJpy).toBe(914414 + 56000);
  });

  it('旧式 (予定日を見ずに全部足す) の ¥1,643,000 には戻らない', () => {
    const f = computeNextMonthForecast({ baseJpy: 0, deals: DEMO, now: NOW });
    const naive = DEMO.filter(isOpenDeal).reduce((s, d) => s + weightedAmount(d), 0);
    expect(naive).toBe(1643000);              // 旧式ならこの額
    expect(f.pipelineJpy).toBeLessThan(naive);
    expect(f.pipelineJpy).toBe(56000);
  });

  it('外した案件は黙って消さず、理由ごとに件数と金額が残る', () => {
    const f = computeNextMonthForecast({ baseJpy: 914414, deals: DEMO, now: NOW });
    const byReason = Object.fromEntries(f.excluded.map((g) => [g.reason, g]));
    // 予定日ぎれ: 7/31, 6/15, 7/15, 8/15 の 4 件
    expect(byReason.overdue.count).toBe(4);
    expect(byReason.overdue.weightedJpy).toBe(720000 + 384000 + 180000 + 63000);
    // 今月中に決まる: 8/31 の 1 件 (来月ではない = 「今月稼いだ」と二重計上しない)
    expect(byReason.thisMonth.count).toBe(1);
    expect(byReason.thisMonth.weightedJpy).toBe(240000);
    // 外した合計 + 入れた分 = 進行中案件すべて (1件も行方不明にしない)
    const droppedCount = f.excluded.reduce((s, g) => s + g.count, 0);
    expect(droppedCount + f.includedCount).toBe(DEMO.filter(isOpenDeal).length);
  });

  it('受注・失注は最初から数えない', () => {
    const f = computeNextMonthForecast({ baseJpy: 0, deals: DEMO, now: NOW });
    const touched = f.excluded.reduce((s, g) => s + g.count, 0) + f.includedCount;
    expect(touched).toBe(6); // 8件のうち won/lost の 2 件を除く
  });

  it('予定日が今日ちょうどの案件は「遅れている」に入れない', () => {
    const today = computeNextMonthForecast({
      baseJpy: 0,
      deals: [deal({ title: '今日', amount: 100000, probability: 50, expectedCloseDate: '2026-08-17' })],
      now: NOW,
    });
    expect(today.overdue.count).toBe(0);
    expect(today.excluded.find((g) => g.reason === 'thisMonth')?.count).toBe(1);
  });

  it('来月の初日と末日は「来月」に入る (境界の1日で数字が変わらない)', () => {
    const f = computeNextMonthForecast({
      baseJpy: 0,
      deals: [
        deal({ title: '来月初日', amount: 100000, probability: 100, expectedCloseDate: '2026-09-01' }),
        deal({ title: '来月末日', amount: 100000, probability: 100, expectedCloseDate: '2026-09-30' }),
        deal({ title: '再来月初日', amount: 100000, probability: 100, expectedCloseDate: '2026-10-01' }),
      ],
      now: NOW,
    });
    expect(f.includedCount).toBe(2);
    expect(f.pipelineJpy).toBe(200000);
    expect(f.excluded.find((g) => g.reason === 'later')?.count).toBe(1);
  });

  it('12月に見ると、来月は翌年1月として扱う', () => {
    const dec = new Date(2026, 11, 10, 12, 0, 0).getTime();
    const f = computeNextMonthForecast({
      baseJpy: 0,
      deals: [deal({ title: '1月案件', amount: 500000, probability: 100, expectedCloseDate: '2027-01-15' })],
      now: dec,
    });
    expect(f.includedCount).toBe(1);
    expect(f.pipelineJpy).toBe(500000);
  });

  it('予定日が未入力の案件は、来月に入ると言い切らない', () => {
    const f = computeNextMonthForecast({
      baseJpy: 0,
      deals: [deal({ title: '未定', amount: 900000, probability: 90 })],
      now: NOW,
    });
    expect(f.pipelineJpy).toBe(0);
    expect(f.excluded.find((g) => g.reason === 'undated')?.count).toBe(1);
  });

  it('過去売上0 + 来月ぶんも極小なら、¥600 のような数字を出さない', () => {
    const f = computeNextMonthForecast({
      baseJpy: 0,
      deals: [deal({ title: '極小', amount: 1000, probability: 60, expectedCloseDate: '2026-09-10' })],
      now: NOW,
    });
    expect(f.totalJpy).toBeNull();
  });

  it('金額や確度が無い案件で NaN を作らない', () => {
    const f = computeNextMonthForecast({
      baseJpy: 100000,
      deals: [
        deal({ title: '金額なし', probability: 50, expectedCloseDate: '2026-09-10' }),
        deal({ title: '確度なし', amount: 500000, expectedCloseDate: '2026-09-10' }),
      ],
      now: NOW,
    });
    expect(Number.isFinite(f.pipelineJpy)).toBe(true);
    expect(f.pipelineJpy).toBe(0);
    expect(f.totalJpy).toBe(100000);
  });

  it('案件が1件も無くても落ちない', () => {
    const f = computeNextMonthForecast({ baseJpy: 500000, deals: [], now: NOW });
    expect(f.totalJpy).toBe(500000);
    expect(f.excluded).toEqual([]);
    expect(f.overdue.count).toBe(0);
  });

  it('説明文は「何を入れて、何件外したか」を必ず言う', () => {
    const f = computeNextMonthForecast({ baseJpy: 914414, deals: DEMO, now: NOW });
    const s = describeForecast(f);
    expect(s).toContain('直近 3 ヶ月の平均');
    expect(s).toContain('来月クローズ予定 1 件');
    expect(s).toContain('5 件は来月の数字ではないので入れていません');
  });

  it('出せる数字が無い時の説明文は、数字を約束しない', () => {
    const f = computeNextMonthForecast({ baseJpy: 0, deals: [], now: NOW });
    expect(f.totalJpy).toBeNull();
    expect(describeForecast(f)).toBe('案件を入れると、来月の数字が見えます');
  });
});
