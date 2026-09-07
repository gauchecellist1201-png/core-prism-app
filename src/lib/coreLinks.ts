// ============================================================
// coreLinks — CORE の他サービスへ出て行くリンクの正本
//
// 2026-09-06: NERI LP へのリンクが 6 か所に直書きされ、全部が
// `core-nexus-kappa.vercel.app/lp/`（Vercel が自動で付ける方のホスト）を指していた。
// LP 自身の canonical は `https://nexus.core-ai.jp/lp/` なので、
//   ・検索エンジンには「正本ではない方」へ内部リンクが集まっていた
//   ・www.core-ai.jp と nexus.core-ai.jp は同じ登録ドメイン＝cookie を共有するのに、
//     vercel.app は別ドメインなので GA4 のセッションが跨ぐたびに切れやすかった
// ここに 1 本だけ持ち、リンクは必ずこの関数から作る。
//
// ★アプリ本体（`https://core-nexus-kappa.vercel.app` のルート）は据え置く。
//   本体はホスト単位の localStorage に鍵と履歴を持つので、ホストを変えると
//   既に触ってくれた人の状態が消える。ここで統一するのは LP だけ。
// ============================================================

/** NERI のランディングページ（正本ホスト）。 */
export const NERI_LP = 'https://nexus.core-ai.jp/lp/';

/** ROAI SCORE 診断（約3分・連絡先不要）。Studio → 診断 → NERI の真ん中の段。 */
export const ROAI_SCORE = 'https://www.core-ai.jp/roai-score';

/** NERI の実物（登録不要で話しかけられる本体）。ホストは据え置き。 */
export const NERI_APP = 'https://core-nexus-kappa.vercel.app';

/**
 * 「どこから NERI へ送ったか」を着いた側でも数えられるようにする。
 *
 * utm_* は使わない。www.core-ai.jp と nexus.core-ai.jp は GA4 から見て
 * 同じ cookie 域なので、内部リンクに utm を付けると そこで新しいセッションが始まり、
 * 本当の流入元（検索・LINE・広告）が「自社サイト経由」に上書きされて消える。
 * 自前の `from` なら GA4 のキャンペーンにはならず、LP 側の core:funnel だけに効く。
 *
 * @param from 12文字以内の短い場所名（corp-card / studio-care など）
 */
export function neriLpUrl(from: string): string {
  // LP 側の受け取りと同じ形に落とす（使えない文字を落としてから 12 文字で切る。
  // 先に切ると「切った位置がたまたま日本語」で意味の無い印になる）。
  const f = from.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 12).replace(/^-+|-+$/g, '');
  return f ? `${NERI_LP}?from=${f}` : NERI_LP;
}

/**
 * NERI の「いくらから／無料でどこまで」。
 * NERI 側（別リポジトリの LP）が正本なので、ここを直すときは
 * https://nexus.core-ai.jp/lp/ の料金表と必ず突き合わせる。
 * 金額を書かずに送ると、押した先で初めて金額を見ることになる（それは不親切）。
 */
export const NERI_FACTS = {
  from: '月 ¥39,800（税込）から',
  free: '無料は1日5回・登録もカードも要りません',
} as const;
