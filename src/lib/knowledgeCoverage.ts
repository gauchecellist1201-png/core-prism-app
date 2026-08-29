// ============================================================
// knowledgeCoverage — 「今の資料には無かった」を正直に言うための判定（計算だけ）
//
// なぜ要るか (BACKLOG 2026-08-23 Prism ← Notion AI):
//   selectRelevantKnowledge はスコア 0 の資料を返さない。つまり
//   **関連する資料が1件も無い質問でも、AI は黙って一般論を答える**。
//   画面には出典チップも出ないが、「出典が無い」ことと「一般論で答えた」ことは
//   使う側には区別できない ＝ うちの資料を読んで答えたように見える。
//   これがいちばん危ない嘘（社内の事情と違う一般論を、社内の答えとして受け取る）。
//
// 守っていること:
//   ①答えは止めない（一般論が役に立つ場面はある。これは注記であって警告ではない）
//   ②文言は1種類だけ・警告色を使わない
//   ③**まだ資料を1件も入れていない人には出さない**（毎回出たら意味が薄れる）
//   ④判定は「実際にプロンプトへ渡したもの」だけを見る（AI に書かせない）
// ============================================================

/** 答えの上に出す一行。文言はここが正本（画面ごとに書き換えない）。 */
export const NO_KNOWLEDGE_MATCH_TEXT =
  'この質問に当てはまる資料が見つからなかったので、一般的な内容でお答えします';

/** 行き止まりにしないための1タップ。 */
export const NO_KNOWLEDGE_MATCH_CTA = '資料を入れる';

export interface KnowledgeCoverageInput {
  /** この人格（プロダクト横断ならその範囲）が持っている資料の総数。 */
  totalKnowledgeCount: number;
  /** 実際にプロンプトへ渡した抜粋（チャンク）の件数。 */
  relevantChunkCount: number;
  /** 実際にプロンプトへ渡した関連資料（item）の件数。 */
  relevantItemCount: number;
}

/**
 * 「資料からは何も渡せていない回答」か。true のときだけ注記の一行を出す。
 *
 * item が 1 件でも渡っていれば false ＝ 出典チップが出る回答と食い違わない
 * （チップで「参照: ◯◯」と出しながら「資料が無かった」と言う画面を作らない）。
 */
export function isNoKnowledgeMatch(input: KnowledgeCoverageInput): boolean {
  const { totalKnowledgeCount, relevantChunkCount, relevantItemCount } = input;
  // まだ何も入れていない人には出さない（入れてから初めて意味のある注記になる）
  if (!Number.isFinite(totalKnowledgeCount) || totalKnowledgeCount <= 0) return false;
  return relevantChunkCount <= 0 && relevantItemCount <= 0;
}
