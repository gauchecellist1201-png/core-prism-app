// ============================================================
// wellnessScore — 「健康が維持できている実感」を数値化する
//
// 思想 (オーナー指示 2026-05-17):
//   ウェルネスはサプリと同じく「一度 体感が出ると 10年 解約されない」。
//   このアプリを使い続けることで健康が "積み上がっている" 実感を作る。
//   - 毎日のウェルネススコア (0-100) を記録
//   - 開始日からの日数 = 「CORE と歩んだ日数」
//   - 連続記録ストリーク
//   - 開始時 vs 直近の改善率 = 「あなたはこれだけ良くなった」
// ============================================================
import type { DailyHealth } from '../types/health';

const HISTORY_KEY = 'core_wellness_history_v1';
const START_KEY = 'core_wellness_start_v1';

export interface WellnessEntry {
  date: string;   // YYYY-MM-DD
  score: number;  // 0-100
}

export interface WellnessSummary {
  /** 今日のウェルネススコア (0-100) */
  today: number;
  /** CORE と歩んだ日数 (開始日からの経過日) */
  daysWithCore: number;
  /** 連続記録ストリーク (日) */
  streak: number;
  /** 開始時平均 → 直近平均 の改善率 (%) — プラスなら良くなっている */
  improvementPct: number;
  /** 直近 14 日のスコア推移 (スパークライン用) */
  trend: number[];
  /** 状態ラベル */
  state: 'great' | 'good' | 'soso' | 'tired';
  /** 一言メッセージ (やさしい日本語) */
  message: string;
  /** データがまだ無い (Apple Health 未連携) */
  empty: boolean;
}

/**
 * 1 日の健康データを 0-100 のウェルネススコアに統合する。
 * 睡眠 35% / 回復 30% / 活動 20% / 心の落ち着き 15%
 */
export function computeWellnessScore(d: DailyHealth | null): number {
  if (!d) return 0;
  const sleep = clamp(d.sleepScore || sleepFromHours(d.sleepHours));
  const recovery = clamp(d.recoveryScore || 0);
  // 活動: 8000 歩を 100 点に
  const activity = clamp(Math.min(100, ((d.steps || 0) / 8000) * 100));
  // 心: ストレスの裏返し + マインドフル分
  const calm = clamp(
    (100 - (d.stressLevel || 50)) * 0.7 +
    Math.min(100, (d.mindfulMinutes || 0) * 6) * 0.3
  );
  return Math.round(sleep * 0.35 + recovery * 0.30 + activity * 0.20 + calm * 0.15);
}

function sleepFromHours(h: number): number {
  if (!h) return 0;
  // 7-8h を満点、それ未満/超過で減点
  if (h >= 7 && h <= 8.5) return 95;
  if (h >= 6 && h < 7) return 75;
  if (h > 8.5 && h <= 9.5) return 80;
  if (h >= 5 && h < 6) return 55;
  return 40;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** 今日のスコアを履歴に記録 (1 日 1 回、上書き) */
export function recordWellness(today: DailyHealth | null): void {
  if (!today) return;
  const score = computeWellnessScore(today);
  if (score <= 0) return;
  const date = today.date || new Date().toISOString().slice(0, 10);
  const hist = loadHistory();
  const idx = hist.findIndex(e => e.date === date);
  if (idx >= 0) hist[idx].score = score;
  else hist.push({ date, score });
  hist.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(-180)));
  // 開始日を初回だけ記録
  if (!localStorage.getItem(START_KEY)) {
    localStorage.setItem(START_KEY, date);
  }
}

function loadHistory(): WellnessEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as WellnessEntry[];
  } catch { return []; }
}

function getStartDate(): string | null {
  return localStorage.getItem(START_KEY);
}

/** 連続記録ストリーク (今日 or 昨日まで途切れていなければ継続) */
function computeStreak(hist: WellnessEntry[]): number {
  if (hist.length === 0) return 0;
  const days = new Set(hist.map(e => e.date));
  let streak = 0;
  const cur = new Date();
  // 今日が無ければ昨日から数える (まだ同期前の可能性)
  if (!days.has(cur.toISOString().slice(0, 10))) {
    cur.setDate(cur.getDate() - 1);
  }
  while (days.has(cur.toISOString().slice(0, 10))) {
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

/**
 * ウェルネスの全体サマリを返す。これがトラッカー UI の唯一のデータ源。
 */
export function getWellnessSummary(today: DailyHealth | null): WellnessSummary {
  // 記録を更新してから集計
  recordWellness(today);
  const hist = loadHistory();
  const todayScore = computeWellnessScore(today);

  if (hist.length === 0 && todayScore === 0) {
    return {
      today: 0, daysWithCore: 0, streak: 0, improvementPct: 0,
      trend: [], state: 'soso', empty: true,
      message: 'Apple Health とつなぐと、あなたの健康の伸びが見えます。',
    };
  }

  const start = getStartDate();
  const daysWithCore = start
    ? Math.max(1, Math.round((Date.now() - new Date(start).getTime()) / 86400000) + 1)
    : 1;
  const streak = computeStreak(hist);

  // 改善率: 最初の 7 日平均 → 直近 7 日平均
  const firstWeek = hist.slice(0, 7);
  const lastWeek = hist.slice(-7);
  const avg = (a: WellnessEntry[]) => a.length ? a.reduce((s, e) => s + e.score, 0) / a.length : 0;
  const baseAvg = avg(firstWeek);
  const recentAvg = avg(lastWeek);
  const improvementPct = baseAvg > 0
    ? Math.round(((recentAvg - baseAvg) / baseAvg) * 100)
    : 0;

  const trend = hist.slice(-14).map(e => e.score);
  const score = todayScore || (lastWeek.length ? Math.round(recentAvg) : 0);

  const state: WellnessSummary['state'] =
    score >= 80 ? 'great' : score >= 65 ? 'good' : score >= 45 ? 'soso' : 'tired';

  return {
    today: score,
    daysWithCore,
    streak,
    improvementPct,
    trend,
    state,
    empty: false,
    message: buildMessage(state, improvementPct, streak, daysWithCore),
  };
}

function buildMessage(
  state: WellnessSummary['state'],
  improvement: number,
  streak: number,
  days: number,
): string {
  if (improvement >= 10) {
    return `CORE と歩んで ${days} 日。あなたの調子は ${improvement}% 良くなっています。この積み重ねが財産です。`;
  }
  if (streak >= 7) {
    return `${streak} 日 連続で記録中。続けるほど、体の整いは確かなものになります。`;
  }
  switch (state) {
    case 'great': return '今日はとても良い状態です。この感覚を体に覚えさせましょう。';
    case 'good':  return '安定した良いリズムです。続けることが一番の力になります。';
    case 'soso':  return '少しお疲れ気味。今日は早めの休息を AI が見守ります。';
    case 'tired': return '体が休息を求めています。無理せず、整える 1 日に。';
  }
}
