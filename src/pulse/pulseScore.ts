// ============================================================
// CORE Pulse — 「きょうの調子」スコア (0-100)
//
// Oura の Readiness / Whoop の Recovery を参考にした、
// コードだけで確定する純粋関数 (LLM 不使用・数字嘘禁止)。
//
// 配点 (合計 100):
//   ねむり       0-40 … 7時間以上で満点 (時間に比例)
//   心拍のゆらぎ 0-25 … あなたのふだん (過去4週間の平均) と比べて高いほど良い
//   休んでいるときの脈 0-20 … ふだんと比べて低いほど良い
//   歩いた量     0-15 … 8,000歩で満点 (歩数に比例)
//
// ふだん (ベースライン) が作れないうち (記録3日未満) は、
// 一般的な目安の絶対値で採点する (それでも決まった式・推測なし)。
// 表示する内訳は「四捨五入した各点の合計 = 総合点」になるよう、
// 各項目を丸めてから合算する (内訳と合計がズレる嘘を作らない)。
// ============================================================
import type { DailyHealth } from '../types/health';

export interface PulseScoreParts {
  sleep: number;   // 0-40
  hrv: number;     // 0-25
  resting: number; // 0-20
  steps: number;   // 0-15
}

export interface PulseScoreResult {
  total: number; // 0-100 (= 内訳の合計)
  parts: PulseScoreParts;
  label: string;
  hasData: boolean; // 4項目のどれかにデータがあるか
}

export const SCORE_MAX = { sleep: 40, hrv: 25, resting: 20, steps: 15 } as const;
/** この歩数で「歩いた量」が満点になる */
export const STEPS_FULL = 8000;
/** この睡眠時間で「ねむり」が満点になる */
export const SLEEP_HOURS_FULL = 7;
/** 7日間トレンドで点線を引く「よい」の目安 */
export const SCORE_GOOD_LINE = 70;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** ふだんの値 = 直近28日 (当日を含まない) の平均。有効な記録が3日未満なら null */
export function baselineOf(prior: DailyHealth[], pick: (d: DailyHealth) => number): number | null {
  const vals = prior
    .slice(-28)
    .map(pick)
    .filter((v) => typeof v === 'number' && isFinite(v) && v > 0);
  if (vals.length < 3) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/** 総合点 → やさしいことば */
export function scoreLabel(total: number): string {
  if (total >= 85) return 'とてもよい';
  if (total >= 70) return 'よい';
  if (total >= 50) return 'ふつう';
  return 'ゆっくりの日';
}

/**
 * 1日ぶんのスコアを計算する。
 * @param day   採点する日
 * @param prior その日より前の記録 (ベースライン計算に使う。当日は含めない)
 */
export function scorePulseDay(day: DailyHealth | undefined, prior: DailyHealth[]): PulseScoreResult {
  if (!day) {
    return { total: 0, parts: { sleep: 0, hrv: 0, resting: 0, steps: 0 }, label: scoreLabel(0), hasData: false };
  }

  // ねむり: 7時間以上で満点、比例配分
  const sleepH = typeof day.sleepHours === 'number' && isFinite(day.sleepHours) ? day.sleepHours : 0;
  const sleep = Math.round(SCORE_MAX.sleep * clamp01(sleepH / SLEEP_HOURS_FULL));

  // 心拍のゆらぎ (HRV): ふだん比。ふだんの60%以下で0点・ふだん以上で満点
  let hrv = 0;
  if (day.hrv > 0) {
    const b = baselineOf(prior, (d) => d.hrv);
    hrv = b
      ? Math.round(SCORE_MAX.hrv * clamp01((day.hrv / b - 0.6) / 0.4))
      : Math.round(SCORE_MAX.hrv * clamp01((day.hrv - 20) / 40)); // 目安: 20msで0点・60msで満点
  }

  // 休んでいるときの脈: ふだん比で低いほど良い。ふだんの97%以下で満点・115%以上で0点
  let resting = 0;
  if (day.restingHR > 0) {
    const b = baselineOf(prior, (d) => d.restingHR);
    resting = b
      ? Math.round(SCORE_MAX.resting * clamp01((1.15 - day.restingHR / b) / 0.18))
      : Math.round(SCORE_MAX.resting * clamp01((75 - day.restingHR) / 20)); // 目安: 55回で満点・75回で0点
  }

  // 歩いた量: 8,000歩で満点、比例配分
  const stepsV = typeof day.steps === 'number' && isFinite(day.steps) ? day.steps : 0;
  const steps = Math.round(SCORE_MAX.steps * clamp01(stepsV / STEPS_FULL));

  const parts: PulseScoreParts = { sleep, hrv, resting, steps };
  const total = sleep + hrv + resting + steps;
  const hasData = sleepH > 0 || day.hrv > 0 || day.restingHR > 0 || stepsV > 0;
  return { total, parts, label: scoreLabel(total), hasData };
}

/** 直近n日ぶんのスコア列 (7日間トレンド用)。各日は「その日より前」だけをふだんとして使う */
export function scoreLastDays(days: DailyHealth[], n = 7): Array<{ date: string; total: number }> {
  const start = Math.max(0, days.length - n);
  const out: Array<{ date: string; total: number }> = [];
  for (let i = start; i < days.length; i++) {
    out.push({ date: days[i].date, total: scorePulseDay(days[i], days.slice(0, i)).total });
  }
  return out;
}
