// クイックアクションの検索。
// ねらいは 2 つ:
//  1) 日本語入力の「変換前のひらがな」でも当たること
//     (iPhone の IME は変換前の文字も入力欄に入れてくるので、
//      「せいきゅうしょ」の時点で 0 件になると、打っている最中ずっと行き止まりが出る)
//  2) 0 件になっても行き止まりにしないこと (近い機能を出す)

/** ひらがな・カタカナ・全角半角・大文字小文字の違いを吸収する */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')          // 全角英数字・半角カナをそろえる
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)) // カタカナ→ひらがな
    .replace(/[\s、。・,.]+/g, ''); // 区切り記号は無視
}

export interface SearchableAction {
  id: string;
  label: string;
  desc: string;
}

/** 1 つの機能ぶんの「探される言葉」をまとめた文字列 */
function haystackOf(a: SearchableAction, keywords: Record<string, string>): string {
  return normalizeText(`${a.label} ${a.desc} ${keywords[a.id] || ''}`);
}

/** 同じ言葉を、単語ごとに切り出したもの (「もしかして」の判定に使う) */
export function haystackTokens(a: SearchableAction, keywords: Record<string, string>): string[] {
  return `${a.label} ${a.desc} ${keywords[a.id] || ''}`
    .split(/[\s、。・,./|（）()「」]+/)
    .map(normalizeText)
    .filter(Boolean);
}

/**
 * 打ち間違い・打ちすぎでもどれだけ近いか (0〜1)。
 *
 * 見るのは「同じ書き出しの言葉があるか」。
 * 打ち間違いは終わりのほうで起きる (「請求書」→「請求所」、変換前で一文字多い) ため、
 * 言葉の頭から合っている長さが一番あてになる。
 * 言葉の途中でたまたま重なっただけのもの
 * (「どうが」の“どう”が「かつどう」に入っている等) は数えないので、
 * 関係ない機能を「こちらではありませんか？」に出さずに済む。
 */
export function nearScore(query: string, tokens: string[]): number {
  if (query.length === 0) return 0;
  let best = 0;
  for (const t of tokens) {
    let k = 0;
    while (k < query.length && k < t.length && query[k] === t[k]) k++;
    if (k > best) best = k;
  }
  if (best < 2) return 0; // 1 文字だけの一致は「近い」とは言わない
  return best / query.length;
}

/** 打ち始めの半分以上が合っていれば「もしかして」に出す */
export const NEAR_THRESHOLD = 0.5;
export const NEAR_MAX = 3;

export interface SearchResult<T> {
  /** そのまま当たったもの */
  hits: T[];
  /** 0 件のときだけ出す「もしかして」 */
  near: T[];
}

/**
 * 機能を探す。当たらなければ near に近いものを最大 3 つ返す。
 * near も空なら呼び出し側が「よく使われているもの」を出す (行き止まりを作らない)。
 */
export function searchActions<T extends SearchableAction>(
  items: T[],
  rawQuery: string,
  keywords: Record<string, string> = {},
): SearchResult<T> {
  const q = normalizeText(rawQuery.trim());
  if (!q) return { hits: items, near: [] };

  const pairs = items.map(a => ({ a, hay: haystackOf(a, keywords), tokens: haystackTokens(a, keywords) }));
  const hits = pairs.filter(p => p.hay.includes(q)).map(p => p.a);
  if (hits.length > 0) return { hits, near: [] };

  const near = pairs
    .map(p => ({ a: p.a, score: nearScore(q, p.tokens) }))
    .filter(p => p.score >= NEAR_THRESHOLD)
    .sort((x, y) => y.score - x.score)
    .slice(0, NEAR_MAX)
    .map(p => p.a);

  return { hits: [], near };
}
