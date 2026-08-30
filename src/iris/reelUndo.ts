/**
 * リールスタジオの「ひとつ前に戻す」— 直前の 1 手ぶんだけを控える小さな仕組み。
 *
 * なぜ要るか: リールスタジオは自然文で編集できる (`reelChatEdit.ts`) のが売りで、
 * その一言が「カットを消す」「並べ替える」「見た目を丸ごと入れ替える」まで実行する。
 * 実行するのは AI が解釈した結果なので、言い間違い 1 つでカットが 1 枚消える。
 * 戻す道が無いと、話しかけるのがいちばん怖い操作になってしまう。
 *
 * ここに置くのは「戻す価値があるか」を判定する純粋な部分だけ。
 * 版の履歴 (Canva のような一覧) は作らない — 直前の 1 手だけを控える。
 */

/** 戻すかどうかの判定に使うクリップの姿。実際の Clip はこれより多くの項目を持つ */
export interface UndoComparableClip {
  id: string;
  duration: number;
  captionText?: string;
  captionY?: number;
  transition?: string;
}

/** 「ひとつ前に戻す」で戻す範囲。素材そのもの (Blob) はここに含めない＝消さない */
export interface UndoComparableState {
  clips: UndoComparableClip[];
  presetId: string | null;
  colorMood: string;
}

/** 秒数は計算で作られるので、浮動小数の誤差ぶんは「変わっていない」とみなす */
const SEC_EPSILON = 0.001;

const sameClip = (a: UndoComparableClip, b: UndoComparableClip): boolean =>
  a.id === b.id
  && Math.abs(a.duration - b.duration) < SEC_EPSILON
  && (a.captionText ?? '') === (b.captionText ?? '')
  && (a.captionY ?? null) === (b.captionY ?? null)
  && (a.transition ?? null) === (b.transition ?? null);

/**
 * 控えた姿と今の姿が、本当に違うか。
 * false の時は「元に戻す」を出さない＝押しても何も起きないボタンを作らないため。
 * カットの並び (id の順番) を見ているので、削除・並べ替えの両方をここで捕まえる。
 */
export function reelEditChanged(before: UndoComparableState, after: UndoComparableState): boolean {
  if (before.presetId !== after.presetId) return true;
  if (before.colorMood !== after.colorMood) return true;
  if (before.clips.length !== after.clips.length) return true;
  for (let i = 0; i < before.clips.length; i++) {
    if (!sameClip(before.clips[i], after.clips[i])) return true;
  }
  return false;
}

/** スナックバーに出せる長さ。長い要約をそのまま出すと親指の位置で画面を埋めてしまう */
export const UNDO_LABEL_MAX = 42;

/**
 * 「何をしたのか」の一行。AI が返した要約をそのまま使い、長すぎる時だけ切る。
 * 要約が無い時は、やったことを名乗らない当たりさわりのない一行に落とす
 * (していないことを書かないため)。
 */
export function undoLabelFromSummaries(summaries: string[]): string {
  const joined = summaries.map(s => s.trim()).filter(Boolean).join('・');
  if (!joined) return '編集しました';
  return joined.length > UNDO_LABEL_MAX ? `${joined.slice(0, UNDO_LABEL_MAX - 1)}…` : joined;
}
