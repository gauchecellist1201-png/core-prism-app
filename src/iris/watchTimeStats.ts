// ============================================================
// IRIS ▸ 「最後まで見られたか」の実数（Instagram から取れた平均視聴時間）
//
// 思想（Edits の移植）:
//   リールスタジオの「バイラル予測スコア」は、いまのところ **全部が予想**。
//   クリップの長さ・字幕の文言・BGM の有無だけから 0-100 を出していて、
//   その予想が当たったかを作り手が一度も確かめられない。
//   ここは予想を **上書きしない**。実測を横に並べるだけの部品。
//
// 嘘数字禁止（honest-numbers）:
//   ・取れていない投稿は数に入れない（0 秒として混ぜない）
//   ・3 本未満なら何も返さない（1 本の平均は平均ではない）
//   ・AI 呼び出し 0・新しい保存先 0（既存の core_iris_posthistory_v1 を読むだけ）
// ============================================================

/** 平均を出すのに最低限必要な本数。これ未満なら何も出さない。 */
export const MIN_SAMPLES_FOR_AVG = 3;

/** 何本ぶんまで遡って平均するか（古すぎる実績を混ぜない）。 */
export const DEFAULT_WATCH_SAMPLE_LIMIT = 10;

export interface WatchTimeStat {
  /** 平均視聴時間（秒・小数第1位） */
  avgSec: number;
  /** 平均に使った本数 */
  count: number;
}

function toMs(v: unknown): number {
  if (typeof v !== 'string' || !v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** 実測値として使える秒数か（0 と負と非数は「無かったこと」にする） */
function usableSeconds(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

/**
 * 投稿履歴（core_iris_posthistory_v1 の中身）から、
 * 平均視聴時間が実際に取れている投稿だけを新しい順に拾って平均を出す。
 *
 * 返り値が null = 「まだ言えない」。呼び出し側は **何も描かない**
 *（「—」も「0 秒」も出さない。出した瞬間に嘘になる）。
 */
export function avgWatchSeconds(
  posts: unknown,
  limit: number = DEFAULT_WATCH_SAMPLE_LIMIT,
): WatchTimeStat | null {
  if (!Array.isArray(posts) || limit <= 0) return null;

  const samples: { at: number; sec: number }[] = [];
  for (const p of posts) {
    if (!p || typeof p !== 'object') continue;
    const rec = p as { postedAt?: unknown; metrics?: unknown };
    const metrics = rec.metrics;
    if (!metrics || typeof metrics !== 'object') continue;
    const sec = usableSeconds((metrics as { avgWatchSec?: unknown }).avgWatchSec);
    if (sec === null) continue;
    samples.push({ at: toMs(rec.postedAt), sec });
  }
  if (samples.length < MIN_SAMPLES_FOR_AVG) return null;

  samples.sort((a, b) => b.at - a.at);
  const used = samples.slice(0, limit);
  if (used.length < MIN_SAMPLES_FOR_AVG) return null;

  const total = used.reduce((s, x) => s + x.sec, 0);
  return {
    avgSec: Math.round((total / used.length) * 10) / 10,
    count: used.length,
  };
}

/**
 * 画面に出す 1 行。stat が null なら null（＝行ごと描かない）。
 * 予想スコアの言い換えにしない — 「実測」だと分かる言葉にする。
 */
export function watchTimeLine(stat: WatchTimeStat | null): string | null {
  if (!stat) return null;
  return `実測: あなたの直近 ${stat.count} 本の平均は ${stat.avgSec.toFixed(1)} 秒`;
}
