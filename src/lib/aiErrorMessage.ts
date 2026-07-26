// ============================================================
// aiErrorMessage — AIの失敗を「やさしい言葉＋次の一手」に直す (2026-07-27)
//
// なぜ要るか:
//   これまで画面に「提案APIエラー: 404」やAPIの英語メッセージがそのまま
//   出ていた。読んだ人には何が起きたのかも、次に何をすればいいのかも
//   分からない＝いちばん不信感が出る出し方。
//
// 方針:
//   ・番号や英語の原文を人に見せない（開発者向けには console に残す）
//   ・必ず「次にどうすればいいか」まで書く
// ============================================================

/** HTTPステータスから、人に見せる一文を作る */
export function aiErrorFromStatus(status: number): string {
  if (status === 429) {
    return 'いまAIへの依頼が混み合っています。1分ほど待ってから、もう一度おためしください。';
  }
  if (status === 401 || status === 403) {
    return 'AIにつなぐ許可が確認できませんでした。ページを開き直してもう一度おためしください。直らないときはサポートへご連絡ください。';
  }
  if (status === 404) {
    return 'AIの窓口が見つかりませんでした。ページを開き直すと直ることがあります。直らないときはサポートへご連絡ください。';
  }
  if (status === 408 || status === 504) {
    return 'AIの返事が時間内に返ってきませんでした。もう一度おためしください。';
  }
  if (status >= 500) {
    return 'AI側が一時的に不調です。少し待ってから、もう一度おためしください。';
  }
  return 'AIからの返事を受け取れませんでした。通信状況を確かめて、もう一度おためしください。';
}

/**
 * API のエラー応答を、人に見せる一文にする。
 * 原文は console にだけ残す（サポート時の手がかり用）。
 */
export function aiErrorMessage(status: number, raw?: unknown, where = 'ai'): string {
  try {
    if (raw) console.warn(`[${where}] AI error ${status}:`, raw);
  } catch { /* noop */ }
  return aiErrorFromStatus(status);
}

/**
 * 例外オブジェクトを、人に見せる一文にする。
 * すでに日本語で書かれたメッセージ（このファイル製・自前の検証エラー）はそのまま通す。
 */
export function humanizeAiError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? '');
  if (!raw) return aiErrorFromStatus(0);
  // 日本語が入っていて、かつ生のステータス番号を含まないものは、そのまま出してよい
  if (/[ぁ-んァ-ヶ一-龠]/.test(raw) && !/エラー:\s*\d{3}/.test(raw)) return raw;
  try { console.warn('[ai] raw error:', raw); } catch { /* noop */ }
  const m = raw.match(/\b(4\d{2}|5\d{2})\b/);
  return aiErrorFromStatus(m ? Number(m[1]) : 0);
}
