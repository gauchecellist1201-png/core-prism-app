// ============================================================
// Universal Health CSV Importer
// Oura / Whoop / Fitbit / Garmin の公式エクスポート CSV を自動判別
// ============================================================
import type { DailyHealth } from '../types/health';

export type CsvSource = 'oura' | 'whoop' | 'fitbit' | 'garmin' | 'generic';

export interface CsvImportResult {
  source: CsvSource;
  daysProduced: number;
  rowsRead: number;
  unmatched: string[]; // どの列がマップされなかったか
}

// シンプルな CSV パーサ (引用符・カンマ対応)
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (s: string) => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') {
        if (inQ && s[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        out.push(cur);
        cur = '';
      } else cur += c;
    }
    out.push(cur);
    return out.map(v => v.trim());
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const cols = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

// ヘッダから出処を判別
function detectSource(headers: string[]): CsvSource {
  const hl = headers.map(h => h.toLowerCase());
  if (hl.some(h => /sleep score|readiness score|hrv balance/.test(h))) return 'oura';
  if (hl.some(h => /day strain|recovery score|nap duration|whoop/i.test(h))) return 'whoop';
  if (hl.some(h => /minutes very active|fairly active|sedentary minutes/.test(h))) return 'fitbit';
  if (hl.some(h => /total kilocalories|total steps|stress avg/.test(h))) return 'garmin';
  return 'generic';
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const s = v.replace(/,/g, '').replace(/[^\d.\-]/g, '');
  const n = Number(s);
  return isFinite(n) ? n : 0;
}
function asDate(v: string | undefined): string | null {
  if (!v) return null;
  // ISO や YYYY-MM-DD, YYYY/MM/DD など対応
  const m = v.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const y = m[1], mo = m[2].padStart(2, '0'), d = m[3].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function findCol(headers: string[], patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const h = headers.find(h => p.test(h));
    if (h) return h;
  }
  return null;
}

// ─── 各サービス用マッパー ────────────────────────────────
function mapOura(rows: Record<string, string>[], headers: string[]): DailyHealth[] {
  const dateCol = findCol(headers, [/^date$/i, /summary[- ]date/i]) || headers[0];
  const out: DailyHealth[] = [];
  for (const r of rows) {
    const date = asDate(r[dateCol]);
    if (!date) continue;
    const sleepHours = num(r['Total Sleep Duration'] || r['Asleep Time']) / 3600 || num(r['Total Sleep']);
    const deepMin = num(r['Deep Sleep Duration'] || r['Deep Sleep']) / 60;
    const remMin = num(r['REM Sleep Duration'] || r['REM Sleep']) / 60;
    const sleepScore = num(r['Sleep Score'] || r['Score']) || 0;
    const hrv = num(r['Average HRV'] || r['HRV Balance Score'] || r['HRV']);
    const restingHR = num(r['Lowest Resting Heart Rate'] || r['Average Resting Heart Rate']);
    const recoveryScore = num(r['Readiness Score'] || r['Recovery']);
    const steps = num(r['Steps'] || r['Activity Score']);
    const activeMinutes = num(r['Medium Activity Time'] || r['High Activity Time']) / 60;
    const exerciseKcal = num(r['Active Calories'] || r['Total Burn']);
    out.push({
      date,
      sleepHours: round(sleepHours || 0, 1),
      deepSleepMin: Math.round(deepMin || 0),
      remSleepMin: Math.round(remMin || 0),
      sleepScore: Math.round(sleepScore),
      hrv: Math.round(hrv || 0),
      restingHR: Math.round(restingHR || 0),
      recoveryScore: Math.round(recoveryScore || 0),
      steps: Math.round(steps),
      activeMinutes: Math.round(activeMinutes),
      exerciseKcal: Math.round(exerciseKcal),
      stressLevel: 0,
      mindfulMinutes: 0,
      hydrationL: 0,
      caffeineMg: 0,
      alcoholDrinks: 0,
    });
  }
  return out;
}

function mapWhoop(rows: Record<string, string>[], headers: string[]): DailyHealth[] {
  const dateCol = findCol(headers, [/cycle start time/i, /^date$/i]) || headers[0];
  const out: DailyHealth[] = [];
  for (const r of rows) {
    const date = asDate(r[dateCol]);
    if (!date) continue;
    const sleepHours = num(r['Sleep duration (min)'] || r['Asleep duration (min)']) / 60;
    const recoveryScore = num(r['Recovery score %'] || r['Recovery score']);
    const hrv = num(r['Heart rate variability (ms)'] || r['HRV (ms)']);
    const restingHR = num(r['Resting heart rate (bpm)'] || r['RHR']);
    const strain = num(r['Day Strain'] || r['Strain']);
    const exerciseKcal = num(r['Energy burned (kcal)']);
    out.push({
      date,
      sleepHours: round(sleepHours || 0, 1),
      deepSleepMin: Math.round(num(r['Deep (SWS) duration (min)']) || 0),
      remSleepMin: Math.round(num(r['REM duration (min)']) || 0),
      sleepScore: Math.round(num(r['Sleep performance %']) || 0),
      hrv: Math.round(hrv),
      restingHR: Math.round(restingHR),
      recoveryScore: Math.round(recoveryScore),
      steps: 0,
      activeMinutes: Math.round(strain * 10),
      exerciseKcal: Math.round(exerciseKcal),
      stressLevel: 0,
      mindfulMinutes: 0,
      hydrationL: 0,
      caffeineMg: 0,
      alcoholDrinks: 0,
    });
  }
  return out;
}

function mapFitbit(rows: Record<string, string>[], headers: string[]): DailyHealth[] {
  const dateCol = findCol(headers, [/^date$/i]) || headers[0];
  const out: DailyHealth[] = [];
  for (const r of rows) {
    const date = asDate(r[dateCol]);
    if (!date) continue;
    out.push({
      date,
      sleepHours: round(num(r['Minutes Asleep']) / 60, 1),
      deepSleepMin: Math.round(num(r['Minutes Deep'])),
      remSleepMin: Math.round(num(r['Minutes REM'])),
      sleepScore: Math.round(num(r['Sleep Score']) || 0),
      hrv: 0,
      restingHR: Math.round(num(r['Resting Heart Rate'])),
      recoveryScore: 0,
      steps: Math.round(num(r['Steps'])),
      activeMinutes: Math.round(num(r['Minutes Very Active']) + num(r['Minutes Fairly Active'])),
      exerciseKcal: Math.round(num(r['Calories Burned']) || num(r['Activity Calories'])),
      stressLevel: 0,
      mindfulMinutes: Math.round(num(r['Minutes of Mindfulness'])),
      hydrationL: round(num(r['Water']) / 1000, 2),
      caffeineMg: 0,
      alcoholDrinks: 0,
      weightKg: num(r['Weight']) || undefined,
      bodyFatPct: num(r['Fat']) || undefined,
    });
  }
  return out;
}

function mapGarmin(rows: Record<string, string>[], headers: string[]): DailyHealth[] {
  const dateCol = findCol(headers, [/^date$/i, /day/i]) || headers[0];
  const out: DailyHealth[] = [];
  for (const r of rows) {
    const date = asDate(r[dateCol]);
    if (!date) continue;
    out.push({
      date,
      sleepHours: round(num(r['Sleep Duration (h)'] || r['Total Sleep']) || 0, 1),
      deepSleepMin: Math.round(num(r['Deep Sleep (min)']) || 0),
      remSleepMin: Math.round(num(r['REM Sleep (min)']) || 0),
      sleepScore: Math.round(num(r['Sleep Score']) || 0),
      hrv: Math.round(num(r['HRV Status'] || r['Avg HRV'])),
      restingHR: Math.round(num(r['Resting Heart Rate'] || r['RHR'])),
      recoveryScore: Math.round(num(r['Body Battery Charged']) || num(r['Body Battery'])),
      steps: Math.round(num(r['Total Steps'] || r['Steps'])),
      activeMinutes: Math.round(num(r['Intensity Minutes'] || r['Active Minutes'])),
      exerciseKcal: Math.round(num(r['Total Kilocalories'] || r['Active Calories'])),
      stressLevel: Math.round(num(r['Stress Avg'] || r['Average Stress'])),
      mindfulMinutes: 0,
      hydrationL: round(num(r['Hydration (ml)']) / 1000, 2),
      caffeineMg: 0,
      alcoholDrinks: 0,
      weightKg: num(r['Weight (kg)']) || undefined,
    });
  }
  return out;
}

function mapGeneric(rows: Record<string, string>[], headers: string[]): DailyHealth[] {
  // 列名から推測でマップ
  const dateCol = findCol(headers, [/^date$/i, /day/i, /timestamp/i]) || headers[0];
  const stepsCol = findCol(headers, [/steps?/i]);
  const sleepCol = findCol(headers, [/sleep.*hour/i, /total sleep/i]);
  const hrvCol = findCol(headers, [/hrv/i]);
  const rhrCol = findCol(headers, [/resting/i, /rhr/i]);
  const out: DailyHealth[] = [];
  for (const r of rows) {
    const date = asDate(r[dateCol]);
    if (!date) continue;
    out.push({
      date,
      sleepHours: round(sleepCol ? num(r[sleepCol]) : 0, 1),
      deepSleepMin: 0, remSleepMin: 0, sleepScore: 0,
      hrv: hrvCol ? Math.round(num(r[hrvCol])) : 0,
      restingHR: rhrCol ? Math.round(num(r[rhrCol])) : 0,
      recoveryScore: 0,
      steps: stepsCol ? Math.round(num(r[stepsCol])) : 0,
      activeMinutes: 0, exerciseKcal: 0, stressLevel: 0,
      mindfulMinutes: 0, hydrationL: 0, caffeineMg: 0, alcoholDrinks: 0,
    });
  }
  return out;
}

function round(v: number, p: number) { const f = Math.pow(10, p); return Math.round(v * f) / f; }

export async function importHealthCsv(file: File): Promise<{ days: DailyHealth[]; result: CsvImportResult }> {
  const text = await file.text();
  const { headers, rows } = parseCsv(text);
  const source = detectSource(headers);
  let days: DailyHealth[];
  switch (source) {
    case 'oura':   days = mapOura(rows, headers); break;
    case 'whoop':  days = mapWhoop(rows, headers); break;
    case 'fitbit': days = mapFitbit(rows, headers); break;
    case 'garmin': days = mapGarmin(rows, headers); break;
    default:       days = mapGeneric(rows, headers);
  }
  // 直近 90 日に絞る
  const today = new Date();
  const cutoff = new Date(today); cutoff.setDate(today.getDate() - 180);
  days = days.filter(d => new Date(d.date) >= cutoff);
  return {
    days,
    result: {
      source,
      daysProduced: days.length,
      rowsRead: rows.length,
      unmatched: [],
    },
  };
}
