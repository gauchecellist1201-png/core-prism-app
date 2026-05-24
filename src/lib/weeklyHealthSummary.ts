// ============================================================
// weeklyHealthSummary — 直近7日 PHR を Claude に投げて
// 3 文のトレンド + 注意指標 + 今日 1 つだけのおすすめアクション を生成
// 1 日 1 回キャッシュ (localStorage)。健康データは telemetry に送らない。
// ============================================================
import type { DailyHealth } from '../types/health';

export interface WeeklyHealthSummary {
  /** 体調トレンド (3 文以内) */
  trend: string;
  /** 注意すべき指標 1-2 件 */
  watch: string[];
  /** 今日の 1 つだけのおすすめアクション */
  todayAction: string;
  /** 生成日時 ISO */
  generatedAt: string;
  /** キャッシュ判定キー (YYYY-MM-DD + 日数) */
  cacheKey: string;
}

const CACHE_KEY = 'core_health_weekly_summary_v1';

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildCacheKey(days: DailyHealth[]): string {
  // 「今日 + 直近7日中の日数」で1日1回までキャッシュ
  return `${todayStr()}::${days.slice(-7).length}`;
}

export function loadCachedSummary(): WeeklyHealthSummary | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as WeeklyHealthSummary;
    return j;
  } catch {
    return null;
  }
}

export function saveCachedSummary(s: WeeklyHealthSummary) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

export function isCacheFresh(s: WeeklyHealthSummary | null, days: DailyHealth[]): boolean {
  if (!s) return false;
  return s.cacheKey === buildCacheKey(days);
}

/** 直近7日の数値統計を文字列化 (個人特定要素は含めない) */
function summarize(days: DailyHealth[]): string {
  const week = days.slice(-7);
  if (week.length === 0) return 'データなし';
  const n = week.length;
  const avg = (k: keyof DailyHealth) =>
    week.reduce((s, d) => s + (Number(d[k]) || 0), 0) / n;
  const sleep = avg('sleepHours').toFixed(1);
  const hrv = Math.round(avg('hrv'));
  const rhr = Math.round(avg('restingHR'));
  const steps = Math.round(avg('steps'));
  const stress = Math.round(avg('stressLevel'));
  const deep = Math.round(avg('deepSleepMin'));
  const rem = Math.round(avg('remSleepMin'));
  const active = Math.round(avg('activeMinutes'));
  const recovery = Math.round(avg('recoveryScore'));
  const hydra = avg('hydrationL').toFixed(1);
  const alc7 = week.reduce((s, d) => s + (d.alcoholDrinks || 0), 0);
  const today = days[days.length - 1];
  const t = today
    ? `今日: 睡眠 ${today.sleepHours?.toFixed(1) ?? '—'}h / HRV ${today.hrv ?? '—'}ms / 安静時心拍 ${today.restingHR ?? '—'} / 歩数 ${today.steps ?? '—'} / ストレス ${today.stressLevel ?? '—'} / リカバリー ${today.recoveryScore ?? '—'}`
    : '今日のデータなし';
  return `直近 ${n} 日平均:
- 睡眠: ${sleep}h (深 ${deep}分 / レム ${rem}分)
- HRV: ${hrv}ms / 安静時心拍: ${rhr}bpm / リカバリー: ${recovery}
- 歩数: ${steps} / アクティブ: ${active}分
- ストレス: ${stress} / 水分: ${hydra}L / 週間アルコール: ${alc7}杯
${t}`;
}

const SYSTEM_PROMPT = `あなたは健康データの読み解きが得意なアドバイザーです。
ユーザーの直近 7 日の PHR データから、JSON のみ返してください (説明文/コードフェンス禁止)。
- trend: 体調トレンドを 3 文以内 (合計 80-140 字) でやさしい日本語で。
- watch: 注意すべき指標を 1-2 件、各 30-50 字。なければ空配列。
- todayAction: 今日の "1 つだけ" のおすすめ行動 (40-60 字、具体的に "20:00 までに夕食" など時刻・量を含める)。

返却:
{
  "trend": "string",
  "watch": ["string", ...],
  "todayAction": "string"
}`;

export interface GenerateWeeklySummaryArgs {
  days: DailyHealth[];
  endpoint?: string;
  signal?: AbortSignal;
}

export async function generateWeeklySummary({
  days,
  endpoint = '/api/ai',
  signal,
}: GenerateWeeklySummaryArgs): Promise<WeeklyHealthSummary> {
  if (days.length === 0) throw new Error('健康データがありません');
  const body = summarize(days);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: body }],
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `AI 応答エラー (${res.status})`);
  }
  const data = await res.json();
  const text: string =
    (Array.isArray(data?.content) ? data.content?.[0]?.text : '') ||
    data?.text ||
    '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI 応答に JSON が含まれていません');
  const j = JSON.parse(m[0]);
  const out: WeeklyHealthSummary = {
    trend: String(j.trend || '').slice(0, 220),
    watch: Array.isArray(j.watch)
      ? j.watch.slice(0, 2).map((x: any) => String(x).slice(0, 100))
      : [],
    todayAction: String(j.todayAction || '').slice(0, 120),
    generatedAt: new Date().toISOString(),
    cacheKey: buildCacheKey(days),
  };
  saveCachedSummary(out);
  return out;
}
