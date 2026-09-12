import { describe, expect, it } from 'vitest';
import {
  isAppleHealthSyncSource,
  normalizeIngestedDays,
  toDailyHealth,
} from '../healthIngest';

describe('health ingest normalization', () => {
  it('keeps the real source and maps received metrics into HealthSnapshot data', () => {
    const day = toDailyHealth({
      date: '2026-09-12',
      source: 'ios-shortcut',
      metrics: { steps: 8421, sleepHours: 7.2, restingHR: 58, hrv: 46 },
    });

    expect(day).toMatchObject({
      date: '2026-09-12',
      source: 'ios-shortcut',
      steps: 8421,
      sleepHours: 7.2,
      restingHR: 58,
      hrv: 46,
      stressLevel: 0,
    });
  });

  it('does not turn malformed server rows into local health records', () => {
    expect(normalizeIngestedDays(null)).toEqual([]);
    expect(normalizeIngestedDays([
      null,
      { date: 'today', source: 'ios-shortcut', metrics: { steps: 100 } },
      { date: '2026-09-12', source: 'ios-shortcut', metrics: { steps: 100 } },
    ])).toHaveLength(1);
  });
});

describe('Apple Health sync source', () => {
  it.each(['ios-shortcut', 'apple-health', 'APPLE-WATCH', ' healthkit '])(
    'recognizes %s as automatic Apple Health data',
    (source) => expect(isAppleHealthSyncSource(source)).toBe(true),
  );

  it.each([undefined, '', 'manual', 'web-bluetooth'])('does not badge %s as Apple Health', (source) => {
    expect(isAppleHealthSyncSource(source)).toBe(false);
  });
});
