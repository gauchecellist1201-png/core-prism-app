// ============================================================
// Apple Health XML parser — regex robustness tests
//
// 直近で <Record .../> 正規表現を /<Record\s+([^>]+?)\/?>/g に修正した。
// この修正で「自己閉じ」「metadata 子要素を持つ Record (=非自己閉じ)」
// どちらも 1 件として拾えることをガード。
// ============================================================
import { describe, it, expect } from 'vitest';
import { importAppleHealthXml } from '../appleHealthImport';

const HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="ja_JP">
`;
const FOOTER = `</HealthData>`;

/** Builds a self-closing Record XML element. */
function selfClosingRecord(
  type: string,
  startDate: string,
  endDate: string,
  value: string,
  unit?: string,
): string {
  return `<Record type="${type}" sourceName="iPhone" unit="${unit ?? ''}" startDate="${startDate}" endDate="${endDate}" value="${value}"/>`;
}

/** Builds a Record with a nested <MetadataEntry .../> child (non self-closing). */
function recordWithMetadata(
  type: string,
  startDate: string,
  endDate: string,
  value: string,
  unit?: string,
): string {
  return `<Record type="${type}" sourceName="iPhone" unit="${unit ?? ''}" startDate="${startDate}" endDate="${endDate}" value="${value}">
  <MetadataEntry key="HKTimeZone" value="Asia/Tokyo"/>
</Record>`;
}

describe('importAppleHealthXml — regex covers self-closing / metadata / mixed records', () => {
  it('parses self-closing Record-only XML and produces at least one day', async () => {
    const xml = HEADER + [
      selfClosingRecord(
        'HKQuantityTypeIdentifierStepCount',
        '2026-05-10 08:00:00 +0900',
        '2026-05-10 08:30:00 +0900',
        '1234',
        'count',
      ),
      selfClosingRecord(
        'HKQuantityTypeIdentifierRestingHeartRate',
        '2026-05-10 09:00:00 +0900',
        '2026-05-10 09:00:01 +0900',
        '58',
        'count/min',
      ),
    ].join('\n') + '\n' + FOOTER;

    const days = await importAppleHealthXml(xml);
    expect(days.length).toBeGreaterThanOrEqual(1);
    const d = days.find((x) => x.date === '2026-05-10');
    expect(d).toBeDefined();
    expect(d!.steps).toBe(1234);
  });

  it('parses Record-with-metadata (non self-closing) and produces at least one day', async () => {
    const xml = HEADER + [
      recordWithMetadata(
        'HKCategoryTypeIdentifierSleepAnalysis',
        '2026-05-09 23:00:00 +0900',
        '2026-05-10 06:30:00 +0900',
        'HKCategoryValueSleepAnalysisAsleepCore',
      ),
      recordWithMetadata(
        'HKQuantityTypeIdentifierStepCount',
        '2026-05-10 12:00:00 +0900',
        '2026-05-10 12:30:00 +0900',
        '500',
        'count',
      ),
    ].join('\n') + '\n' + FOOTER;

    const days = await importAppleHealthXml(xml);
    expect(days.length).toBeGreaterThanOrEqual(1);
    // sleep is bucketed to endDate, so 2026-05-10 should exist
    const d = days.find((x) => x.date === '2026-05-10');
    expect(d).toBeDefined();
    expect(d!.sleepHours).toBeGreaterThan(0);
  });

  it('parses a mixture of self-closing and metadata Records and still produces days', async () => {
    const xml = HEADER + [
      selfClosingRecord(
        'HKQuantityTypeIdentifierStepCount',
        '2026-05-10 08:00:00 +0900',
        '2026-05-10 08:30:00 +0900',
        '2000',
        'count',
      ),
      recordWithMetadata(
        'HKCategoryTypeIdentifierSleepAnalysis',
        '2026-05-09 23:00:00 +0900',
        '2026-05-10 06:30:00 +0900',
        'HKCategoryValueSleepAnalysisAsleepCore',
      ),
      selfClosingRecord(
        'HKQuantityTypeIdentifierRestingHeartRate',
        '2026-05-10 09:00:00 +0900',
        '2026-05-10 09:00:01 +0900',
        '62',
        'count/min',
      ),
      recordWithMetadata(
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        '2026-05-10 10:00:00 +0900',
        '2026-05-10 11:00:00 +0900',
        '320',
        'kcal',
      ),
    ].join('\n') + '\n' + FOOTER;

    const days = await importAppleHealthXml(xml);
    expect(days.length).toBeGreaterThanOrEqual(1);
    const d = days.find((x) => x.date === '2026-05-10');
    expect(d).toBeDefined();
    expect(d!.steps).toBe(2000);
    expect(d!.sleepHours).toBeGreaterThan(0);
    expect(d!.exerciseKcal).toBe(320);
  });
});
