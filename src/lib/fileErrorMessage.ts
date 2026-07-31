// ============================================================
// 取り込み失敗の理由を「人の言葉 + 直し方」に翻訳する
// ------------------------------------------------------------
// fileParser.ts に置かない理由:
// あちらは pdfjs/mammoth/xlsx/jszip を抱える 1MB 級で、動的 import に
// 追い出してある。ここを静的 import したい画面 (KnowledgeBase 等) から
// 引っぱると main バンドルに 1MB が戻ってきてしまう。
// 依存ゼロのこのファイルに分けておく。
// ============================================================

function ext(name: string): string {
  const m = name.toLowerCase().match(/\.([^.]+)$/);
  return m ? m[1] : '';
}

/**
 * pdfjs / mammoth / JSZip が投げる英語のメッセージが、
 * そのまま画面に出ないようにする。必ず「次に何をすればいいか」で終える。
 */
export function friendlyFileError(raw: unknown, fileName = ''): string {
  const m = raw instanceof Error ? `${raw.name}: ${raw.message}` : String(raw);
  if (/password|encrypt/i.test(m)) {
    return 'パスワードがかかっていて開けませんでした。パスワードを外して保存し直したものを入れてください。';
  }
  if (/invalid pdf|corrupt|end of (file|central directory)|bad zip|not a zip|invalid signature|malformed/i.test(m)) {
    return 'ファイルが壊れているようです。元のアプリで開いて保存し直したものを入れてください。';
  }
  if (/out of memory|allocation|array buffer|maximum call stack|too large/i.test(m)) {
    return 'ファイルが大きすぎて読めませんでした。分けるか、必要なページだけにして入れ直してください。';
  }
  // ブラウザは "Failed to fetch"、Node は "fetch failed" と語順が逆になる。両方拾う。
  if (/network|failed to (fetch|load)|fetch failed|load failed|timeout|worker/i.test(m)) {
    return '通信が途切れて読み込めませんでした。電波を確かめて、もう一度お試しください。';
  }
  if (/notreadable|permission|notfound|no such file/i.test(m)) {
    return 'ファイルを開けませんでした。移動や削除がされていないか確かめてください。';
  }
  if (/未対応の形式/.test(m)) {
    const e = ext(fileName);
    return `${e ? `.${e} は` : 'この形式は'}まだ中身を読めません。PDF / Word / Excel / PowerPoint / CSV / 画像 / テキストに変換して入れてください。`;
  }
  return `中身を読み取れませんでした（${m.slice(0, 80)}）。もう一度お試しください。`;
}
