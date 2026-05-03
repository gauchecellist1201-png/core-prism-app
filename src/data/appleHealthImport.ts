import JSZip from 'jszip';
import type { DailyHealth } from '../types/health';

/**
 * export.zip を直接受け取り、中の export.xml を解凍してパース。
 */
export async function importAppleHealthZip(
  file: File,
  onProgress?: (p: AppleImportProgress) => void,
): Promise<DailyHealth[]> {
  onProgress?.({ phase: 'parsing', recordsRead: 0, daysProduced: 0, message: 'ZIP を解凍中...' });
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  // 一般的に "apple_health_export/export.xml"
  let xmlEntry = zip.file(/apple_health_export\/export\.xml$/i)[0];
  if (!xmlEntry) xmlEntry = zip.file(/export\.xml$/i)[0];
  if (!xmlEntry) {
    throw new Error('ZIP内に export.xml が見つかりません。Apple Health の正規エクスポートZIPか確認してください。');
  }
  const text = await xmlEntry.async('string');
  return importAppleHealthXml(text, onProgress);
}

// Apple Health Export.zip 内 export.xml の主要 HKQuantityTypeIdentifier
// https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier
const APPLE_TYPE = {
  STEPS: 'HKQuantityTypeIdentifierStepCount',
  HRV: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  RESTING_HR: 'HKQuantityTypeIdentifierRestingHeartRate',
  HEART_RATE: 'HKQuantityTypeIdentifierHeartRate',
  ACTIVE_ENERGY: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  EXERCISE_TIME: 'HKQuantityTypeIdentifierAppleExerciseTime',
  WEIGHT: 'HKQuantityTypeIdentifierBodyMass',
  BODYFAT: 'HKQuantityTypeIdentifierBodyFatPercentage',
  HEIGHT: 'HKQuantityTypeIdentifierHeight',
  BP_SYS: 'HKQuantityTypeIdentifierBloodPressureSystolic',
  BP_DIA: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
  GLUCOSE: 'HKQuantityTypeIdentifierBloodGlucose',
  WATER: 'HKQuantityTypeIdentifierDietaryWater',
  CAFFEINE: 'HKQuantityTypeIdentifierDietaryCaffeine',
  MINDFUL: 'HKCategoryTypeIdentifierMindfulSession',
  SLEEP: 'HKCategoryTypeIdentifierSleepAnalysis',
} as const;

export interface AppleImportProgress {
  phase: 'parsing' | 'aggregating' | 'merging' | 'done' | 'error';
  recordsRead: number;
  daysProduced: number;
  message?: string;
}

interface RawRecord {
  type: string;
  startDate: string;
  endDate: string;
  value: string;
  unit?: string;
}

const SLEEP_CORE = new Set([
  'HKCategoryValueSleepAnalysisAsleep',
  'HKCategoryValueSleepAnalysisAsleepCore',
  'HKCategoryValueSleepAnalysisAsleepUnspecified',
]);
const SLEEP_DEEP = new Set(['HKCategoryValueSleepAnalysisAsleepDeep']);
const SLEEP_REM  = new Set(['HKCategoryValueSleepAnalysisAsleepREM']);

/**
 * Apple Health export.xml を非同期パース。
 * 大量のXMLでもメインスレッドを止めないよう、バッチ処理＋yield。
 */
export async function importAppleHealthXml(
  text: string,
  onProgress?: (p: AppleImportProgress) => void
): Promise<DailyHealth[]> {
  onProgress?.({ phase: 'parsing', recordsRead: 0, daysProduced: 0 });

  // 1. ストリーム的に <Record .../> を抽出（巨大XMLのため正規表現で進める）
  const recordRegex = /<Record\s+([^/>]+?)\/>/g;
  const records: RawRecord[] = [];
  let m: RegExpExecArray | null;
  let count = 0;

  while ((m = recordRegex.exec(text))) {
    const attrs = parseAttrs(m[1]);
    const type = attrs.type;
    if (!type || !attrs.startDate) continue;
    records.push({
      type,
      startDate: attrs.startDate,
      endDate: attrs.endDate ?? attrs.startDate,
      value: attrs.value ?? '',
      unit: attrs.unit,
    });
    count++;
    if (count % 5000 === 0) {
      onProgress?.({ phase: 'parsing', recordsRead: count, daysProduced: 0 });
      await yieldFrame();
    }
  }

  onProgress?.({ phase: 'aggregating', recordsRead: count, daysProduced: 0 });
  await yieldFrame();

  // 2. 日次バケット化
  const buckets = new Map<string, BucketAcc>();
  const bucketFor = (date: string) => {
    let b = buckets.get(date);
    if (!b) {
      b = newBucket();
      buckets.set(date, b);
    }
    return b;
  };

  for (const r of records) {
    const dayKey = r.startDate.slice(0, 10);
    const b = bucketFor(dayKey);
    const v = Number(r.value);

    switch (r.type) {
      case APPLE_TYPE.STEPS:
        b.steps += isFinite(v) ? v : 0;
        break;
      case APPLE_TYPE.HRV:
        b.hrvSamples.push(v);
        break;
      case APPLE_TYPE.RESTING_HR:
        b.rhrSamples.push(v);
        break;
      case APPLE_TYPE.HEART_RATE:
        // 安静時取得が無いとき用に最低値を集計
        if (isFinite(v) && (b.hrMin === null || v < b.hrMin)) b.hrMin = v;
        break;
      case APPLE_TYPE.ACTIVE_ENERGY:
        b.activeKcal += isFinite(v) ? v : 0;
        break;
      case APPLE_TYPE.EXERCISE_TIME:
        b.exerciseMin += isFinite(v) ? v : 0;
        break;
      case APPLE_TYPE.WEIGHT:
        b.weightKg = isFinite(v) ? v : b.weightKg;
        break;
      case APPLE_TYPE.BODYFAT:
        b.bodyFatPct = isFinite(v) ? v * 100 : b.bodyFatPct; // 0–1 fraction → %
        break;
      case APPLE_TYPE.BP_SYS:
        b.bpSys = isFinite(v) ? v : b.bpSys;
        break;
      case APPLE_TYPE.BP_DIA:
        b.bpDia = isFinite(v) ? v : b.bpDia;
        break;
      case APPLE_TYPE.GLUCOSE:
        b.glucose = isFinite(v) ? v : b.glucose;
        break;
      case APPLE_TYPE.WATER:
        b.waterL += isFinite(v) ? v / 1000 : 0; // mL → L
        break;
      case APPLE_TYPE.CAFFEINE:
        b.caffeineMg += isFinite(v) ? v : 0;
        break;
      case APPLE_TYPE.MINDFUL: {
        const start = new Date(r.startDate).getTime();
        const end = new Date(r.endDate).getTime();
        b.mindfulMin += Math.max(0, (end - start) / 60000);
        break;
      }
      case APPLE_TYPE.SLEEP: {
        const start = new Date(r.startDate).getTime();
        const end = new Date(r.endDate).getTime();
        const minutes = Math.max(0, (end - start) / 60000);
        if (SLEEP_DEEP.has(r.value)) b.sleepDeepMin += minutes;
        else if (SLEEP_REM.has(r.value)) b.sleepRemMin += minutes;
        else if (SLEEP_CORE.has(r.value) || r.value === 'HKCategoryValueSleepAnalysisAsleepUnspecified') {
          b.sleepCoreMin += minutes;
        }
        break;
      }
    }
  }

  onProgress?.({ phase: 'merging', recordsRead: count, daysProduced: buckets.size });
  await yieldFrame();

  // 3. DailyHealth 整形
  const today = new Date();
  const days: DailyHealth[] = [];
  const sortedKeys = [...buckets.keys()].sort();
  for (const date of sortedKeys) {
    const b = buckets.get(date)!;
    const sleepHours =
      (b.sleepCoreMin + b.sleepDeepMin + b.sleepRemMin) / 60;
    const hrv = mean(b.hrvSamples);
    const restingHR =
      b.rhrSamples.length > 0
        ? mean(b.rhrSamples)
        : b.hrMin ?? 60;
    const sleepScore = scoreSleep(sleepHours, b.sleepDeepMin);
    const recoveryScore = scoreRecovery(hrv, restingHR, sleepScore);
    days.push({
      date,
      sleepHours: round(sleepHours, 1),
      deepSleepMin: Math.round(b.sleepDeepMin),
      remSleepMin: Math.round(b.sleepRemMin),
      sleepScore,
      hrv: Math.round(hrv || 50),
      restingHR: Math.round(restingHR),
      recoveryScore,
      steps: Math.round(b.steps),
      activeMinutes: Math.round(b.exerciseMin),
      exerciseKcal: Math.round(b.activeKcal),
      stressLevel: estimateStress(hrv, restingHR),
      mindfulMinutes: Math.round(b.mindfulMin),
      hydrationL: round(b.waterL, 2),
      caffeineMg: Math.round(b.caffeineMg),
      alcoholDrinks: 0, // Appleはアルコール記録ないため0
      weightKg: b.weightKg ? round(b.weightKg, 1) : undefined,
      bodyFatPct: b.bodyFatPct ? round(b.bodyFatPct, 1) : undefined,
      bp: b.bpSys && b.bpDia ? { sys: Math.round(b.bpSys), dia: Math.round(b.bpDia) } : undefined,
      glucoseMgDl: b.glucose ? Math.round(b.glucose) : undefined,
    });
  }

  // 直近30日分に絞る
  const lookback = new Date(today);
  lookback.setDate(today.getDate() - 90);
  const filtered = days.filter((d) => new Date(d.date) >= lookback);

  onProgress?.({ phase: 'done', recordsRead: count, daysProduced: filtered.length });
  return filtered;
}

// ── helpers ──────────────────────────────────────────────────
interface BucketAcc {
  steps: number;
  hrvSamples: number[];
  rhrSamples: number[];
  hrMin: number | null;
  activeKcal: number;
  exerciseMin: number;
  weightKg: number | null;
  bodyFatPct: number | null;
  bpSys: number | null;
  bpDia: number | null;
  glucose: number | null;
  waterL: number;
  caffeineMg: number;
  mindfulMin: number;
  sleepCoreMin: number;
  sleepDeepMin: number;
  sleepRemMin: number;
}

function newBucket(): BucketAcc {
  return {
    steps: 0,
    hrvSamples: [],
    rhrSamples: [],
    hrMin: null,
    activeKcal: 0,
    exerciseMin: 0,
    weightKg: null,
    bodyFatPct: null,
    bpSys: null,
    bpDia: null,
    glucose: null,
    waterL: 0,
    caffeineMg: 0,
    mindfulMin: 0,
    sleepCoreMin: 0,
    sleepDeepMin: 0,
    sleepRemMin: 0,
  };
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out[m[1]] = m[2];
  }
  return out;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round(v: number, p = 1) {
  const f = Math.pow(10, p);
  return Math.round(v * f) / f;
}

function scoreSleep(hours: number, deepMin: number): number {
  if (hours <= 0) return 0;
  // 7-9h で満点、それ未満/超過はペナルティ。深睡眠も加点。
  let s = 100 - Math.abs(hours - 8) * 12;
  if (deepMin > 30) s += Math.min(15, (deepMin - 30) * 0.3);
  return Math.max(0, Math.min(100, Math.round(s)));
}

function scoreRecovery(hrv: number, rhr: number, sleepScore: number): number {
  const hrvScore = Math.min(100, hrv * 1.4); // 70ms→98
  const rhrScore = Math.max(0, 100 - Math.max(0, rhr - 50) * 2);
  return Math.round(hrvScore * 0.5 + rhrScore * 0.25 + sleepScore * 0.25);
}

function estimateStress(hrv: number, rhr: number): number {
  // 簡易プロキシ: HRV が低く RHR が高いほどストレス高
  const hrvPart = Math.max(0, 100 - hrv * 1.4);
  const rhrPart = Math.max(0, (rhr - 55) * 4);
  return Math.max(0, Math.min(100, Math.round(hrvPart * 0.6 + rhrPart * 0.4)));
}

async function yieldFrame() {
  return new Promise<void>((res) => setTimeout(res, 0));
}
