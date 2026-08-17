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

/** 途中で打ち切られたとき（fetchWithTimeout の abort・ページ離脱） */
export const AI_TIMEOUT_MSG =
  '時間内に返事が返ってこなかったので、いったん止めました。電波の良いところで、もう一度おためしください。';

/** そもそも通信が切れているとき。「AIが壊れた」と誤解させない */
export const AI_OFFLINE_MSG =
  'いま通信が切れているようです。電波の届く場所に移って、もう一度おためしください。';

/** 打ち切り（AbortError）由来か。DOMException でも独自 Error でも拾う */
function isAbortLike(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name;
  return name === 'AbortError' || name === 'TimeoutError';
}

/** ブラウザが「今オフライン」と言っているか。判定できない環境では false */
function isOffline(): boolean {
  try {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  } catch { return false; }
}

/**
 * 例外オブジェクトを、人に見せる一文にする。
 * すでに日本語で書かれたメッセージ（このファイル製・自前の検証エラー）はそのまま通す。
 *
 * 2026-08-18 追記: Iris の AI 画面 20 か所以上が `e.message` を素通しで出していて、
 * 「Failed to fetch」「429 Too Many Requests」がそのまま人に見えていた。
 * 全部この関数を通す方針にしたので、ここが最後の砦になる。
 */
export function humanizeAiError(e: unknown): string {
  // 打ち切りは「AIの不調」ではないので、番号を探す前に分ける
  if (isAbortLike(e)) return AI_TIMEOUT_MSG;

  const raw = e instanceof Error ? e.message : String(e ?? '');
  if (!raw) return isOffline() ? AI_OFFLINE_MSG : aiErrorFromStatus(0);

  // 日本語が入っていて、かつ生のステータス番号を含まないものは、そのまま出してよい
  if (/[ぁ-んァ-ヶ一-龠]/.test(raw) && !/エラー:\s*\d{3}/.test(raw)) return raw;

  try { console.warn('[ai] raw error:', raw); } catch { /* noop */ }

  // ステータス番号は「status 429」「HTTP 500」のような書かれ方を優先して読む。
  // これをしないと「Unexpected token < in JSON at position 512」の 512 を
  // サーバー不調と読み違える。
  const tagged = raw.match(/\b(?:status|code|http)\b[^0-9]{0,4}([1-5]\d{2})\b/i);
  if (tagged) return aiErrorFromStatus(Number(tagged[1]));

  // 通信そのものが失敗した形（Safari は "Load failed"、Chrome は "Failed to fetch"）
  if (/failed to fetch|networkerror|load failed|network request failed|err_internet/i.test(raw)) {
    return isOffline() ? AI_OFFLINE_MSG : aiErrorFromStatus(0);
  }

  // 番号らしきものを最後にざっくり拾うが、「位置 512」「行 404」のような
  // ステータスではない番号は先に取り除く（JSON パース失敗を鯖落ちと読まないため）
  const withoutOffsets = raw.replace(/\b(?:position|offset|index|line|column|col|byte)\b[^0-9]{0,4}\d+/gi, ' ');
  const m = withoutOffsets.match(/\b(4\d{2}|5\d{2})\b/);
  if (m) return aiErrorFromStatus(Number(m[1]));
  return isOffline() ? AI_OFFLINE_MSG : aiErrorFromStatus(0);
}

/**
 * 「〇〇できませんでした」+ 原因、を安全に組み立てる。
 *
 * これが無いと `\`予約に失敗しました: ${e.message}\`` のような書き方で
 * 日本語の頭だけ付いた英語の原文が出てしまう（humanizeAiError の
 * 日本語素通しをすり抜ける唯一の穴がここだった）。
 */
/**
 * AI ではない失敗（端末への保存・ファイル読み込み・共有シート）を人の言葉にする。
 *
 * humanizeAiError を使うと「AI側が一時的に不調です」と言ってしまい、
 * 実際には端末の空き容量や対応形式の話だった、という別の嘘になる。
 * ここでは自分で書いた日本語だけ通し、それ以外は呼び出し側の言葉に置き換える。
 */
export function humanizeNonAiError(e: unknown, fallback: string): string {
  const raw = e instanceof Error ? e.message : String(e ?? '');
  if (raw && /[ぁ-んァ-ヶ一-龠]/.test(raw) && !/エラー:\s*\d{3}/.test(raw)) return raw;
  try { if (raw) console.warn('[iris] raw error:', raw); } catch { /* noop */ }
  return fallback;
}

export function aiFailureWithReason(lead: string, e: unknown): string {
  const why = humanizeAiError(e);
  const head = lead.replace(/[。:：\s]+$/, '');
  return `${head}。${why}`;
}
