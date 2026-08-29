// ============================================================
// CORE Iris ▸「1日以上ほったらかしの予約」を数え続ける
// ------------------------------------------------------------
// overduePrompt.ts は「いま何件か」を計算できるが、それだけでは
// 直ったかどうかが分からない (2026-08-29 の2件の改善はどちらも
// 判定が「件数が 0 に近づくか」なのに、数える仕組みが無かった)。
//
// ここは1日1行の小さな記録だけを持つ:
//   first = その日いちばん最初に見た件数 (＝手を付ける前)
//   last  = その日いちばん最後に見た件数 (＝手を付けた後)
// 「きょう 5件 → いま 2件」も「数えはじめた日 5件 → きょう 0件」も
// この2つだけで言える。増やさない。
//
// 嘘を出さないための決めごと:
//   ・記録が1日分も無ければ、比較は出さない (架空の「前」を作らない)
//   ・数えられない値 (NaN・負) は記録しない (fail closed)
//   ・端末内のみ。サーバーには送らない (予約そのものと同じ)
// ============================================================

export const OVERDUE_TREND_KEY = 'iris_overdue_trend_v1';

/** 残す日数。60日あれば「先月からどう変わったか」が言える。 */
export const OVERDUE_TREND_MAX_DAYS = 60;

export interface OverdueSnapshot {
  /** ローカル時刻の YYYY-MM-DD */
  day: string;
  /** その日、最初に見た件数 */
  first: number;
  /** その日、最後に見た件数 */
  last: number;
}

/** ローカル時刻での YYYY-MM-DD (ISO を slice すると +9h ずれるので Date で扱う) */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isCountable(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/** 記録として読める行だけを残す (壊れた localStorage を信じない) */
export function sanitizeTrend(raw: unknown): OverdueSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const rows = raw.filter((r): r is OverdueSnapshot =>
    !!r && typeof r === 'object'
    && typeof (r as any).day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((r as any).day)
    && isCountable((r as any).first) && isCountable((r as any).last)
  );
  // 同じ日が複数あれば最後の1件を採用し、日付昇順に整える
  const byDay = new Map<string, OverdueSnapshot>();
  rows.forEach(r => byDay.set(r.day, { day: r.day, first: r.first, last: r.last }));
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * きょうの件数を書き足した記録を返す (元の配列は変えない)。
 * ・その日の1回目だけが `first` になる (2回目以降は `last` だけ動く)
 * ・数えられない値は何も足さずにそのまま返す
 */
export function recordSnapshot(
  history: readonly OverdueSnapshot[] | null | undefined,
  count: number,
  now: Date = new Date(),
): OverdueSnapshot[] {
  const rows = sanitizeTrend(history as unknown);
  if (!isCountable(count)) return rows;
  const day = localDayKey(now);
  const idx = rows.findIndex(r => r.day === day);
  if (idx >= 0) rows[idx] = { ...rows[idx], last: count };
  else rows.push({ day, first: count, last: count });
  rows.sort((a, b) => a.day.localeCompare(b.day));
  return rows.slice(-OVERDUE_TREND_MAX_DAYS);
}

export interface OverdueTrend {
  /** いま何件か */
  now: number;
  /** きょう最初に見た件数 (記録が無ければ null) */
  todayFirst: number | null;
  /** 数えはじめた日 (きょうより前に記録があるときだけ) */
  since: { day: string; count: number } | null;
}

/**
 * 画面に出せる形にまとめる。**比較は実際に記録がある時しか返さない**。
 * `since` はきょうより前の最初の記録＝「数えはじめた日」だけを見る
 * (途中の日を混ぜて平均を作ったりしない)。
 */
export function summarizeTrend(
  history: readonly OverdueSnapshot[] | null | undefined,
  nowCount: number,
  now: Date = new Date(),
): OverdueTrend | null {
  if (!isCountable(nowCount)) return null;
  const rows = sanitizeTrend(history as unknown);
  const day = localDayKey(now);
  const today = rows.find(r => r.day === day) || null;
  const earlier = rows.filter(r => r.day < day);
  const firstEarlier = earlier[0] || null;
  return {
    now: nowCount,
    todayFirst: today ? today.first : null,
    since: firstEarlier ? { day: firstEarlier.day, count: firstEarlier.first } : null,
  };
}

/** M月D日 (記録の日付キーから。表示専用) */
export function formatTrendDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return `${Number(m[2])}月${Number(m[3])}日`;
}

/** 文言の正本。責めない・数えた事実だけを言う (推定や見込みを混ぜない)。 */
export function trendSentence(t: OverdueTrend | null): string {
  if (!t) return '';
  const head = t.now === 0
    ? '1日以上ほったらかしの予約は、いま0件です'
    : `1日以上ほったらかしの予約が、いま${t.now}件あります`;
  if (t.since && t.since.count !== t.now) {
    return `${head}（${formatTrendDay(t.since.day)}に数えはじめたときは${t.since.count}件）`;
  }
  if (t.todayFirst != null && t.todayFirst !== t.now) {
    return `${head}（きょう開いたときは${t.todayFirst}件）`;
  }
  return head;
}

// ── localStorage (ここだけが端末に触る。上の計算は何も触らない) ──

export function loadTrend(): OverdueSnapshot[] {
  try {
    const raw = localStorage.getItem(OVERDUE_TREND_KEY);
    if (!raw) return [];
    return sanitizeTrend(JSON.parse(raw));
  } catch { return []; }
}

/** 記録できたら true (保存できなくても画面は壊さない) */
export function saveTrend(rows: readonly OverdueSnapshot[]): boolean {
  try {
    localStorage.setItem(OVERDUE_TREND_KEY, JSON.stringify(rows));
    return true;
  } catch { return false; }
}
