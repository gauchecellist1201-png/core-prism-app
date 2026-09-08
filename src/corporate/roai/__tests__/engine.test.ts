import { describe, it, expect } from 'vitest';
import { computeRoai, sanitizeAnswers, WEIGHTS, ASSUMPTIONS, formatYen, formatRangeYen, potentialOf, showsDailyStep } from '../engine';
import { ALL_QUESTIONS, QUESTIONS, INDUSTRY_QUESTIONS, activeQuestions, type Answers } from '../schema';
import { RETURNS } from '../model';

// ============================================================
// CORE ROAI SCORE は「AI がなんとなく 73 点」ではなく、同じ回答なら同じ数字を返し、
// すべての金額に根拠が付く。ここではその性質を守る。
//
// 2026-09-08: 23問+業界別 → 13問+業界別 へ圧縮。複数の旧設問を1問へ統合したため、
// HEAVY/LIGHT の回答も新しい設問IDに合わせている。
// ============================================================

/** 全部「いちばん改善余地が大きい」側で答えた会社（35 人・年商 2 億） */
const HEAVY: Answers = {
  industry: 'realestate', employees: 'e3', revenue: 'r3', org_mix: 'om3',
  sales_admin: 'sa4', followup: 'fu4',
  manual_hours: 'mh4', outsourcing: 'x3',
  decision_speed: 'ds4',
  risk_exposure: 're3',
  new_value: 'nv2',
  ai_readiness: 'air3', budget: 'bg2',
  ind_re_response: 'rr4',
};

/** 全部「整っている」側で答えた会社 */
const LIGHT: Answers = {
  industry: 'it', employees: 'e2', revenue: 'r2', org_mix: 'om1',
  sales_admin: 'sa1', followup: 'fu1',
  manual_hours: 'mh1', outsourcing: 'x1',
  decision_speed: 'ds1',
  risk_exposure: 're1',
  new_value: 'nv3',
  ai_readiness: 'air1', budget: 'bg4',
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
  it('question count stays in the 1–2 minute band (10–16), fewer but denser than before', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(10);
    expect(QUESTIONS.length).toBeLessThanOrEqual(16);
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
  it('two-value questions (num + num2) carry both fields on every option', () => {
    const twoValue = ['org_mix', 'risk_exposure'];
    for (const id of twoValue) {
      const q = ALL_QUESTIONS.find(x => x.id === id)!;
      for (const o of q.options) {
        expect(typeof o.num, `${id}/${o.value}`).toBe('number');
        expect(typeof o.num2, `${id}/${o.value}`).toBe('number');
      }
    }
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
  it('hours saved follows the documented formula (manual_hours split via manualSplit)', () => {
    const r = computeRoai(HEAVY);
    const emp = 35, sales = Math.round(35 * 0.15), bo = Math.round(35 * 0.5), desk = Math.min(emp, sales + bo);
    const A = ASSUMPTIONS;
    const manual = 18; // mh4
    const deHours = manual * A.manualSplit.dataEntry;
    const docHours = manual * A.manualSplit.documents;
    const emHours = manual * A.manualSplit.email;
    const expected =
      deHours * bo * A.weeksPerYear * A.automation.dataEntry +
      docHours * desk * A.weeksPerYear * A.automation.documents +
      emHours * desk * A.weeksPerYear * A.automation.email +
      0.6 * 40 * sales * A.weeksPerYear * A.automation.salesNonSelling;
    expect(r.value.hoursSaved.mid).toBe(Math.round(expected));
    expect(r.value.productivity.mid).toBeCloseTo(Math.round(expected) * A.hourlyCost, 6);
  });
  it('loss avoidance = impact × probability × reduction', () => {
    const r = computeRoai(HEAVY);
    expect(r.value.lossAvoidance.mid).toBeCloseTo(100_000_000 * 0.15 * ASSUMPTIONS.lossReduction, 6);
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
    const partial = computeRoai({ manual_hours: 'mh4' });
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
    const a: Answers = { ...HEAVY, ai_readiness: 'air1', outsourcing: 'x1', followup: 'fu1', risk_exposure: 're1', decision_speed: 'ds1', new_value: 'nv1' };
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
  it('lead tier is HOT for large value + budget + readiness, NURTURE for tiny', () => {
    const hot = computeRoai({ ...HEAVY, budget: 'bg3', ai_readiness: 'air1' });
    expect(hot.lead.tier).toBe('HOT');
    const tiny = computeRoai({ employees: 'e1', revenue: 'r1', budget: 'bg1', ai_readiness: 'air3' });
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
    const out = sanitizeAnswers({ industry: 'it', employees: 'zzz', nope: 'x', revenue: 3, manual_hours: 'mh2' });
    expect(out).toEqual({ industry: 'it', manual_hours: 'mh2' });
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

// ── 90日を待たずに始められる場所（CORE NERI）を出す条件 ──────────────
// 2026-09-07 オーナー判断。BRIEF の NEXT ACTION は「メールを渡す」2択しかなく、
// 渡さなかった人には何も残らなかった。ただし全員に自己解決の道を見せると、
// 相談を選ぶはずだった人まで逃がすので、受託が妥当な結果には出さない。
describe('showsDailyStep（BRIEF に NERI を出すか）', () => {
  it('データ整備が先（prepare）と、小さく作って測る（focus）には出す', () => {
    expect(showsDailyStep('prepare')).toBe(true);
    expect(showsDailyStep('focus')).toBe(true);
  });

  it('受託が妥当な結果（build）には出さない。相談申込を自己解決へ逃がさない', () => {
    expect(showsDailyStep('build')).toBe(false);
  });
});
