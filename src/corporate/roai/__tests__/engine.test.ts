import { describe, it, expect } from 'vitest';
import { computeRoai, sanitizeAnswers, WEIGHTS, ASSUMPTIONS, formatYen, formatRangeYen, potentialOf } from '../engine';
import { ALL_QUESTIONS, QUESTIONS, INDUSTRY_QUESTIONS, activeQuestions, type Answers } from '../schema';
import { RETURNS } from '../model';

// ============================================================
// CORE ROAI SCORE は「AI がなんとなく 73 点」ではなく、同じ回答なら同じ数字を返し、
// すべての金額に根拠が付く。ここではその性質を守る。
// ============================================================

/** 全部「いちばん改善余地が大きい」側で答えた会社（35 人・年商 2 億） */
const HEAVY: Answers = {
  industry: 'realestate', employees: 'e3', revenue: 'r3', biz_type: 'both', sales_share: 's3', backoffice_share: 'o2', inquiries: 'q3',
  sales_nonselling: 'n4', proposal_hours: 'p4', response_time: 't4', dormant: 'd3', crm: 'c3',
  data_entry: 'h4', documents: 'w4', email: 'm4', outsourcing: 'x3', standardized: 'z3',
  decision_data: 'k4', approval: 'a4', time_to_market: 'l4',
  loss_impact: 'i3', security_posture: 'g3', key_person: 'y3',
  data_assets: 'v2', service_ai: 'u1', customer_agent: 'f1',
  data_location: 'dl3', commitment: 'cm2', literacy: 'li3', budget: 'bg2',
  ind_re_response: 'rr4',
};

/** 全部「整っている」側で答えた会社 */
const LIGHT: Answers = {
  industry: 'it', employees: 'e2', revenue: 'r2', biz_type: 'b2b', sales_share: 's1', backoffice_share: 'o1', inquiries: 'q1',
  sales_nonselling: 'n1', proposal_hours: 'p1', response_time: 't1', dormant: 'd1', crm: 'c1',
  data_entry: 'h1', documents: 'w1', email: 'm1', outsourcing: 'x1', standardized: 'z1',
  decision_data: 'k1', approval: 'a1', time_to_market: 'l1',
  loss_impact: 'i1', security_posture: 'g1', key_person: 'y1',
  data_assets: 'v3', service_ai: 'u3', customer_agent: 'f3',
  data_location: 'dl1', commitment: 'cm1', literacy: 'li1', budget: 'bg4',
};

describe('schema integrity', () => {
  it('question ids and option values are unique', () => {
    const ids = ALL_QUESTIONS.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of ALL_QUESTIONS) {
      const vals = q.options.map(o => o.value);
      expect(new Set(vals).size, q.id).toBe(vals.length);
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
    }
  });
  it('every Return question has a score on every option (0..1)', () => {
    const returnKeys = new Set(RETURNS.map(r => r.key));
    for (const q of ALL_QUESTIONS) {
      if (!returnKeys.has(q.category as never)) continue;
      for (const o of q.options) {
        expect(typeof o.score, `${q.id}/${o.value}`).toBe('number');
        expect(o.score!).toBeGreaterThanOrEqual(0);
        expect(o.score!).toBeLessThanOrEqual(1);
      }
    }
  });
  it('readiness questions carry ready values', () => {
    for (const q of QUESTIONS.filter(q => q.category === 'readiness')) {
      for (const o of q.options) expect(typeof o.ready, q.id).toBe('number');
    }
  });
  it('question count stays in the 3–5 minute band (20–32)', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(20);
    expect(QUESTIONS.length).toBeLessThanOrEqual(32);
  });
  it('industry questions appear only for their industry, after their category', () => {
    const re = activeQuestions({ industry: 'realestate' });
    const it_ = activeQuestions({ industry: 'it' });
    expect(re.some(q => q.id === 'ind_re_response')).toBe(true);
    expect(it_.some(q => q.id === 'ind_re_response')).toBe(false);
    expect(re.length).toBe(QUESTIONS.length + 1);
    const idx = re.findIndex(q => q.id === 'ind_re_response');
    expect(re[idx - 1].category).toBe('grow');
    expect(re[idx + 1].category).not.toBe('grow');
    expect(INDUSTRY_QUESTIONS.every(q => q.when?.industry?.length)).toBe(true);
  });
  it('score weights sum to 1', () => {
    const { opportunity, magnitude, readiness } = WEIGHTS.score;
    expect(opportunity + magnitude + readiness).toBeCloseTo(1, 10);
  });
});

describe('computeRoai — determinism & shape', () => {
  it('same answers → identical result', () => {
    expect(computeRoai(HEAVY)).toEqual(computeRoai(HEAVY));
  });
  it('complete flag reflects active question set', () => {
    const r = computeRoai(HEAVY);
    expect(r.complete).toBe(true);
    expect(r.total).toBe(QUESTIONS.length + 1);
    const p = computeRoai({ industry: 'it', employees: 'e2' });
    expect(p.complete).toBe(false);
    expect(p.answered).toBe(2);
  });
  it('scores are within 0..100 and priorities cover all 5 Returns', () => {
    for (const a of [HEAVY, LIGHT, {}]) {
      const r = computeRoai(a);
      expect(r.score).toBeGreaterThanOrEqual(0); expect(r.score).toBeLessThanOrEqual(100);
      expect(r.readiness).toBeGreaterThanOrEqual(0); expect(r.readiness).toBeLessThanOrEqual(100);
      for (const k of RETURNS.map(x => x.key)) {
        expect(r.categoryScores[k]).toBeGreaterThanOrEqual(0);
        expect(r.categoryScores[k]).toBeLessThanOrEqual(100);
      }
      expect(r.priorities.map(p => p.key).sort()).toEqual(RETURNS.map(x => x.key).sort());
      expect(r.priorities[0].rank).toBe(1);
    }
  });
  it('empty answers do not crash and produce zero value', () => {
    const r = computeRoai({});
    expect(r.value.total.mid).toBe(0);
    expect(r.score).toBe(0);
    expect(r.lead.tier).toBe('NURTURE');
  });
});

describe('computeRoai — economics', () => {
  it('heavy company has more opportunity, more value, less readiness than light company', () => {
    const h = computeRoai(HEAVY), l = computeRoai(LIGHT);
    expect(h.scoreBreakdown.opportunity).toBeGreaterThan(l.scoreBreakdown.opportunity);
    expect(h.value.total.mid).toBeGreaterThan(l.value.total.mid);
    expect(h.readiness).toBeLessThan(l.readiness);
  });
  it('ranges are ordered low ≤ mid ≤ high and total is the sum of parts', () => {
    const r = computeRoai(HEAVY);
    for (const k of ['hoursSaved', 'productivity', 'costReduction', 'revenue', 'lossAvoidance', 'total'] as const) {
      const v = r.value[k];
      expect(v.low).toBeLessThanOrEqual(v.mid);
      expect(v.mid).toBeLessThanOrEqual(v.high);
      expect(v.basis.length, k).toBeGreaterThan(0);
    }
    const v = r.value;
    expect(v.total.mid).toBeCloseTo(v.productivity.mid + v.costReduction.mid + v.revenue.mid + v.lossAvoidance.mid, 6);
  });
  it('hours saved follows the documented formula', () => {
    const r = computeRoai(HEAVY);
    const emp = 35, sales = Math.round(35 * 0.5), bo = Math.round(35 * 0.25), desk = Math.min(emp, sales + bo);
    const A = ASSUMPTIONS;
    const expected =
      8 * bo * A.weeksPerYear * A.automation.dataEntry +
      8 * desk * A.weeksPerYear * A.automation.documents +
      12 * desk * A.weeksPerYear * A.automation.email +
      0.6 * 40 * sales * A.weeksPerYear * A.automation.salesNonSelling +
      16 * A.proposalsPerSalesPerMonth * 12 * sales * A.automation.proposal;
    expect(r.value.hoursSaved.mid).toBe(Math.round(expected));
    expect(r.value.productivity.mid).toBeCloseTo(Math.round(expected) * A.hourlyCost, 6);
  });
  it('loss avoidance = impact × probability × reduction', () => {
    const r = computeRoai(HEAVY);
    expect(r.value.lossAvoidance.mid).toBeCloseTo(20_000_000 * 0.15 * ASSUMPTIONS.lossReduction, 6);
  });
  it('revenue opportunity never exceeds the sum of uplift caps', () => {
    const r = computeRoai(HEAVY);
    const cap = Object.values(ASSUMPTIONS.uplift).reduce((s, v) => s + v, 0);
    expect(r.value.revenue.high).toBeLessThanOrEqual(200_000_000 * cap + 1);
    expect(r.value.revenue.low).toBeCloseTo(r.value.revenue.high * ASSUMPTIONS.upliftLowRatio, 6);
  });
  it('investment capacity = total.mid ÷ target ROAI, table is monotone', () => {
    const r = computeRoai(HEAVY);
    expect(r.capacity.indicative).toBeCloseTo(r.value.total.mid / ASSUMPTIONS.targetRoai, 6);
    const inv = r.capacity.table.map(t => t.investment);
    for (let i = 1; i < inv.length; i++) expect(inv[i]).toBeLessThan(inv[i - 1]);
    expect(r.budget.declared).toBe(3_000_000);
    expect(r.budget.gapNote).toBeTruthy();
  });
  it('every basis entry has a kind from the 4 allowed sources', () => {
    const r = computeRoai(HEAVY);
    const kinds = new Set(['input', 'benchmark', 'assumption', 'formula']);
    for (const v of Object.values(r.value)) for (const b of v.basis) expect(kinds.has(b.kind)).toBe(true);
    for (const b of r.capacity.basis) expect(kinds.has(b.kind)).toBe(true);
    // 未回答は「仮定」として明示される
    const partial = computeRoai({ data_entry: 'h4' });
    expect(partial.value.hoursSaved.basis.some(b => b.kind === 'assumption' && b.value.includes('既定値'))).toBe(true);
  });
});

describe('computeRoai — recommendation & lead', () => {
  it('low readiness + high opportunity → prepare mode', () => {
    const r = computeRoai(HEAVY);
    expect(r.readiness).toBeLessThan(WEIGHTS.prepareReadinessBelow);
    expect(r.recommendation.mode).toBe('prepare');
    expect(r.roadmap[0].items.join(' ')).toContain('データの置き場');
  });
  it('ready company with a strong top priority → build mode', () => {
    const a: Answers = { ...HEAVY, data_location: 'dl1', commitment: 'cm1', literacy: 'li1', standardized: 'z1', crm: 'c1', security_posture: 'g1', decision_data: 'k1', data_assets: 'v1' };
    const r = computeRoai(a);
    expect(r.readiness).toBeGreaterThanOrEqual(WEIGHTS.prepareReadinessBelow);
    expect(r.recommendation.mode).toBe('build');
    expect(r.recommendation.headline).toContain(r.priorities[0].titleJa);
  });
  it('light company → focus mode', () => {
    expect(computeRoai(LIGHT).recommendation.mode).toBe('focus');
  });
  it('roadmap has 3 phases with items', () => {
    const r = computeRoai(HEAVY);
    expect(r.roadmap.length).toBe(3);
    for (const p of r.roadmap) expect(p.items.length).toBeGreaterThanOrEqual(3);
  });
  it('lead tier is HOT for large value + budget + commitment, NURTURE for tiny', () => {
    const hot = computeRoai({ ...HEAVY, budget: 'bg3', commitment: 'cm1' });
    expect(hot.lead.tier).toBe('HOT');
    const tiny = computeRoai({ employees: 'e1', revenue: 'r1', budget: 'bg1', commitment: 'cm3' });
    expect(tiny.lead.tier).toBe('NURTURE');
  });
  it('potential bands', () => {
    expect(potentialOf(75)).toBe('HIGH');
    expect(potentialOf(60)).toBe('MEDIUM-HIGH');
    expect(potentialOf(45)).toBe('MEDIUM');
    expect(potentialOf(44)).toBe('LOW');
  });
});

describe('sanitizeAnswers', () => {
  it('drops unknown ids, unknown values, non-strings', () => {
    const out = sanitizeAnswers({ industry: 'it', employees: 'zzz', nope: 'x', revenue: 3, data_entry: 'h2' });
    expect(out).toEqual({ industry: 'it', data_entry: 'h2' });
    expect(sanitizeAnswers(null)).toEqual({});
    expect(sanitizeAnswers('str')).toEqual({});
  });
});

describe('formatting', () => {
  it('formats yen in 万 / 億 with coarse rounding', () => {
    expect(formatYen(1_234_567)).toBe('¥120万');
    expect(formatYen(28_400_000)).toBe('¥2,800万');
    expect(formatYen(123_000_000)).toBe('¥1.2億');
    expect(formatYen(2_560_000_000)).toBe('¥26億');
    expect(formatRangeYen({ low: 0, high: 0 })).toBe('—');
    expect(formatRangeYen({ low: 10_000_000, high: 20_000_000 })).toBe('¥1,000万〜¥2,000万');
  });
});
