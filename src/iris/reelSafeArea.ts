// ============================================================
// CORE Iris ▸ 出し先ごとの形と「隠れる帯」の計算
// ------------------------------------------------------------
// ここに置いてあるのは全部「計算だけ」。画面もキャンバスも触らない。
// 理由: 出来上がる動画の形と、字幕が隠れるかどうかは、目で見て確かめられない
//       (作った本人のプレビューでは隠れていないので、投稿して初めて分かる)。
//       だから計算をここに切り出して、テストで固定する。
// ============================================================

/** 出し先。幅は 1080 で固定し、高さだけ変える。
 *  幅を変えないのは、字幕の大きさが `canvas.width / OUT_W` で決まっているため。
 *  幅を動かすと、同じ台本でも出し先ごとに文字の大きさが変わってしまう。 */
export const REEL_OUT_W = 1080;

export type ReelDestId = 'reel' | 'feed' | 'square';

export interface ReelDestination {
  id: ReelDestId;
  /** 選ぶ時に出す名前 */
  label: string;
  /** 9:16 のような比率の表示 */
  ratio: string;
  /** 書き出す高さ (幅は REEL_OUT_W 固定) */
  h: number;
  /** なぜこの形なのか (一行) */
  why: string;
  /** Instagram のアプリの部品が上に乗る形かどうか */
  hasOverlay: boolean;
}

export const REEL_DESTINATIONS: ReelDestination[] = [
  {
    id: 'reel',
    label: 'リール / ストーリーズ',
    ratio: '9:16',
    h: 1920,
    why: '画面いっぱいの縦。リールもストーリーズも同じ形です',
    hasOverlay: true,
  },
  {
    id: 'feed',
    label: 'フィード（縦長）',
    ratio: '4:5',
    h: 1350,
    why: 'フィードに流れた時にいちばん大きく出る形です',
    hasOverlay: false,
  },
  {
    id: 'square',
    label: 'フィード（正方形）',
    ratio: '1:1',
    h: 1080,
    why: 'プロフィールの並びで切り取られずにそのまま出る形です',
    hasOverlay: false,
  },
];

export function getReelDestination(id: ReelDestId): ReelDestination {
  return REEL_DESTINATIONS.find(d => d.id === id) || REEL_DESTINATIONS[0];
}

/** 9:16 で Instagram のアプリの部品が重なる帯の目安 (高さに対する割合)。
 *  上 = プロフィール名・音源・閉じるボタン。下 = 本文・いいね・コメント・返信欄。
 *  端末や表示によって少し前後するので「目安」としてしか名乗らない。 */
export const REEL_SAFE_TOP = 0.13;      // 1920 のうち約 250px
export const REEL_SAFE_BOTTOM = 0.22;   // 1920 のうち約 422px

/** 字幕の折り返し。描画側と必ず同じ規則を使う (ここが唯一の正本)。 */
export function wrapCaptionLines(text: string): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text.split('')) {
    line += ch;
    if (line.length >= 14 && /[\s、。!?！？]/.test(ch)) { lines.push(line); line = ''; }
  }
  if (line) lines.push(line);
  return lines;
}

export interface CaptionBox {
  /** 出力ピクセルでの字幕の上端 / 下端 */
  top: number;
  bottom: number;
  lines: number;
}

/** 字幕が出力の中で占める縦の範囲を、描画と同じ式で出す。
 *  描画は textBaseline='middle' なので、1 行の高さは概ね fontSize。
 *  上下に 0.6×fontSize ずつ見ておけば、フチ (stroke) まで含めて外に出ない。 */
export function captionBox(opts: {
  text: string;
  yRatio: number;
  fontSize: number;
  outH: number;
}): CaptionBox {
  const lines = wrapCaptionLines(opts.text);
  const n = Math.max(1, lines.length);
  const lh = opts.fontSize * 1.15;
  const yCenter = opts.outH * opts.yRatio;
  const half = ((n - 1) * lh) / 2 + opts.fontSize * 0.6;
  return { top: yCenter - half, bottom: yCenter + half, lines: n };
}

export type HiddenSide = 'top' | 'bottom' | null;

/** その字幕がアプリの部品に隠れるか。隠れないなら null。 */
export function captionHiddenSide(opts: {
  text: string;
  yRatio: number;
  fontSize: number;
  outH: number;
  hasOverlay: boolean;
}): HiddenSide {
  if (!opts.hasOverlay) return null;
  if (!opts.text.trim()) return null;
  const box = captionBox(opts);
  if (box.bottom > opts.outH * (1 - REEL_SAFE_BOTTOM)) return 'bottom';
  if (box.top < opts.outH * REEL_SAFE_TOP) return 'top';
  return null;
}

/** 隠れない位置に動かすとしたら、どこか。
 *  下に隠れているなら安全な帯のいちばん下へ、上なら安全な帯のいちばん上へ寄せる。
 *  行数が多くて安全な帯に収まりきらない時は、収まる範囲で中央に置く
 *  (勝手に文字を削らない。位置だけで直せない事実は、画面側で言葉にして伝える)。 */
export function safeCaptionY(opts: {
  text: string;
  yRatio: number;
  fontSize: number;
  outH: number;
}): number {
  const box = captionBox(opts);
  const half = (box.bottom - box.top) / 2;
  const safeTopPx = opts.outH * REEL_SAFE_TOP;
  const safeBottomPx = opts.outH * (1 - REEL_SAFE_BOTTOM);
  const margin = opts.outH * 0.015;
  // 安全な帯より字幕のほうが背が高い = どこに置いても少しは重なる。中央に置く。
  if (half * 2 > safeBottomPx - safeTopPx) return 0.5;
  let yCenter = opts.outH * opts.yRatio;
  if (yCenter + half > safeBottomPx - margin) yCenter = safeBottomPx - margin - half;
  if (yCenter - half < safeTopPx + margin) yCenter = safeTopPx + margin + half;
  // スライダーと同じ範囲に収める
  return Math.max(0.1, Math.min(0.95, yCenter / opts.outH));
}
