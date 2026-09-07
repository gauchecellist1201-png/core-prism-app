// ============================================================
// CORE Prism — 知識の関連度（AI 呼び出しゼロ・往復ゼロ）
//
// もともと knowledgeBrain.ts の中に閉じていた 3 つの純関数を、そのまま
// ここへ移した。**中身は 1 行も変えていない**（質問への並べかえの結果が
// 変わらないこと＝既存の挙動を崩さないことが最優先）。
//
// 切り出した理由は 2 つ。
//  ①**判定の基準を 2 つに増やさない**。クイック・キャプチャの「近いメモ」と
//    ナレッジ脳の並べかえが別々の物差しを持つと、「検索では出るのに
//    書いている時は出ない」が起きて、どちらも信用されなくなる。
//  ②knowledgeBrain.ts は AI 呼び出し(aiFallbackChain)を抱えている。
//    入力欄のためにそれを読み込ませたくない（このモジュールは依存ゼロ）。
// ============================================================
import type { KnowledgeItem } from '../types/identity';

// ─── 質問との関連度でならべかえる ───────────────────────
export function tokenize(q: string): string[] {
  const words = q
    .toLowerCase()
    .split(/[\s\u3000、。,.:;!?！？「」『』（）()[\]/]+/)
    .filter(w => w.length >= 2);
  // 日本語は分かち書きされないので、2〜4文字の部分列も鍵にする
  const grams: string[] = [];
  const jp = q.replace(/[\s\u3000]/g, '');
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i + n <= jp.length && grams.length < 120; i++) {
      const g = jp.slice(i, i + n);
      if (/[぀-ヿ一-鿿]/.test(g)) grams.push(g.toLowerCase());
    }
  }
  return Array.from(new Set([...words, ...grams]));
}

export function scoreItem(item: KnowledgeItem, keys: string[]): number {
  if (keys.length === 0) return 0;
  const title = item.title.toLowerCase();
  const tags = item.tags.join(' ').toLowerCase();
  // 本文は先頭 20,000 文字だけを対象にする（全文走査は件数が増えると重い）
  const body = (item.content || '').slice(0, 20000).toLowerCase();
  let score = 0;
  for (const k of keys) {
    if (title.includes(k)) score += 12;
    if (tags.includes(k)) score += 5;
    const hits = body.split(k).length - 1;
    if (hits > 0) score += Math.min(hits, 8);
  }
  return score;
}

export function recencyBonus(item: KnowledgeItem): number {
  const t = Date.parse(item.createdAt);
  if (!Number.isFinite(t)) return 0;
  const days = (Date.now() - t) / 86400000;
  if (days < 7) return 6;
  if (days < 30) return 3;
  if (days < 90) return 1;
  return 0;
}

// ─── 書いている最中の「それ、前にも書いています」──────────
//
// ★2026-09-06 追加（BACKLOG「Prism ← Mem」）。
// 貯めた知識が、こちらから質問するまで一度も返ってこない状態を直す。
// **出すのは「見に行く」だけ**。統合も上書きも警告もしない（消える事故が最悪）。
//
// しきい値の考え方（ここが全部）:
//   `scoreItem` をそのまま使うと、**長い資料ほど必ず当たる**。2文字の鍵は
//   20,000 文字の事業計画になら何であれ何度も出てくるので、本文の点だけでは
//   「関係あるから当たった」のか「長いから当たった」のかが区別できない。
//   そこで **見出し(+タグ)にだけ当てた点** を門にする。同じ `scoreItem` に
//   本文を空にした姿を渡すだけ＝**2つ目の物差しを作らない**。
//
//   さらに「〜について」のような、どの見出しにも出てくる短い重なりで
//   誤爆しないよう、**見出しの側の鍵のうち何割が打った文字に出てくるか**で
//   割る。打った文が長くなっても薄まらない（打った側で割ると、200文字書いた
//   瞬間に本物の重複まで落ちる）。

/** 「近いメモ」を出す最低ライン。見出しの鍵の 34% 以上が、打った文字の中にある事。 */
export const SIMILAR_MIN_COVERAGE = 0.34;
/** 打った文字が短すぎる時は何も出さない（2文字では鍵が1つしか立たない）。 */
export const SIMILAR_MIN_KEYS = 3;

export interface SimilarHit {
  item: KnowledgeItem;
  /** 本文まで含めた関連度（並べかえに使う。ナレッジ脳と同じ物差し） */
  score: number;
  /** 見出しの何割が重なっているか 0〜1（出すか出さないかの判定に使う） */
  coverage: number;
}

/** メモの「顔」として比べる長さ。長い資料の全文と比べない（長いほど当たるのを避ける）。 */
export const SIMILAR_HEAD_CHARS = 120;

/**
 * 「その文字列の鍵のうち、何割が打った文字の中に出てくるか」0〜1。
 * `scoreItem` に見出しだけの姿を渡して数えるので、**物差しは1つのまま**。
 */
function coverageOf(text: string, item: KnowledgeItem, keys: string[]): number {
  const own = tokenize(text);
  if (own.length === 0) return 0;
  const hit = scoreItem({ ...item, title: text, content: '', tags: [] }, keys) / 12;
  return Math.min(hit, own.length) / own.length;
}

/**
 * 1件の知識が、打った/開いた文字にどれだけ近いか。**物差しはここ1つだけ**。
 *
 * `findSimilarKnowledge`（書いている最中の「近いメモ」）と
 * `rankRelatedKnowledge`（開いた資料の隣の3件）が**同じ関数を通る**ことに意味がある。
 * 別々の基準を持つと「書いている時は出るのに、開いた時は出ない」が起きて、
 * どちらも信用されなくなる（このファイルの冒頭に書いた切り出しの理由そのもの）。
 */
export function relevanceOf(item: KnowledgeItem, keys: string[]): { score: number; coverage: number } {
  // ①見出しがそのまま出てくる か ②メモの冒頭がそのまま出てくる、のどちらか。
  // ①だけだと「広告費の見直し」のように見出しの後半が違う重複を落とす。
  // ②だけだと「請求書の締切は月末」のように本文に続きがある重複を落とす。
  const head = (item.title + '。' + (item.content || '').slice(0, SIMILAR_HEAD_CHARS)).trim();
  const coverage = Math.max(coverageOf(item.title, item, keys), coverageOf(head, item, keys));
  return { score: scoreItem(item, keys), coverage };
}

/**
 * 打っている文字に「近いメモ」が既にあるか。**上位1件だけ**返す。
 * AI 呼び出しゼロ・保存ゼロ・副作用ゼロ。当てはまらなければ null（無理に1件出さない）。
 */
export function findSimilarKnowledge(
  items: KnowledgeItem[],
  text: string,
  opts: { minCoverage?: number; minKeys?: number; excludeId?: string } = {},
): SimilarHit | null {
  const minCoverage = opts.minCoverage ?? SIMILAR_MIN_COVERAGE;
  const minKeys = opts.minKeys ?? SIMILAR_MIN_KEYS;
  const keys = tokenize(text);
  if (keys.length < minKeys) return null;

  let best: SimilarHit | null = null;
  for (const item of items) {
    if (opts.excludeId && item.id === opts.excludeId) continue;
    if (!item.title) continue;
    const { score, coverage } = relevanceOf(item, keys);
    if (coverage < minCoverage) continue;
    if (!best || score > best.score || (score === best.score && coverage > best.coverage)) {
      best = { item, score, coverage };
    }
  }
  return best;
}

// ─── 1件ひらいた時の「関係する3件」──────────────────────
//
// ★2026-09-07 追加（BACKLOG「知識を1件ひらいた時に、関係する3件を下に出す」）。
// 隣の3件はもともと `selectRelevantKnowledge`（useClaude.ts）で選んでいたが、
// あれは**本文を一切見ず・2gramだけ・score>0なら何でも通す**別の物差しだった。
// 同じ Prism の中に基準が2つあると、「書いている時は出るのに、開くと出ない」
// （またはその逆）が起きる。ここへ寄せて **物差しを1つに戻す**。
//
// しきい値を「近いメモ」(0.34)と分けている理由:
//   あちらの問い合わせ文は**人が打った短い文**、こちらは**資料まるごと**。
//   coverage は「候補の見出しの鍵のうち何割が問い合わせ文に出てくるか」で、
//   割る側は候補なので問い合わせ文が長くても薄まらない——が、**当てにいける
//   鍵の数はこちらの方が多い**ので、同じ 0.34 では本物を落とす。
//   実測（6〜8件の資料で全ペアの coverage を出した）:
//     本物の関連 … 0.538 / 0.538 / 0.375 / 0.368 / 0.273 / 0.273
//     ただの雑音 … 0.107 / 0.103 / 0.038 / 0.036 / 0.031 以下
//   雑音の山（0.107 以下）と本物の下限（0.273）の間を取って 0.15 とした。
//   0.34 のままだと「請求書の締切 → 請求書の送り先メモ」(0.273) を落とす。
export const RELATED_MIN_COVERAGE = 0.15;

/**
 * 開いている資料の隣に出す候補を、**関連度の高い順に全部**返す。
 * 切るのは呼んだ側の枠の都合（何件出すか・古い枠を空けるか）。
 *
 * AI 呼び出しゼロ・保存ゼロ・副作用ゼロ（渡した配列を書き換えない）。
 * 当てはまるものが無ければ空配列（**無理に3件埋めない**）。
 */
export function rankRelatedKnowledge(
  items: KnowledgeItem[],
  text: string,
  opts: { minCoverage?: number; minKeys?: number; excludeId?: string } = {},
): SimilarHit[] {
  const minCoverage = opts.minCoverage ?? RELATED_MIN_COVERAGE;
  const minKeys = opts.minKeys ?? SIMILAR_MIN_KEYS;
  const keys = tokenize(text);
  // ★鍵が立たない資料（「ー」だけ 等）で、無関係な資料を「関係あるもの」として
  //   並べない。旧 `selectRelevantKnowledge` は鍵ゼロの時に先頭 N 件を
  //   そのまま返していた＝**全くの無関係が3件並ぶ**（実測で確認済み）。
  if (keys.length < minKeys) return [];

  const hits: SimilarHit[] = [];
  for (const item of items) {
    if (opts.excludeId && item.id === opts.excludeId) continue;
    if (!item.title) continue;
    const { score, coverage } = relevanceOf(item, keys);
    if (coverage < minCoverage) continue;
    hits.push({ item, score, coverage });
  }
  return hits.sort((a, b) => (b.score - a.score) || (b.coverage - a.coverage));
}
