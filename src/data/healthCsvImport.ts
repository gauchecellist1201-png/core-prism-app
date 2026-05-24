// ============================================================
// healthCsvImport — シンプル CSV (1 行 = 1 日) を DailyHealth[] に変換
// ヘッダ自動マッピング (日本語 / 英語 / Apple Health 書出し風 全対応)
// ============================================================
import type { DailyHealth } from '../types/health';

export interface CsvImportResult {
  days: DailyHealth[];
  /** 認識できなかったヘッダ */
  unknownColumns: string[];
  /** 1 行も日付が読めなかった場合の警告 */
  warnings: string[];
}

const HEADER_MAP: Record<string, keyof DailyHealth> = {
  // 日付
  date: 'date', '日付': 'date', day: 'date', startdate: 'date',
  // 睡眠
  sleephours: 'sleepHours', sleep: 'sleepHours', '睡眠': 'sleepHours', '睡眠時間': 'sleepHours',
  sleep_hours: 'sleepHours', sleephour: 'sleepHours',
  deepsleepmin: 'deepSleepMin', deepsleep: 'deepSleepMin', '深睡眠': 'deepSleepMin',
  remsleepmin: 'remSleepMin', remsleep: 'remSleepMin', 'レム': 'remSleepMin', rem: 'remSleepMin',
  sleepscore: 'sleepScore', '睡眠スコア': 'sleepScore',
  // 心拍 / リカバリ
  hrv: 'hrv', 'hrv_ms': 'hrv',
  restinghr: 'restingHR', 'resting_hr': 'restingHR', '安静時心拍': 'restingHR', '安静時心拍数': 'restingHR',
  recoveryscore: 'recoveryScore', recovery: 'recoveryScore', 'リカバリー': 'recoveryScore',
  // 活動
  steps: 'steps', '歩数': 'steps',
  activeminutes: 'activeMinutes', active_min: 'activeMinutes', 'アクティブ': 'activeMinutes', activetime: 'activeMinutes',
  exercisekcal: 'exerciseKcal', kcal: 'exerciseKcal',
  // メンタル
  stresslevel: 'stressLevel', stress: 'stressLevel', 'ストレス': 'stressLevel',
  mindfulminutes: 'mindfulMinutes', mindful: 'mindfulMinutes', '瞑想': 'mindfulMinutes',
  // 栄養
  hydrationl: 'hydrationL', water: 'hydrationL', '水分': 'hydrationL',
  caffeinemg: 'caffeineMg', caffeine: 'caffeineMg', 'カフェイン': 'caffeineMg',
  alcoholdrinks: 'alcoholDrinks', alcohol: 'alcoholDrinks', 'アルコール': 'alcoholDrinks',
  // 任意
  weightkg: 'weightKg', weight: 'weightKg', '体重': 'weightKg',
  bodyfatpct: 'bodyFatPct', bodyfat: 'bodyFatPct', '体脂肪': 'bodyFatPct',
  glucosemgdl: 'glucoseMgDl', glucose: 'glucoseMgDl', '血糖': 'glucoseMgDl',
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+|-/g, '').replace(/[()（）]/g, '');
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const v = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // YYYY/MM/DD
  const m1 = v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`;
  // MM/DD/YYYY (米式)
  const m2 = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`;
  // ISO datetime
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  return null;
}

/** RFC4180 風シンプル CSV パーサ (引用符内のカンマ・改行を許容) */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') {
        row.push(cell);
        cell = '';
      } else if (c === '\r') {
        // ignore
      } else if (c === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim().length > 0));
}

function defaultDay(date: string): DailyHealth {
  return {
    date,
    sleepHours: 0, deepSleepMin: 0, remSleepMin: 0, sleepScore: 0,
    hrv: 0, restingHR: 0, recoveryScore: 0,
    steps: 0, activeMinutes: 0, exerciseKcal: 0,
    stressLevel: 0, mindfulMinutes: 0,
    hydrationL: 0, caffeineMg: 0, alcoholDrinks: 0,
  };
}

export function parseHealthCsv(text: string): CsvImportResult {
  const rows = parseCsv(text);
  const result: CsvImportResult = { days: [], unknownColumns: [], warnings: [] };
  if (rows.length === 0) {
    result.warnings.push('空のファイルです');
    return result;
  }
  const headerRow = rows[0];
  const colKeys: (keyof DailyHealth | null)[] = headerRow.map(h => {
    const key = HEADER_MAP[norm(h)];
    if (!key) result.unknownColumns.push(h);
    return key ?? null;
  });
  if (!colKeys.includes('date')) {
    result.warnings.push('日付列が見つかりません (列名: date / 日付 / day)');
    return result;
  }
  const byDate = new Map<string, DailyHealth>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawDate = row[colKeys.findIndex(k => k === 'date')] || '';
    const date = parseDate(rawDate);
    if (!date) continue;
    const day = byDate.get(date) ?? defaultDay(date);
    for (let c = 0; c < colKeys.length; c++) {
      const k = colKeys[c];
      if (!k || k === 'date') continue;
      const raw = (row[c] || '').trim();
      if (!raw) continue;
      const v = Number(raw.replace(/,/g, ''));
      if (Number.isNaN(v)) continue;
      (day as any)[k] = v;
    }
    byDate.set(date, day);
  }
  result.days = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  if (result.days.length === 0) {
    result.warnings.push('読み込めた日付がありませんでした');
  }
  return result;
}
