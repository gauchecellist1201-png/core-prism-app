// ============================================================
// healthAdvisor — Iris / Prism 共通 AI ヘルス処方箋ジェネレータ
// ------------------------------------------------------------
// 今日 / 7日平均 / 30日平均 / 直近トレンド (改善 or 悪化)
// を AI に渡し、JSON で 4 分野アドバイス + 具体アクションを返す。
// ============================================================
import type { DailyHealth } from '../types/health';

export type AdviceTone = 'iris' | 'prism';

export interface HealthAdvice {
  score: number; // 0-100 総合健康スコア
  summary: string; // 一言サマリー
  sleep: string;
  diet: string;
  exercise: string;
  beauty: string;
  // 強化版 (今夜 / 明日 / 夕食)
  tonightAction?: string;
  tomorrowWorkout?: string;
  dinnerTiming?: string;
  // メタ
  trend?: 'improving' | 'worsening' | 'stable';
  generatedAt: string;
}

export interface HealthStatBundle {
  today: DailyHealth | null;
  week: DailyHealth[];   // 直近 7 日
  month: DailyHealth[];  // 直近 30 日
}

interface AvgStats {
  steps: number;
  hr: number;
  sleep: number;
  activeMin: number;
}

function avgOf(days: DailyHealth[]): AvgStats | null {
  if (!days.length) return null;
  const n = days.length;
  const sum = (k: keyof DailyHealth) => days.reduce((s, d) => s + (Number(d[k]) || 0), 0);
  return {
    steps: Math.round(sum('steps') / n),
    hr: Math.round(sum('restingHR') / n),
    sleep: +(sum('sleepHours') / n).toFixed(1),
    activeMin: Math.round(sum('activeMinutes') / n),
  };
}

/**
 * 直近 7 日と 30 日の差分から改善/悪化トレンドを推定。
 * 比較対象は recoveryScore + sleepHours の合成スコア。
 */
export function detectTrend(week: DailyHealth[], month: DailyHealth[]): 'improving' | 'worsening' | 'stable' {
  if (week.length < 3 || month.length < 7) return 'stable';
  const weekScore = (week.reduce((s, d) => s + (d.recoveryScore || 0) + (d.sleepHours || 0) * 10, 0)) / week.length;
  const monthScore = (month.reduce((s, d) => s + (d.recoveryScore || 0) + (d.sleepHours || 0) * 10, 0)) / month.length;
  const diff = weekScore - monthScore;
  if (diff > 5) return 'improving';
  if (diff < -5) return 'worsening';
  return 'stable';
}

function buildSystemPrompt(tone: AdviceTone): string {
  const audience = tone === 'iris'
    ? 'クリエイター女性 (20-40代想定) 向けに「美しさは内側から」の観点で'
    : 'ビジネスパーソン (20-50代想定) 向けに「最高のパフォーマンスは整った身体から」の観点で';
  return `あなたは美容/健康/睡眠/運動栄養の専門家。Apple Health データを見て、${audience}実践的アドバイスを返す。
データには「今日」「7日平均」「30日平均」「トレンド (improving / worsening / stable)」が含まれる。トレンドを必ず読み取り、悪化なら原因仮説と立て直しを、改善なら維持/加速の戦略を返すこと。
返却 JSON のみ (説明やコードフェンス不要):
{
  "score": number (0-100, 総合健康スコア),
  "summary": "string (40-70字, 一言サマリー。トレンドに触れる)",
  "sleep": "string (60-100字, 睡眠への具体アドバイス)",
  "diet": "string (60-100字, 食生活への具体アドバイス)",
  "exercise": "string (60-100字, 運動への具体アドバイス)",
  "beauty": "string (60-100字, 美容/外見への具体アドバイス)",
  "tonightAction": "string (40-70字, 今夜やる具体アクション 1 つ)",
  "tomorrowWorkout": "string (40-70字, 明日の運動メニュー提案)",
  "dinnerTiming": "string (40-70字, 夕食の時刻と内容の提案)"
}`;
}

function statsToText(today: DailyHealth | null, week7: AvgStats | null, month30: AvgStats | null, trend: string): string {
  const todayStr = today
    ? `今日: 安静時心拍 ${today.restingHR ?? '—'}bpm / 歩数 ${today.steps ?? '—'}歩 / 睡眠 ${today.sleepHours?.toFixed(1) ?? '—'}h / アクティブ ${today.activeMinutes ?? '—'}分 / HRV ${today.hrv ?? '—'}ms / リカバリー ${today.recoveryScore ?? '—'}`
    : '今日のデータなし';
  const w = week7
    ? `7日平均: 心拍 ${week7.hr}bpm / 歩数 ${week7.steps}歩 / 睡眠 ${week7.sleep}h / 運動 ${week7.activeMin}分`
    : '7日平均データなし';
  const m = month30
    ? `30日平均: 心拍 ${month30.hr}bpm / 歩数 ${month30.steps}歩 / 睡眠 ${month30.sleep}h / 運動 ${month30.activeMin}分`
    : '30日平均データなし';
  const tr = `直近トレンド: ${trend === 'improving' ? '改善傾向' : trend === 'worsening' ? '悪化傾向' : '安定'}`;
  return `${todayStr}\n${w}\n${m}\n${tr}`;
}

export interface GenerateAdviceArgs {
  stats: HealthStatBundle;
  tone: AdviceTone;
  /** AI エンドポイント。デフォルト '/api/ai' */
  endpoint?: string;
}

/**
 * AI に今日 + 7日 + 30日 + トレンドを渡し、強化版アドバイスを取得。
 * 失敗時は例外をスロー (UI 側で catch)。
 */
export async function generateHealthAdvice({ stats, tone, endpoint = '/api/ai' }: GenerateAdviceArgs): Promise<HealthAdvice> {
  const week7 = avgOf(stats.week);
  const month30 = avgOf(stats.month);
  const trend = detectTrend(stats.week, stats.month);
  const sys = buildSystemPrompt(tone);
  const body = statsToText(stats.today, week7, month30, trend);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: `${body}\n\nこのデータを分析して、JSON で 4 分野アドバイス + 今夜のアクション + 明日の運動 + 夕食提案を返してください。` }],
      system: sys,
      max_tokens: 900,
    }),
  });
  const data = await res.json();
  const text: string = data.text || data.content || data.message || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 応答に JSON が含まれていません');
  const j = JSON.parse(match[0]);
  return {
    score: Math.max(0, Math.min(100, Number(j.score) || 0)),
    summary: String(j.summary || ''),
    sleep: String(j.sleep || ''),
    diet: String(j.diet || ''),
    exercise: String(j.exercise || ''),
    beauty: String(j.beauty || ''),
    tonightAction: j.tonightAction ? String(j.tonightAction) : undefined,
    tomorrowWorkout: j.tomorrowWorkout ? String(j.tomorrowWorkout) : undefined,
    dinnerTiming: j.dinnerTiming ? String(j.dinnerTiming) : undefined,
    trend,
    generatedAt: new Date().toISOString(),
  };
}

/** UI 側で使う: 7日/30日 を days 配列から切り出す */
export function buildStatBundle(today: DailyHealth | null, days: DailyHealth[]): HealthStatBundle {
  return {
    today,
    week: days.slice(-7),
    month: days.slice(-30),
  };
}
