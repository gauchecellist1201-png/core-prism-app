import { describe, expect, it } from 'vitest';
import { calculateWorkflowScan } from '../workflowScanData';

const base = {
  industry: '製造',
  workflow: '見積・受注処理',
  frequency: 40,
  minutes: 15,
  people: 2,
  hourly: 3500,
};

describe('calculateWorkflowScan', () => {
  it('入力した頻度・時間・人数から年間工数を算出する', () => {
    const result = calculateWorkflowScan({ ...base, repeatability: 4, digital: 4, rules: 4, exceptions: 4, approval: 4 });
    expect(result.annualHours).toBe(240);
    expect(result.suitability).toBe(100);
    expect(result.low).toBe(72);
    expect(result.high).toBe(132);
    expect(result.valueLow).toBe(252000);
    expect(result.valueHigh).toBe(462000);
  });

  it('実装条件が低い業務では、人の判断を残す提案にする', () => {
    const result = calculateWorkflowScan({ ...base, repeatability: 1, digital: 1, rules: 1, exceptions: 1, approval: 1 });
    expect(result.suitability).toBe(25);
    expect(result.low).toBe(12);
    expect(result.high).toBe(36);
    expect(result.title).toContain('人の判断');
  });
});
