// ============================================================
// CORE Iris ▸ MP4 で書き出せなかった時の「この端末でできること」 — 2026-09-03
//
// 何のためにあるか:
//   MediaRecorder が MP4 に非対応だと書き出しは WebM になる。
//   これまでの案内は端末を問わず一律で
//   「Safari で同じ操作を行うか、CloudConvert / HandBrake で MP4 に変換して」
//   だった。ところが Iris はスマホ 1 台で終われることが売りで、
//   ・HandBrake は **パソコン専用ソフト** = iPhone では 1 手も進めない
//   ・「Safari で同じ操作」は iPhone なら効くのに、
//     URL を手で打ち直す以外の道がなく、押せる形になっていなかった
//   つまり「詰まった人に、その端末で実行できない手順を渡していた」。
//
// 約束:
//   ・ここは計算だけ。DOM も navigator も触らない (呼び出し側が ua を渡す)
//   ・**その端末で実際に指が動く手順**を必ず 1 つ以上返す
//   ・パソコンが要る手段は「パソコンがある場合」と名乗ってから出す
//   ・分からないことは書かない (直る保証・対応 OS バージョンは名乗らない)
// ============================================================

export type WebmAdviceKind =
  /** iOS/iPadOS で Safari 以外のブラウザ = Safari で開き直せば MP4 になる見込みがある */
  | 'ios-other-browser'
  /** スマホで、ブラウザを替える道が無い (iOS の Safari 本体 / Android) */
  | 'phone'
  /** パソコン */
  | 'desktop';

export interface WebmAdvice {
  kind: WebmAdviceKind;
  /** 何が起きたかの事実だけ。1 行 */
  headline: string;
  /** この端末で実際に実行できる手順。必ず 1 つ以上 */
  steps: string[];
  /** 「このページのリンクをコピー」ボタンを出すか (Safari へ渡すため) */
  showCopyLink: boolean;
  /** パソコンが要る手段 (HandBrake) を出すか */
  showDesktopConverter: boolean;
}

/** WebM のまま何ができるか。どの端末でも同じなので 1 か所に持つ */
export const WEBM_KEEP_NOTE =
  'WebM のままダウンロードはできます。Instagram に上げると弾かれることがあります。';

/** iPhone / iPad か。iPadOS 13 以降は Macintosh を名乗るので、指で触れるかも見る */
export function isIOSLike(ua: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

/** iOS の Safari 本体か (Chrome/Firefox/Edge/Opera の iOS 版は Safari を名乗るので外す) */
export function isIOSSafari(ua: string, maxTouchPoints = 0): boolean {
  if (!isIOSLike(ua, maxTouchPoints)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|Chrome|Chromium|Edg\//.test(ua);
}

/** スマホ・タブレットか */
export function isPhoneLike(ua: string, maxTouchPoints = 0): boolean {
  return isIOSLike(ua, maxTouchPoints) || /Android|Mobile/.test(ua);
}

/**
 * MP4 で書き出せなかった時に出す案内を決める。
 * 「その端末で押せる手順」だけを steps に入れる。
 */
export function webmFallbackAdvice(ua: string, maxTouchPoints = 0): WebmAdvice {
  const headline = 'この端末では MP4 で書き出せず、WebM になりました。';

  if (isIOSLike(ua, maxTouchPoints) && !isIOSSafari(ua, maxTouchPoints)) {
    return {
      kind: 'ios-other-browser',
      headline,
      steps: [
        '下の「リンクをコピー」を押す',
        'Safari を開いて、アドレス欄に貼り付ける',
        '同じ手順でもう一度書き出す（Safari は MP4 で書き出せます）',
      ],
      showCopyLink: true,
      showDesktopConverter: false,
    };
  }

  if (isPhoneLike(ua, maxTouchPoints)) {
    return {
      kind: 'phone',
      headline,
      steps: [
        'WebM のまま保存して、そのまま投稿を試す',
        'MP4 が必要なときは、ブラウザで使える変換サービス（CloudConvert など）にこのファイルを上げる',
      ],
      showCopyLink: false,
      // HandBrake はパソコン専用 = この端末では 1 手も進めないので出さない
      showDesktopConverter: false,
    };
  }

  return {
    kind: 'desktop',
    headline,
    steps: [
      'Safari、または新しい Chrome で同じ手順を行う',
      'HandBrake（パソコン用ソフト）か CloudConvert（ブラウザ）で MP4 に変換する',
    ],
    showCopyLink: false,
    showDesktopConverter: true,
  };
}
