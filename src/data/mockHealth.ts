import type { DailyHealth, HealthSource, HealthInsight, HealthSpectrum } from '../types/health';

function r(seed: number, min: number, max: number) {
  // deterministic-ish pseudo-random (so reload produces stable demo data)
  const v = Math.sin(seed * 13.37) * 10000;
  return min + (v - Math.floor(v)) * (max - min);
}

export function generateMockHealth(days = 30): DailyHealth[] {
  const out: DailyHealth[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const seed = i + 1;
    const weekend = [0, 6].includes(d.getDay());

    const sleepHours = +r(seed, 5.6, 8.2).toFixed(1);
    const deepSleepMin = Math.round(r(seed + 0.1, 60, 120));
    const remSleepMin = Math.round(r(seed + 0.2, 70, 130));
    const sleepScore = Math.round(40 + (sleepHours - 5.5) * 25 + r(seed + 0.3, -8, 8));
    const hrv = Math.round(r(seed + 0.4, 38, 78));
    const restingHR = Math.round(r(seed + 0.5, 52, 68));
    const recoveryScore = Math.round((hrv - 38) * 1.6 + r(seed + 0.6, -10, 14) + (sleepScore * 0.4));
    const steps = Math.round(weekend ? r(seed + 0.7, 4500, 14000) : r(seed + 0.7, 6500, 11500));
    const activeMinutes = Math.round(r(seed + 0.8, 25, 95));
    const exerciseKcal = Math.round(activeMinutes * r(seed + 0.85, 8, 12));
    const stressLevel = Math.round(r(seed + 0.9, 18, 78));
    const mindfulMinutes = Math.round(r(seed + 1.0, 0, 22));
    const hydrationL = +r(seed + 1.1, 1.4, 3.2).toFixed(1);
    const caffeineMg = Math.round(r(seed + 1.2, 50, 320));
    const alcoholDrinks = weekend ? Math.round(r(seed + 1.3, 0, 3)) : Math.round(r(seed + 1.3, 0, 1));

    out.push({
      date: d.toISOString().slice(0, 10),
      sleepHours,
      deepSleepMin,
      remSleepMin,
      sleepScore: Math.max(0, Math.min(100, sleepScore)),
      hrv,
      restingHR,
      recoveryScore: Math.max(0, Math.min(100, recoveryScore)),
      steps,
      activeMinutes,
      exerciseKcal,
      stressLevel,
      mindfulMinutes,
      hydrationL,
      caffeineMg,
      alcoholDrinks,
      weightKg: i % 2 === 0 ? +r(seed + 1.4, 67.2, 68.8).toFixed(1) : undefined,
      bodyFatPct: i % 7 === 0 ? +r(seed + 1.5, 14.5, 16.8).toFixed(1) : undefined,
      bp: i % 5 === 0 ? { sys: Math.round(r(seed + 1.6, 112, 128)), dia: Math.round(r(seed + 1.7, 70, 84)) } : undefined,
      glucoseMgDl: undefined,
    });
  }
  return out;
}

export function defaultSources(): HealthSource[] {
  return [
    { id: 'apple-health', name: 'Apple Health',  status: 'connected',    lastSync: new Date(Date.now() - 1000 * 60 * 8).toISOString(), recordsImported: 18412 },
    { id: 'oura',         name: 'Oura Ring',     status: 'connected',    lastSync: new Date(Date.now() - 1000 * 60 * 22).toISOString(), recordsImported: 2891 },
    { id: 'whoop',        name: 'Whoop',         status: 'disconnected', lastSync: null, recordsImported: 0 },
    { id: 'garmin',       name: 'Garmin Connect',status: 'disconnected', lastSync: null, recordsImported: 0 },
    { id: 'fitbit',       name: 'Fitbit',        status: 'disconnected', lastSync: null, recordsImported: 0 },
    { id: 'manual',       name: '手動入力',       status: 'connected',    lastSync: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), recordsImported: 124 },
  ];
}

export function spectrumFromDay(d: DailyHealth): HealthSpectrum {
  const sleep = Math.min(100, d.sleepScore);
  const recovery = Math.min(100, d.recoveryScore);
  const activity = Math.min(100, Math.round((d.steps / 10000) * 60 + (d.activeMinutes / 60) * 40));
  const mind = Math.min(100, Math.round(100 - d.stressLevel * 0.6 + d.mindfulMinutes * 1.5));
  const nutritionPenalty = d.alcoholDrinks * 8 + Math.max(0, d.caffeineMg - 200) * 0.05;
  const nutrition = Math.max(20, Math.min(100, Math.round(d.hydrationL * 25 + 30 - nutritionPenalty)));
  return { sleep, recovery, activity, mind, nutrition };
}

export function generateMockInsights(days: DailyHealth[]): HealthInsight[] {
  const last = days[days.length - 1];
  const prev = days[days.length - 2];
  const week = days.slice(-7);
  const avgSleep = week.reduce((s, x) => s + x.sleepHours, 0) / week.length;
  const avgHRV = Math.round(week.reduce((s, x) => s + x.hrv, 0) / week.length);
  const out: HealthInsight[] = [];

  if (avgSleep < 7) {
    out.push({
      id: 'i1',
      date: last.date,
      axis: 'sleep',
      severity: 'caution',
      title: `今週の平均睡眠 ${avgSleep.toFixed(1)}h — 経営判断の質に影響`,
      detail: '7日連続で7h未満。短期集中思考は維持できていますが、戦略的判断のエラー率が前月比+18%上昇しています。今夜は22:30就寝を推奨。',
    });
  }
  if (last.recoveryScore < 60) {
    out.push({
      id: 'i2',
      date: last.date,
      axis: 'recovery',
      severity: 'alert',
      title: `本日のリカバリー ${last.recoveryScore} — 重要会議は午前中が最適`,
      detail: `HRV ${last.hrv}ms（7日平均 ${avgHRV}ms）。負荷が高い活動は午後3時以降に再評価。深呼吸6分を午前11時前に挿入を提案。`,
    });
  }
  if (last.steps > 10000) {
    out.push({
      id: 'i3',
      date: last.date,
      axis: 'activity',
      severity: 'celebrate',
      title: `本日 ${last.steps.toLocaleString()} 歩 — 連続 ${calcStreak(days, (d) => d.steps >= 10000)} 日達成`,
      detail: '活動目標を超過。クリエイティブ系タスクの捗りが平均+22%（過去30日相関）。',
    });
  }
  if (last.alcoholDrinks > 1) {
    out.push({
      id: 'i4',
      date: last.date,
      axis: 'nutrition',
      severity: 'caution',
      title: '昨夜のアルコール記録あり — 翌日HRVに影響予想',
      detail: `${last.alcoholDrinks}杯記録。同条件の過去データではHRVが平均${Math.round(prev.hrv * 0.85)}ms（−15%）に低下する傾向。明朝の重要判断は控えめに。`,
    });
  }
  if (last.mindfulMinutes >= 10) {
    out.push({
      id: 'i5',
      date: last.date,
      axis: 'mind',
      severity: 'info',
      title: `Mindful ${last.mindfulMinutes}分達成 — 継続中の習慣`,
      detail: '副交感神経の戻りが平均+8%。創造系の人格モードでの集中持続時間が伸びています。',
    });
  }
  return out;
}

function calcStreak(days: DailyHealth[], pred: (d: DailyHealth) => boolean) {
  let s = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (pred(days[i])) s++; else break;
  }
  return s;
}
