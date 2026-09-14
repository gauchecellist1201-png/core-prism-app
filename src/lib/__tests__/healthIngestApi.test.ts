import { describe, expect, it } from 'vitest';
import { mergeDailyMetrics, type DailyMetric } from '../../../api/health/ingest';

describe('health ingest source lineage', () => {
  const appleDay: DailyMetric = {
    date: '2026-09-14',
    source: 'ios-shortcut',
    appleHealthReceived: true,
    metrics: { steps: 8421 },
    ts: 1,
  };

  it('preserves Apple Health evidence when Bluetooth updates the same date later', () => {
    expect(mergeDailyMetrics([appleDay], [{
      date: '2026-09-14',
      source: 'web-bluetooth',
      metrics: { restingHR: 58 },
      ts: 2,
    }])).toEqual([{
      date: '2026-09-14',
      source: 'web-bluetooth',
      appleHealthReceived: true,
      metrics: { steps: 8421, restingHR: 58 },
      ts: 2,
    }]);
  });

  it('upgrades a manual row when Apple Health arrives later on the same date', () => {
    const [merged] = mergeDailyMetrics([{
      date: '2026-09-14',
      source: 'manual',
      metrics: { mood: 4 },
    }], [appleDay]);
    expect(merged?.appleHealthReceived).toBe(true);
    expect(merged?.metrics).toEqual({ mood: 4, steps: 8421 });
  });
});
