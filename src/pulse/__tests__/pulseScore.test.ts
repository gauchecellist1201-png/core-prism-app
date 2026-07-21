import { describe, it, expect } from 'vitest';
import type { DailyHealth } from '../../types/health';
import {
  scorePulseDay, scoreLabel, scoreLastDays, baselineOf,
  SCORE_MAX,
} from '../pulseScore';

const mk = (over: Partial<DailyHealth> = {}): DailyHealth => ({
  date: '2026-07-21', sleepHours: 0, deepSleepMin: 0, remSleepMin: 0, sleepScore: 0,
  hrv: 0, restingHR: 0, recoveryScore: 0, steps: 0, activeMinutes: 0,
  exerciseKcal: 0, stressLevel: 0, mindfulMinutes: 0, hydrationL: 0,
  caffeineMg: 0, alcoholDrinks: 0, ...over,
});

/** ふだん: ねむり7h / ゆらぎ60ms / 脈60回 / 8,000歩 が14日続いた記録 */
const prior = Array.from({ length: 14 }, (_, i) =>
  mk({ date: `2026-07-${String(i + 1).padStart(2, '0')}`, sleepHours: 7, hrv: 60, restingHR: 60, steps: 8000 }),
);

describe('scorePulseDay', () => {
  it('良い日は満点100になる (睡眠8h・ゆらぎ高め・脈低め・9,000歩)', () => {
    const r = scorePulseDay(mk({ sleepHours: 8, hrv: 66, restingHR: 55, steps: 9000 }), prior);
    expect(r.parts).toEqual({ sleep: 40, hrv: 25, resting: 20, steps: 15 });
    expect(r.total).toBe(100);
    expect(r.label).toBe('とてもよい');
  });

  it('内訳の合計 = 総合点 (表示の嘘を作らない)', () => {
    const r = scorePulseDay(mk({ sleepHours: 6.3, hrv: 52, restingHR: 63, steps: 5400 }), prior);
    expect(r.total).toBe(r.parts.sleep + r.parts.hrv + r.parts.resting + r.parts.steps);
    expect(r.total).toBeGreaterThan(0);
    expect(r.total).toBeLessThanOrEqual(100);
  });

  it('ねむりは7時間で満点・3.5時間で半分', () => {
    expect(scorePulseDay(mk({ sleepHours: 7 }), prior).parts.sleep).toBe(SCORE_MAX.sleep);
    expect(scorePulseDay(mk({ sleepHours: 3.5 }), prior).parts.sleep).toBe(SCORE_MAX.sleep / 2);
  });

  it('脈がふだんの115%以上に上がると脈は0点', () => {
    const r = scorePulseDay(mk({ restingHR: 70 }), prior); // 70/60 ≈ 1.17
    expect(r.parts.resting).toBe(0);
  });

  it('ゆらぎがふだんの60%以下に下がるとゆらぎは0点', () => {
    const r = scorePulseDay(mk({ hrv: 36 }), prior); // 36/60 = 0.6
    expect(r.parts.hrv).toBe(0);
  });

  it('ふだんが無い時 (記録3日未満) は絶対値の目安で採点する', () => {
    const r = scorePulseDay(mk({ hrv: 60, restingHR: 55 }), []);
    expect(r.parts.hrv).toBe(SCORE_MAX.hrv);       // 60ms → 満点
    expect(r.parts.resting).toBe(SCORE_MAX.resting); // 55回 → 満点
  });

  it('データが無い日は total 0 / hasData false', () => {
    const r = scorePulseDay(mk(), prior);
    expect(r.total).toBe(0);
    expect(r.hasData).toBe(false);
    expect(scorePulseDay(undefined, prior).hasData).toBe(false);
  });
});

describe('scoreLabel', () => {
  it('境界値', () => {
    expect(scoreLabel(85)).toBe('とてもよい');
    expect(scoreLabel(70)).toBe('よい');
    expect(scoreLabel(50)).toBe('ふつう');
    expect(scoreLabel(49)).toBe('ゆっくりの日');
  });
});

describe('baselineOf / scoreLastDays', () => {
  it('ベースラインは正の値の平均・3件未満なら null', () => {
    expect(baselineOf(prior, (d) => d.hrv)).toBe(60);
    expect(baselineOf(prior.slice(0, 2), (d) => d.hrv)).toBeNull();
    expect(baselineOf(prior.map((d) => ({ ...d, hrv: 0 })), (d) => d.hrv)).toBeNull();
  });

  it('7日ぶんのスコア列を返す (各日は 0-100)', () => {
    const days = [...prior, mk({ date: '2026-07-21', sleepHours: 7.5, hrv: 58, restingHR: 59, steps: 9500 })];
    const trend = scoreLastDays(days, 7);
    expect(trend).toHaveLength(7);
    expect(trend[trend.length - 1].date).toBe('2026-07-21');
    for (const t of trend) {
      expect(t.total).toBeGreaterThanOrEqual(0);
      expect(t.total).toBeLessThanOrEqual(100);
    }
  });
});
