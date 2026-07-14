import type { DailyHealth } from '../types/health';

export type AnomalySeverity = 'info' | 'caution' | 'alert';

export interface HealthAnomaly {
  id: string;
  metric: keyof DailyHealth | 'composite';
  severity: AnomalySeverity;
  title: string;
  detail: string;
  /** 推奨される質問 (Coach に渡せる) */
  suggestedQuestion?: string;
  /** 関連するメトリクスの数値情報 */
  context: { current: number; baseline: number; deltaPct?: number };
  detectedAt: string;
}

interface Stats {
  mean: number;
  std: number;
}

function statsOf(values: number[]): Stats {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const v = values.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return { mean, std: Math.sqrt(v) };
}

/** 3日間の異常検知。新しい順に重要度の高い anomaly を返す（最大 5 件） */
export function detectAnomalies(days: DailyHealth[]): HealthAnomaly[] {
  if (days.length < 4) return [];
  const today = days[days.length - 1];
  const baseline = days.slice(-15, -1); // 直近 14日（今日除く）
  const results: HealthAnomaly[] = [];

  // ── HRV 急落 ──
  const hrv = statsOf(baseline.map((d) => d.hrv));
  const hrvDelta = today.hrv - hrv.mean;
  const hrvDeltaPct = (hrvDelta / hrv.mean) * 100;
  // 平常比 -10% で留意、-20%で注意、std基準は補助的に併用
  if (hrvDeltaPct <= -10 || (hrv.std > 1 && hrvDelta < -hrv.std)) {
    const sev: AnomalySeverity =
      hrvDeltaPct <= -20 || hrvDelta < -hrv.std * 1.8 ? 'alert' : 'caution';
    results.push({
      id: 'hrv-drop',
      metric: 'hrv',
      severity: sev,
      title: `HRVが平常より${Math.abs(Math.round(hrvDeltaPct))}%低下`,
      detail: `直近14日平均 ${Math.round(hrv.mean)}ms に対し、本日 ${today.hrv}ms。副交感神経の回復が落ちています。`,
      suggestedQuestion: '今日HRVが落ちています。今夜のリカバリー戦略を提案して',
      context: { current: today.hrv, baseline: Math.round(hrv.mean), deltaPct: Math.round(hrvDeltaPct) },
      detectedAt: today.date,
    });
  }

  // ── 睡眠負債 ──
  const sleepWeek = days.slice(-7);
  const avgSleep = sleepWeek.reduce((s, d) => s + d.sleepHours, 0) / sleepWeek.length;
  if (avgSleep < 7.0) {
    results.push({
      id: 'sleep-debt',
      metric: 'sleepHours',
      severity: avgSleep < 6 ? 'alert' : 'caution',
      title: `7日平均睡眠 ${avgSleep.toFixed(1)}h — 睡眠負債が蓄積`,
      detail: `7日連続で7h未満。判断のエラー率上昇・免疫低下リスクがあります。`,
      suggestedQuestion: `睡眠が${avgSleep.toFixed(1)}h続いています。今週中に取り戻すための具体プランを`,
      context: { current: avgSleep, baseline: 7.5 },
      detectedAt: today.date,
    });
  }

  // ── 安静時心拍上昇 ──
  const rhr = statsOf(baseline.map((d) => d.restingHR));
  if (rhr.std > 1 && today.restingHR - rhr.mean > rhr.std * 1.5) {
    results.push({
      id: 'rhr-up',
      metric: 'restingHR',
      severity: 'caution',
      title: `安静時心拍 ${today.restingHR}bpm — 平常より上昇`,
      detail: `平均 ${Math.round(rhr.mean)}bpm。発熱・脱水・過労・ストレスのいずれかの兆候の可能性。`,
      suggestedQuestion: '安静時心拍が上がっています。原因として何が考えられる？',
      context: { current: today.restingHR, baseline: Math.round(rhr.mean) },
      detectedAt: today.date,
    });
  }

  // ── ストレス連続 ──
  const highStressStreak = countTrailing(days, (d) => d.stressLevel >= 60);
  if (highStressStreak >= 2) {
    results.push({
      id: 'stress-streak',
      metric: 'stressLevel',
      severity: highStressStreak >= 5 ? 'alert' : 'caution',
      title: `高ストレス ${highStressStreak} 日連続`,
      detail: `自律神経への持続的負荷。胃腸・睡眠・集中に影響が出やすい時期です。`,
      suggestedQuestion: 'ストレスが高い日が続いています。仕事を止めずに緩和できる行動は？',
      context: { current: highStressStreak, baseline: 0 },
      detectedAt: today.date,
    });
  }

  // ── アルコール過多 ──
  const alc7 = sleepWeek.reduce((s, d) => s + d.alcoholDrinks, 0);
  if (alc7 >= 7) {
    results.push({
      id: 'alc-high',
      metric: 'alcoholDrinks',
      severity: 'caution',
      title: `週間アルコール ${alc7} 杯 — ガイドライン上限超過`,
      detail: `WHO推奨上限の概ね2倍。HRV低下・肝負荷・睡眠の質低下に直結します。`,
      suggestedQuestion: '飲酒を減らさずに健康へのダメージを最小化する方法は？',
      context: { current: alc7, baseline: 7 },
      detectedAt: today.date,
    });
  }

  // ── 運動不足 ──
  const lowStepsDays = sleepWeek.filter((d) => d.steps < 5000).length;
  if (lowStepsDays >= 3) {
    results.push({
      id: 'low-steps',
      metric: 'steps',
      severity: 'info',
      title: `7日中 ${lowStepsDays}日が5,000歩未満`,
      detail: `運動不足は明日のメンタル・集中・睡眠の質を全て下げます。`,
      suggestedQuestion: '今週は歩数が少ないです。短時間で効くムーブメントを提案して',
      context: { current: lowStepsDays, baseline: 0 },
      detectedAt: today.date,
    });
  }

  // ── 連続好調（ポジティブ通知） ──
  const recoveryGood = countTrailing(days, (d) => d.recoveryScore >= 75);
  if (recoveryGood >= 5) {
    results.push({
      id: 'good-recovery',
      metric: 'recoveryScore',
      severity: 'info',
      title: `Recovery 75+ が ${recoveryGood} 日連続 — 攻めるタイミング`,
      detail: `身体の負荷耐性が高い時期。重い意思決定や新しいトレーニングを入れる好機。`,
      suggestedQuestion: 'リカバリーが良いので、攻めの活動を1つ提案して',
      context: { current: recoveryGood, baseline: 0 },
      detectedAt: today.date,
    });
  }

  // 重要度順ソート: alert > caution > info、同重要度内は新しい順
  const severityRank: Record<AnomalySeverity, number> = { alert: 3, caution: 2, info: 1 };
  results.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
  return results.slice(0, 5);
}

function countTrailing(days: DailyHealth[], pred: (d: DailyHealth) => boolean) {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (pred(days[i])) n++;
    else break;
  }
  return n;
}
