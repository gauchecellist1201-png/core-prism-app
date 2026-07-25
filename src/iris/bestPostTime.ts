// ============================================================
// CORE Iris — 最適投稿時間の計算（単一ソース）
//
// あなた自身の過去投稿の“伸び”（反応率）から、よく伸びる曜日・時間帯を出す。
// honest-numbers 厳守：十分なデータ（4投稿以上で反応の数字あり）が無いときは
// enough=false を返し、UI 側は「一般的な目安」と明記して数字を作らない。
//
// IrisBestTime.tsx（専用カード）と、リール書き出し直後の
// 「いつ出す？」提案の両方がこの関数を使う（数字の出所を一本化）。
// ============================================================
import type { PostHistoryItem } from './strategist';

export const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export const TIME_BANDS: { label: string; test: (h: number) => boolean }[] = [
  { label: '朝（6〜10時）', test: (h) => h >= 6 && h < 11 },
  { label: '昼（11〜14時）', test: (h) => h >= 11 && h < 15 },
  { label: '夕方（15〜18時）', test: (h) => h >= 15 && h < 19 },
  { label: '夜（19〜22時）', test: (h) => h >= 19 && h < 23 },
  { label: '深夜（23〜5時）', test: (h) => h >= 23 || h < 6 },
];

// 1投稿の“伸び”スコア。反応率があれば最優先、無ければリーチから推定、それも無ければ生反応数。
function score(p: PostHistoryItem): number | null {
  const m = p.metrics || {};
  if (typeof m.engagementRate === 'number' && m.engagementRate > 0) return m.engagementRate;
  const eng = (m.likes || 0) + (m.comments || 0) + (m.saves || 0) + (m.shares || 0);
  if (m.reach && m.reach > 0) return (eng / m.reach) * 100;
  return eng > 0 ? eng : null;
}

function bandOf(h: number): string {
  return (TIME_BANDS.find((b) => b.test(h)) || TIME_BANDS[TIME_BANDS.length - 1]).label;
}

export type BestTimeResult =
  | { enough: false; n: number }
  | {
      enough: true;
      n: number;
      bestDow: { d: number; avg: number; n: number };
      bestBand: { band: string; avg: number; n: number };
    };

/**
 * 過去投稿から「一番伸びる曜日・時間帯」を honest に算出する。
 * 反応の数字がある投稿が 4 件未満なら enough:false（推測で数字を作らない）。
 */
export function computeBestPostTime(posts: PostHistoryItem[]): BestTimeResult {
  const scored = posts
    .map((p) => {
      const d = new Date(p.postedAt);
      const s = score(p);
      if (isNaN(d.getTime()) || s === null) return null;
      return { dow: d.getDay(), hour: d.getHours(), band: bandOf(d.getHours()), s };
    })
    .filter(Boolean) as { dow: number; hour: number; band: string; s: number }[];

  if (scored.length < 4) return { enough: false, n: scored.length };

  const avg = (rows: { s: number }[]) => rows.reduce((a, r) => a + r.s, 0) / rows.length;
  const byDow = new Map<number, { s: number }[]>();
  const byBand = new Map<string, { s: number }[]>();
  for (const r of scored) {
    (byDow.get(r.dow) || byDow.set(r.dow, []).get(r.dow)!).push(r);
    (byBand.get(r.band) || byBand.set(r.band, []).get(r.band)!).push(r);
  }
  const bestDow = [...byDow.entries()]
    .map(([d, rows]) => ({ d, avg: avg(rows), n: rows.length }))
    .sort((a, b) => b.avg - a.avg)[0];
  const bestBand = [...byBand.entries()]
    .map(([band, rows]) => ({ band, avg: avg(rows), n: rows.length }))
    .sort((a, b) => b.avg - a.avg)[0];
  return { enough: true, n: scored.length, bestDow, bestBand };
}

/** バンドの代表時刻（datetime-local の初期値づくり用）。「夜」→ 20 時 など。 */
export function bandStartHour(band: string): number {
  if (band.startsWith('朝')) return 8;
  if (band.startsWith('昼')) return 12;
  if (band.startsWith('夕方')) return 17;
  if (band.startsWith('夜')) return 20;
  return 21; // 深夜帯は一般的な夜寄りの 21 時を目安に
}
