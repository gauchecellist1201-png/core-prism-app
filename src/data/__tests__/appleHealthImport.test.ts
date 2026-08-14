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

// 日付を固定で書くと、その日から 90 日たった時点で全部が窓の外へ落ち、
// 「パーサは正常なのにテストだけ赤い」が起きる (実際に 2026-05-10 固定で起きた)。
// テストの中の日付は、必ず「今日から見て何日前」で作る。
function dayKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const DAY0 = dayKey(3);      // 「その日」
const DAY_PREV = dayKey(4);  // 前の晩 (睡眠の開始)

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
        `${DAY0} 08:00:00 +0900`,
        `${DAY0} 08:30:00 +0900`,
        '1234',
        'count',
      ),
      selfClosingRecord(
        'HKQuantityTypeIdentifierRestingHeartRate',
        `${DAY0} 09:00:00 +0900`,
        `${DAY0} 09:00:01 +0900`,
        '58',
        'count/min',
      ),
    ].join('\n') + '\n' + FOOTER;

    const days = await importAppleHealthXml(xml);
    expect(days.length).toBeGreaterThanOrEqual(1);
    const d = days.find((x) => x.date === DAY0);
    expect(d).toBeDefined();
    expect(d!.steps).toBe(1234);
  });

  it('parses Record-with-metadata (non self-closing) and produces at least one day', async () => {
    const xml = HEADER + [
      recordWithMetadata(
        'HKCategoryTypeIdentifierSleepAnalysis',
        `${DAY_PREV} 23:00:00 +0900`,
        `${DAY0} 06:30:00 +0900`,
        'HKCategoryValueSleepAnalysisAsleepCore',
      ),
      recordWithMetadata(
        'HKQuantityTypeIdentifierStepCount',
        `${DAY0} 12:00:00 +0900`,
        `${DAY0} 12:30:00 +0900`,
        '500',
        'count',
      ),
    ].join('\n') + '\n' + FOOTER;

    const days = await importAppleHealthXml(xml);
    expect(days.length).toBeGreaterThanOrEqual(1);
    // sleep is bucketed to endDate, so DAY0 should exist
    const d = days.find((x) => x.date === DAY0);
    expect(d).toBeDefined();
    expect(d!.sleepHours).toBeGreaterThan(0);
  });

  it('parses a mixture of self-closing and metadata Records and still produces days', async () => {
    const xml = HEADER + [
      selfClosingRecord(
        'HKQuantityTypeIdentifierStepCount',
        `${DAY0} 08:00:00 +0900`,
        `${DAY0} 08:30:00 +0900`,
        '2000',
        'count',
      ),
      recordWithMetadata(
        'HKCategoryTypeIdentifierSleepAnalysis',
        `${DAY_PREV} 23:00:00 +0900`,
        `${DAY0} 06:30:00 +0900`,
        'HKCategoryValueSleepAnalysisAsleepCore',
      ),
      selfClosingRecord(
        'HKQuantityTypeIdentifierRestingHeartRate',
        `${DAY0} 09:00:00 +0900`,
        `${DAY0} 09:00:01 +0900`,
        '62',
        'count/min',
      ),
      recordWithMetadata(
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        `${DAY0} 10:00:00 +0900`,
        `${DAY0} 11:00:00 +0900`,
        '320',
        'kcal',
      ),
    ].join('\n') + '\n' + FOOTER;

    const days = await importAppleHealthXml(xml);
    expect(days.length).toBeGreaterThanOrEqual(1);
    const d = days.find((x) => x.date === DAY0);
    expect(d).toBeDefined();
    expect(d!.steps).toBe(2000);
    expect(d!.sleepHours).toBeGreaterThan(0);
    expect(d!.exerciseKcal).toBe(320);
  });
});

// ============================================================
// 「取り込んだのに 0 日」— 窓の起点が今日だったせいで、少し前に書き出した
// ZIP を入れた人は 1 日も残らなかった。画面には緑のチェックで
// 「インポート完了 · 0 日分」とだけ出て、理由はどこにも出ていなかった。
// ============================================================
describe('importAppleHealthXml — 古い書き出しでも黙って空にしない', () => {
  it('半年前に書き出したファイルでも、その中の直近ぶんを取り込む', async () => {
    const old0 = dayKey(180);
    const old1 = dayKey(179);
    const xml = HEADER + [
      selfClosingRecord('HKQuantityTypeIdentifierStepCount', `${old0} 08:00:00 +0900`, `${old0} 08:30:00 +0900`, '3000', 'count'),
      selfClosingRecord('HKQuantityTypeIdentifierStepCount', `${old1} 08:00:00 +0900`, `${old1} 08:30:00 +0900`, '4000', 'count'),
    ].join('\n') + '\n' + FOOTER;

    const days = await importAppleHealthXml(xml);
    expect(days.map((d) => d.date)).toEqual([old0, old1]);
    expect(days[0].steps).toBe(3000);
    expect(days[1].steps).toBe(4000);
  });

  it('窓の長さ 90 日は変えない — 起点より前の日は入らない', async () => {
    const newest = dayKey(200);
    const inWindow = dayKey(200 + 89);
    const tooOld = dayKey(200 + 90);
    const xml = HEADER + [
      selfClosingRecord('HKQuantityTypeIdentifierStepCount', `${newest} 08:00:00 +0900`, `${newest} 08:30:00 +0900`, '10', 'count'),
      selfClosingRecord('HKQuantityTypeIdentifierStepCount', `${inWindow} 08:00:00 +0900`, `${inWindow} 08:30:00 +0900`, '20', 'count'),
      selfClosingRecord('HKQuantityTypeIdentifierStepCount', `${tooOld} 08:00:00 +0900`, `${tooOld} 08:30:00 +0900`, '30', 'count'),
    ].join('\n') + '\n' + FOOTER;

    const days = await importAppleHealthXml(xml);
    const dates = days.map((d) => d.date);
    expect(dates).toContain(newest);
    expect(dates).toContain(inWindow);
    expect(dates).not.toContain(tooOld);
  });

  it('未来の日付が 1 行混じっていても、今日までの記録を落とさない', async () => {
    const future = dayKey(-400); // 400 日後
    const real0 = dayKey(2);
    const real1 = dayKey(1);
    const xml = HEADER + [
      selfClosingRecord('HKQuantityTypeIdentifierStepCount', `${future} 08:00:00 +0900`, `${future} 08:30:00 +0900`, '99', 'count'),
      selfClosingRecord('HKQuantityTypeIdentifierStepCount', `${real0} 08:00:00 +0900`, `${real0} 08:30:00 +0900`, '111', 'count'),
      selfClosingRecord('HKQuantityTypeIdentifierStepCount', `${real1} 08:00:00 +0900`, `${real1} 08:30:00 +0900`, '222', 'count'),
    ].join('\n') + '\n' + FOOTER;

    const days = await importAppleHealthXml(xml);
    const dates = days.map((d) => d.date);
    expect(dates).toContain(real0);
    expect(dates).toContain(real1);
    expect(dates).not.toContain(future);
  });

  it('日付が読めない行しか無いときは、空を返さずに理由を投げる', async () => {
    const xml = HEADER +
      '<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="----" endDate="----" value="10"/>\n' +
      FOOTER;

    await expect(importAppleHealthXml(xml)).rejects.toThrow(/日付として読める行/);
  });

  it('日付が読めない行が混ざっていても、読める日は取り込む', async () => {
    const good = dayKey(5);
    const xml = HEADER + [
      '<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="----" endDate="----" value="10"/>',
      selfClosingRecord('HKQuantityTypeIdentifierStepCount', `${good} 08:00:00 +0900`, `${good} 08:30:00 +0900`, '777', 'count'),
    ].join('\n') + '\n' + FOOTER;

    const days = await importAppleHealthXml(xml);
    expect(days.map((d) => d.date)).toEqual([good]);
    expect(days[0].steps).toBe(777);
  });
});
