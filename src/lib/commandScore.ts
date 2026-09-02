/**
 * コマンドバーで「打った時」の並び順スコア。
 *
 * 【なぜ回数を足すのか】(2026-08-31 / Raycast「いつも選ぶものが、いつも上に来る」)
 * これまでは 1 文字でも打った瞬間、並びは**文字の当たり方だけ**で決まっていた
 * (先頭一致 +10 / ラベルに含む +5 / それ以外 +1)。使った回数は `recent` が
 * 既に持っていたのに点数へ一切入っていないので、**毎日押している項目が、
 * 一度も押したことのない項目の下に来る**ことが起きていた。指が順番を覚えられない。
 *
 * 【なぜ上限が 4 なのか】
 * 回数の加点で**先頭一致が 2 番手に落ちてはいけない**（並びが毎回ゆれる方が、
 * 遅いより不快）。1 語あたり 先頭一致=10 / 含む=5 なので、加点の上限を 4 にすると
 *   ・いちばん使い込んだ「含む」 = 5 + 4 = 9  <  一度も使っていない「先頭一致」 = 10
 * となり、**先頭一致は何回使われた相手にも抜かれない**。
 *
 * 【正直に・1 つだけ段をまたぐ組み合わせ】
 * 「ラベルには無く説明文にだけ当たった」(+1) は、よく使うと 1+4=5 になり
 * 「一度も使っていない、ラベルに含む」(5) と**同点**になる。同点は回数の多い方が
 * 上に来るので、この 1 組だけは順番が入れ替わりうる。毎日押しているものが上に来る
 * という今回の狙いそのものなので、これは意図した動き（テストで固定してある）。
 */

import { readingHit } from './commandReading';

/**
 * 読みがなでだけ当たった時の点数。(2026-09-02)
 * 「説明文にだけ当たった」(+1) と同じ、いちばん弱い扱い。
 * 書いてある文字で当たったものを**絶対に追い抜かない**ための 1 点。
 */
export const READING_HIT_SCORE = 1;

/** 回数の加点の上限。5 (含む) と 10 (先頭一致) の差より小さいことが要件。 */
export const USAGE_BONUS_MAX = 4;

/** 使用回数 → 加点。0 回なら 0 点 = これまでと同じ並び。 */
export function usageBonus(count: number | undefined): number {
  if (!count || count < 0) return 0;
  return Math.min(Math.floor(count), USAGE_BONUS_MAX);
}

/**
 * 打った言葉に対する当たり方の点数。
 * 語がひとつでも当たらなければ null (= 一覧に出さない)。
 */
export function matchScore(
  label: string,
  subtitle: string | undefined,
  parts: string[],
  reading?: string,
): number | null {
  const lab = label.toLowerCase();
  const hay = (label + ' ' + (subtitle ?? '')).toLowerCase();
  // 書いてある文字で当たらなかった語だけ、読みがなの側にも当てにいく (足すだけ)
  if (!parts.every(p => hay.includes(p) || readingHit(p, reading))) return null;
  let score = 0;
  for (const p of parts) {
    if (lab.startsWith(p)) score += 10;
    else if (lab.includes(p)) score += 5;
    else if (hay.includes(p)) score += 1;
    else score += READING_HIT_SCORE;
  }
  return score;
}

/** 当たり方 + 回数。並べ替えに使う最終スコア。 */
export function rankScore(
  label: string,
  subtitle: string | undefined,
  parts: string[],
  count: number | undefined,
  reading?: string,
): number | null {
  const base = matchScore(label, subtitle, parts, reading);
  if (base === null) return null;
  return base + usageBonus(count);
}

/**
 * 並べ替え (点数の降順 → 同点なら回数の多い方)。
 * 同点・同回数のときは 0 を返す = 元の並び (安定ソート) を崩さない。
 */
export function compareRanked(
  a: { score: number; count?: number },
  b: { score: number; count?: number },
): number {
  return b.score - a.score || (b.count ?? 0) - (a.count ?? 0);
}
