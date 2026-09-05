// ============================================================
// photoSet — corp の写真を、画面に合う大きさで配る
//
// 実測（2026-09-06 Lighthouse mobile /corp）: ヒーローの下の写真6枚だけで 870KB。
// 元画像は 2000px 級で、電話（412px×2倍 ≒ 824px）には大きすぎた。
// 同じ絵の 1000px 版（public/corp/*-1000.webp）を並べ、ブラウザに選ばせる。
// ============================================================

/** 1000px 版と元画像の srcset。1000px 版が無いファイルには使わない。 */
export function photoSrcSet(src: string, fullWidth = 2000): string {
  return `${src.replace(/\.webp$/, '-1000.webp')} 1000w, ${src} ${fullWidth}w`;
}

/** 画面いっぱいに敷く写真（背景・帯） */
export const SIZES_FULL = '100vw';

/** 1160px の枠の中に 2〜3 枚並ぶカード・タイル */
export const SIZES_CARD = '(max-width: 900px) 100vw, 400px';
