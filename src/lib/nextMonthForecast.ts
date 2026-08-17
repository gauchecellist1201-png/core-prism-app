// ============================================================
// nextMonthForecast — 「来月の見込み」を、来月の話だけで作る
//
// なぜ必要だったか (2026-08-17 実測):
//   ホーム最上段の「来月の見込み」は
//     直近3ヶ月平均 + 進行中案件すべての確度加重
//   という式で、案件の「クローズ予定日」を一切見ていなかった。
//   デモの田中さん (8件) で測ると、進行中6件の確度加重 ¥1,643,000 のうち
//   ¥1,347,000 (82%) が **すでにクローズ予定日を過ぎた案件** で、
//   さらに1件は今月中に決まる案件だった。つまり
//     ・来月の数字ではないものが、来月の見込みに入っていた
//     ・今月決まる案件は「今月稼いだ」と二重に数えられる
//   結果、今月 ¥582,833・先月比 -45.7% と表示している同じ行で
//   来月 ¥2,557,414 (4.4倍) と出ていた。
//
// 方針 (honest-numbers):
//   ・来月の見込みに入れてよいのは「クローズ予定日が来月の中にある案件」だけ。
//   ・外した案件は黙って消さず、必ず理由ごとに件数と金額を返す。
//     (黙って落とすと「全部見た上での数字」に見えてしまう)
//   ・期限を過ぎた案件は 0 円として扱うのではなく「止まっている案件」として
//     呼び出し側に渡す。ここが実際には今日いちばん効く一手になる。
//   ・推定はしない。式は「直近3ヶ月の平均 + 来月クローズ予定の確度加重」だけ。
//
// 計算だけ。DOM も localStorage も触らない。
// ============================================================
import type { CRMDeal } from '../types/crm';

/** 見込みから外した理由 */
export type ExcludeReason =
  /** クローズ予定日をすでに過ぎている (止まっている案件) */
  | 'overdue'
  /** 今月中にクローズ予定 — 来月ではないので入れない (「今月稼いだ」と二重計上になる) */
  | 'thisMonth'
  /** 再来月以降にクローズ予定 */
  | 'later'
  /** クローズ予定日が入っていない — 来月に入ると言い切れない */
  | 'undated';

export interface ExcludedGroup {
  reason: ExcludeReason;
  count: number;
  /** 確度加重の合計 (円)。「いくらぶん外したか」を正直に出すため */
  weightedJpy: number;
}

export interface NextMonthForecast {
  /**
   * 来月の見込み (円)。base + 来月クローズ予定の確度加重。
   * 出せる数字が無い時は null (UI は「—」を出す)。
   */
  totalJpy: number | null;
  /** 直近3ヶ月の平均売上 (円) */
  baseJpy: number;
  /** 来月クローズ予定の案件だけの確度加重 (円) */
  pipelineJpy: number;
  /** 見込みに入れた案件数 */
  includedCount: number;
  /** 見込みから外した案件 (理由ごと・件数0のものは含まない) */
  excluded: ExcludedGroup[];
  /**
   * クローズ予定日を過ぎたまま動いていない案件。
   * 見込みには入れないが、これ自体が「今日の一手」になるので分けて返す。
   */
  overdue: { count: number; weightedJpy: number };
}

/** その月の 1 日 0:00 (ローカル) */
function startOfMonth(y: number, m: number): number {
  return new Date(y, m, 1, 0, 0, 0, 0).getTime();
}

/** ローカル日付の 0:00。予定日は「その日いっぱい」有効として扱う */
function startOfLocalDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 'YYYY-MM-DD' をローカル日付の 0:00 として解釈する。
 * Date.parse('2026-09-30') は UTC 0:00 になり、日本時間では 9/30 9:00 = 前日扱いに
 * ずれる日が出る。境界の1日で「来月に入る/入らない」が変わるのでローカルで組む。
 */
function parseLocalDate(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (m) {
    const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime();
    return Number.isFinite(t) ? t : null;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? startOfLocalDay(t) : null;
}

/** 案件1件の確度加重 (円)。金額・確度が無ければ 0 */
export function weightedAmount(d: Pick<CRMDeal, 'amount' | 'probability'>): number {
  const amount = Number(d?.amount) || 0;
  const prob = Number(d?.probability) || 0;
  if (amount <= 0 || prob <= 0) return 0;
  return amount * (prob / 100);
}

/** 進行中 (受注でも失注でもない) 案件か */
export function isOpenDeal(d: Pick<CRMDeal, 'stage'>): boolean {
  return d?.stage !== 'won' && d?.stage !== 'lost';
}

export interface ForecastInput {
  /** 直近3ヶ月の平均売上 (円)。Stripe 未連携などで出せない時は 0 */
  baseJpy: number;
  /** 対象ペルソナの案件 (進行中以外が混ざっていてもここで除く) */
  deals: CRMDeal[];
  now?: number;
}

/**
 * 来月の見込みを組み立てる。
 * 入れるのは「クローズ予定日が来月の中にある進行中案件」だけ。
 * それ以外は理由つきで excluded に回す (黙って捨てない)。
 */
export function computeNextMonthForecast({
  baseJpy,
  deals,
  now = Date.now(),
}: ForecastInput): NextMonthForecast {
  const base = Number.isFinite(baseJpy) && baseJpy > 0 ? baseJpy : 0;
  const ref = new Date(now);
  const today0 = startOfLocalDay(now);

  const thisMonthStart = startOfMonth(ref.getFullYear(), ref.getMonth());
  const nextMonthStart = startOfMonth(ref.getFullYear(), ref.getMonth() + 1);
  const monthAfterNextStart = startOfMonth(ref.getFullYear(), ref.getMonth() + 2);

  let pipelineJpy = 0;
  let includedCount = 0;
  const buckets: Record<ExcludeReason, { count: number; weightedJpy: number }> = {
    overdue: { count: 0, weightedJpy: 0 },
    thisMonth: { count: 0, weightedJpy: 0 },
    later: { count: 0, weightedJpy: 0 },
    undated: { count: 0, weightedJpy: 0 },
  };

  for (const d of Array.isArray(deals) ? deals : []) {
    if (!d || !isOpenDeal(d)) continue;
    const w = weightedAmount(d);
    const close = parseLocalDate(d.expectedCloseDate);

    if (close === null) {
      buckets.undated.count++;
      buckets.undated.weightedJpy += w;
      continue;
    }
    // 予定日は「その日いっぱい」有効。今日が予定日の案件はまだ遅れていない。
    if (close < today0) {
      buckets.overdue.count++;
      buckets.overdue.weightedJpy += w;
      continue;
    }
    if (close < nextMonthStart && close >= thisMonthStart) {
      buckets.thisMonth.count++;
      buckets.thisMonth.weightedJpy += w;
      continue;
    }
    if (close >= monthAfterNextStart) {
      buckets.later.count++;
      buckets.later.weightedJpy += w;
      continue;
    }
    // ここに来るのは「来月の中にクローズ予定」だけ
    pipelineJpy += w;
    includedCount++;
  }

  const total = base + pipelineJpy;
  // 過去売上が 0 で来月ぶんの案件も極小 → 「¥600」のような誤解を招く数字は出さない
  const totalJpy = base === 0 && total < 10000 ? null : total > 0 ? total : null;

  const order: ExcludeReason[] = ['overdue', 'thisMonth', 'later', 'undated'];
  const excluded: ExcludedGroup[] = order
    .filter((r) => buckets[r].count > 0)
    .map((r) => ({ reason: r, count: buckets[r].count, weightedJpy: buckets[r].weightedJpy }));

  return {
    totalJpy,
    baseJpy: base,
    pipelineJpy,
    includedCount,
    excluded,
    overdue: { count: buckets.overdue.count, weightedJpy: buckets.overdue.weightedJpy },
  };
}

export const EXCLUDE_LABEL: Record<ExcludeReason, string> = {
  overdue: '予定日ぎれ',
  thisMonth: '今月中に決まる',
  later: '再来月より先',
  undated: '予定日が未入力',
};

/**
 * 数字が「何でできているか」を1行で言う。UI はこれをそのまま出す。
 * 誇張も省略もしない — 入れた件数と、外した件数の理由まで書く。
 */
export function describeForecast(f: NextMonthForecast): string {
  if (f.totalJpy === null) return '案件を入れると、来月の数字が見えます';
  const parts: string[] = [];
  parts.push(f.baseJpy > 0 ? '直近 3 ヶ月の平均' : '来月クローズ予定の案件のみ');
  if (f.includedCount > 0) {
    parts.push(`来月クローズ予定 ${f.includedCount} 件の確度加重`);
  }
  let line = parts.join(' + ');
  if (f.excluded.length > 0) {
    const n = f.excluded.reduce((s, g) => s + g.count, 0);
    line += `（${n} 件は来月の数字ではないので入れていません）`;
  }
  return line;
}
