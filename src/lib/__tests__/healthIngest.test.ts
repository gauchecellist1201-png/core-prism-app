import { describe, expect, it } from 'vitest';
import {
  getAppleHealthSyncState,
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

describe('Apple Health sync continuity', () => {
  it('keeps today and yesterday within the normal daily-sync window', () => {
    expect(getAppleHealthSyncState([
      { date: '2026-09-14', source: 'ios-shortcut' },
    ], '2026-09-14')).toEqual({ kind: 'current', latestDate: '2026-09-14', daysBehind: 0 });
    expect(getAppleHealthSyncState([
      { date: '2026-09-13', source: 'apple-health' },
    ], '2026-09-14')).toEqual({ kind: 'current', latestDate: '2026-09-13', daysBehind: 1 });
  });

  it('marks Apple Health as stale after two missing calendar days', () => {
    expect(getAppleHealthSyncState([
      { date: '2026-09-12', source: 'ios-shortcut' },
    ], '2026-09-14')).toEqual({ kind: 'stale', latestDate: '2026-09-12', daysBehind: 2 });
  });

  it('does not let a newer manual or Bluetooth record hide a stopped Apple Health sync', () => {
    expect(getAppleHealthSyncState([
      { date: '2026-09-11', source: 'ios-shortcut' },
      { date: '2026-09-14', source: 'web-bluetooth' },
      { date: '2026-09-14', source: 'manual' },
    ], '2026-09-14')).toEqual({ kind: 'stale', latestDate: '2026-09-11', daysBehind: 3 });
  });

  it('keeps same-day Apple evidence after a later source overwrites the display source', () => {
    expect(getAppleHealthSyncState([
      { date: '2026-09-14', source: 'web-bluetooth', appleHealthReceived: true },
    ], '2026-09-14')).toEqual({ kind: 'current', latestDate: '2026-09-14', daysBehind: 0 });
  });

  it('does not claim a connection from missing, malformed, or non-Apple sources', () => {
    expect(getAppleHealthSyncState([], '2026-09-14')).toEqual({ kind: 'not-connected' });
    expect(getAppleHealthSyncState([
      { date: '2026-02-30', source: 'ios-shortcut' },
      { date: '2026-09-14', source: 'web-bluetooth' },
    ], '2026-09-14')).toEqual({ kind: 'not-connected' });
  });

  it('ignores a corrupted far-future date instead of hiding an older stopped sync', () => {
    expect(getAppleHealthSyncState([
      { date: '2099-01-01', source: 'ios-shortcut' },
      { date: '2026-09-11', source: 'ios-shortcut' },
    ], '2026-09-14')).toEqual({ kind: 'stale', latestDate: '2026-09-11', daysBehind: 3 });
  });
});
