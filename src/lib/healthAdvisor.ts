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
  hrv: number;
  deepSleepMin: number;
  remSleepMin: number;
  stress: number;
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
    hrv: Math.round(sum('hrv') / n),
    deepSleepMin: Math.round(sum('deepSleepMin') / n),
    remSleepMin: Math.round(sum('remSleepMin') / n),
    stress: Math.round(sum('stressLevel') / n),
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
データには「今日」「7日平均」「30日平均」「トレンド (improving / worsening / stable)」が含まれ、HRV (自律神経指標)・深睡眠分・レム睡眠分・ストレス推定 も含む。
深睡眠 60 分未満 / レム 70 分未満 / HRV 40ms 未満 / ストレス 60 超 のときは必ず該当分野でケアを提示すること。
トレンドを必ず読み取り、悪化なら原因仮説と立て直しを、改善なら維持/加速の戦略を返すこと。
tonightAction / dinnerTiming / tomorrowWorkout は今日のデータから導く具体的な「時刻 + 行動」を含めること (例: 「23:30 までに入浴」「20:00 までに夕食、タンパク質 25g」)。
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
    ? `今日: 安静時心拍 ${today.restingHR ?? '—'}bpm / HRV ${today.hrv ?? '—'}ms / 歩数 ${today.steps ?? '—'}歩 / 睡眠 ${today.sleepHours?.toFixed(1) ?? '—'}h (深 ${today.deepSleepMin ?? '—'}分 / レム ${today.remSleepMin ?? '—'}分) / アクティブ ${today.activeMinutes ?? '—'}分 / リカバリー ${today.recoveryScore ?? '—'} / ストレス推定 ${today.stressLevel ?? '—'}`
    : '今日のデータなし';
  const w = week7
    ? `7日平均: 心拍 ${week7.hr}bpm / HRV ${week7.hrv}ms / 歩数 ${week7.steps}歩 / 睡眠 ${week7.sleep}h (深 ${week7.deepSleepMin}分 / レム ${week7.remSleepMin}分) / 運動 ${week7.activeMin}分 / ストレス ${week7.stress}`
    : '7日平均データなし';
  const m = month30
    ? `30日平均: 心拍 ${month30.hr}bpm / HRV ${month30.hrv}ms / 歩数 ${month30.steps}歩 / 睡眠 ${month30.sleep}h (深 ${month30.deepSleepMin}分 / レム ${month30.remSleepMin}分) / 運動 ${month30.activeMin}分 / ストレス ${month30.stress}`
    : '30日平均データなし';
  const tr = `直近トレンド (7日 vs 30日): ${trend === 'improving' ? '改善傾向' : trend === 'worsening' ? '悪化傾向' : '安定'}`;
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `AI 応答エラー (${res.status})`);
  }
  const data = await res.json();
  // Anthropic 互換: { content: [{ type:'text', text:'...' }] }
  const text: string =
    (Array.isArray(data?.content) ? data.content?.[0]?.text : '') ||
    data?.text ||
    (typeof data?.content === 'string' ? data.content : '') ||
    data?.message ||
    '';
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
