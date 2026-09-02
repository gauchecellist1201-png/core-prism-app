/**
 * コマンドバーの「もしかして？」候補のスコア計算。
 *
 * 打った言葉が 1 件も当たらなかった時に、近いものを出すためだけに使う。
 *
 * 【1 文字だけの重なりを数えない理由】(2026-08-30)
 * 以前は 1 文字 + 2 文字の n-gram を両方数えていた。日本語の画面では
 * 「経日」→「今日のレポート」、「xyz123」→「人物カルテ / 1on1」のように
 * **たまたま 1 文字かぶっただけの無関係な候補**が「もしかして？」に出てしまう。
 * 見当違いの候補は、候補が無いことよりも不親切なので、
 * **2 文字以上つながって重なった時だけ**候補として数える。
 * これで「議事六 → 議事録」「請求所 → 請求書」「画象生成 → 画像生成」は残り、
 * 「ぁぁぁ」「xyz123」「経日」のような当たらない言葉では 0 件になる (実測)。
 */

import { isKanaPart, normalizeKanaPart } from './commandReading';

/** クエリから 2 文字のかたまりを作る (空白をまたぐものは捨てる) */
export function bigrams(query: string): string[] {
  const q = query.trim().toLowerCase();
  const out = new Set<string>();
  for (let i = 0; i < q.length - 1; i++) {
    const g = q.slice(i, i + 2);
    if (/\s/.test(g)) continue;
    out.add(g);
  }
  return [...out];
}

/** 重なった 2 文字のかたまり 1 つにつき +2。0 なら「近くない」= 出さない。 */
export function fuzzyScore(query: string, haystack: string, reading?: string): number {
  const hay = haystack.toLowerCase();
  let score = 0;
  for (const g of bigrams(query)) {
    if (hay.includes(g)) score += 2;
  }
  // かなで打っている時は、読みがなの側にも当てにいく (2026-09-02)
  // 「せいきゅうしょ」「うりあけ」のように**変換前の打ち間違い**は、
  // 書いてある漢字とは 1 文字も重ならないので、読みが無いと一生 0 件になる。
  if (reading && isKanaPart(query.trim())) {
    let byReading = 0;
    for (const g of bigrams(normalizeKanaPart(query))) {
      if (reading.includes(g)) byReading += 2;
    }
    if (byReading > score) score = byReading;
  }
  return score;
}

/** この点数に届かないものは「もしかして？」に出さない (= 2 文字の重なりが 1 つも無い) */
export const FUZZY_MIN_SCORE = 2;
