/**
 * コマンドバーの「必要な結果だけ出す」畳み方。
 *
 * 【なぜ要るのか】(2026-09-02 / BACKLOG「入力を待って必要な結果だけ」の回収)
 * 打った瞬間、コマンドバーは**当たったもの全部**を段ごとに縦へ並べていた。
 * 「予約」のような普通の語だと、ナビ・作成・ナレッジ・タスク…と段が続き、
 * 画面 1 枚に収まらない量が出る。**多いほど選べなくなる**（迷って手が止まる）。
 * 畳む仕組み自体は既にあったが、効いていたのは `knowledge` と `task` の
 * 2 段だけで、**残りの段は何件出ても素通し**だった。
 *
 * 【やり方】打っている時だけ、段ごとに上位 3 件へ畳む
 * ・打っていない時 (一覧を眺めている時) は今までどおり。**menu を削らない**。
 * ・打った時は段ごと 3 件。隠した数は必ず数えて「ほかに◯件・すべて見る」に出す。
 *   **黙って切らない**のが唯一の条件（数字を偽らない）。
 * ・「すべて見る」を押した段 (`expanded`) は畳まない。
 *
 * 【なぜ 3 なのか】
 * 段の見出し 1 行 + 3 行 + 「ほかに◯件」1 行 = 5 行で 1 段。375px の画面で
 * **2 段が同時に見える**最大値がここ（1 行 61px・見出し 28px・実測値ベース）。
 * 4 件にすると 2 段目の見出しが折り返しの下へ落ちる。
 *
 * 【検索そのものは 1 件も削っていない】
 * 畳むのは**並べる時だけ**。当たり判定は呼ぶ側 (`filtered`) の全件のまま。
 */

/** 段ごとの上限。ここに無い段は上限なし (全部出す)。 */
export type CapMap = Readonly<Record<string, number | undefined>>;

/**
 * 一覧を眺めている時 (クエリ空) の上限。
 * ナビや作成は「何ができるのか」を見せる menu なので畳まない。
 * ナレッジ・タスクだけは件数が青天井なので 8 件で畳む（従来どおり）。
 */
export const BROWSE_CAP: CapMap = {
  knowledge: 8,
  task: 8,
};

/** 打っている時の上限。段ごと 3 件 + 「ほかに◯件」。 */
export const SEARCH_CAP_N = 3;
export const SEARCH_CAP: CapMap = {
  saved: SEARCH_CAP_N,
  recent: SEARCH_CAP_N,
  nav: SEARCH_CAP_N,
  create: SEARCH_CAP_N,
  suggestion: SEARCH_CAP_N,
  changelog: SEARCH_CAP_N,
  data: SEARCH_CAP_N,
  persona: SEARCH_CAP_N,
  knowledge: SEARCH_CAP_N,
  task: SEARCH_CAP_N,
  help: SEARCH_CAP_N,
};

export interface CapResult<T> {
  /** 実際に並べるもの。元の順番は 1 つも入れ替えない。 */
  list: T[];
  /** 段ごとに隠した件数。0 の段は入れない (画面に「ほかに 0 件」を出させない)。 */
  hidden: Map<string, number>;
}

/**
 * 段ごとに上限まで畳む。隠した件数を必ず返す。
 *
 * @param entries   並べたいもの (既に並び順が決まっているもの)
 * @param getCategory  1 件から段の名前を取り出す
 * @param caps      段ごとの上限 (`BROWSE_CAP` / `SEARCH_CAP`)
 * @param expanded  「すべて見る」を押した段。ここは畳まない
 */
export function capByCategory<T>(
  entries: readonly T[],
  getCategory: (entry: T) => string,
  caps: CapMap,
  expanded: ReadonlySet<string> = new Set(),
): CapResult<T> {
  const shown = new Map<string, number>();
  const hidden = new Map<string, number>();
  const list: T[] = [];
  for (const entry of entries) {
    const category = getCategory(entry);
    const cap = caps[category];
    if (cap === undefined || expanded.has(category)) {
      list.push(entry);
      continue;
    }
    const n = (shown.get(category) ?? 0) + 1;
    if (n <= cap) {
      shown.set(category, n);
      list.push(entry);
    } else {
      hidden.set(category, (hidden.get(category) ?? 0) + 1);
    }
  }
  return { list, hidden };
}
