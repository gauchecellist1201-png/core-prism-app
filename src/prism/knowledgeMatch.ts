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
    // ①見出しがそのまま出てくる か ②メモの冒頭がそのまま出てくる、のどちらか。
    // ①だけだと「広告費の見直し」のように見出しの後半が違う重複を落とす。
    // ②だけだと「請求書の締切は月末」のように本文に続きがある重複を落とす。
    const head = (item.title + '。' + (item.content || '').slice(0, SIMILAR_HEAD_CHARS)).trim();
    const coverage = Math.max(coverageOf(item.title, item, keys), coverageOf(head, item, keys));
    if (coverage < minCoverage) continue;
    const score = scoreItem(item, keys);
    if (!best || score > best.score || (score === best.score && coverage > best.coverage)) {
      best = { item, score, coverage };
    }
  }
  return best;
}
