// ============================================================
// CORE Iris ▸ 書き出しが終わった直後の「次に押すもの」を 1 つに決める — 2026-09-04
//
// 何のためにあるか:
//   リールを書き出し終えた画面には、押せるものが 11 個以上並んでいた
//   （ダウンロード / インスタで開く / 字幕コピー / AI 本文 / この本文をコピー /
//     Story 文コピー / 予約に追加 / 予約一覧 / 友達に送る / 別ver. / フックの別案 …）。
//   作り終えて達成感がいちばん高い場所で、全部が同じ大きさで並んでいると
//   「で、どれを押せば終わりなの？」になる＝いちばん惜しい止まり方をする。
//
// 約束:
//   ・ここは計算だけ。DOM も navigator も触らない (呼び出し側が ua を渡す)
//   ・**主アクションは必ず 1 つ**。その端末で本当に前に進むものを選ぶ
//   ・畳んだ中の数を数えて正直に出す（「ほかの操作（N）」の N を盛らない）
//   ・機能は 1 つも消さない。畳むだけ＝1 タップで全部出る
// ============================================================

import { isPhoneLike } from './webmFallback';

export type PrimaryExportAction = 'instagram' | 'download';

export interface ExportActionPlanInput {
  ua: string;
  maxTouchPoints?: number;
  /** 書き出したファイルの MIME。'video/mp4;codecs=...' のような形も来る */
  mime: string;
  /** 予約キュー（「投稿予約に追加」）に繋がっているか */
  hasPostQueue: boolean;
  /** この動画をもう予約に入れたか */
  scheduled: boolean;
  /** 予約画面へ飛べるか（「この枠で予約する」が出る条件） */
  hasSchedule: boolean;
  /** AI が書いた投稿本文カードが出ているか（本文＋ハッシュタグをコピーのボタンを持つ） */
  hasAiCaption: boolean;
  /** 「最初の1行を選ぶ」の候補数 */
  hookOptionCount?: number;
  /** 「別の形でも出す」で作り直せる出し先の数 */
  otherDestinationCount?: number;
}

export interface ExportActionPlan {
  primary: PrimaryExportAction;
  /** 主アクションのボタン文言 */
  primaryLabel: string;
  /** なぜこれが主なのかを 1 行で。憶測は書かない */
  primaryNote: string;
  /** 畳んだ中にある「押せるもの」の数（実際に描くものだけ数える） */
  hiddenCount: number;
  /** 開閉ボタンの文言 */
  moreLabel: string;
  /** 主アクションから外れた側（畳んだ中に置く）の文言 */
  secondaryLabel: string;
}

/** MP4 で書き出せたか。'video/mp4;codecs=avc1' のような形も通す */
export function isMp4(mime: string): boolean {
  return /^video\/mp4\b/.test((mime || '').trim());
}

/**
 * 主アクションを決める。
 *
 * ・MP4 でない（WebM）→ **保存**。Instagram は WebM を弾くことがあるので、
 *   共有シートへ送っても行き止まりになりうる。すぐ下の案内で MP4 への道を出す。
 * ・スマホ・タブレット → **インスタで開く**。リールは Instagram アプリからしか
 *   投稿できないので、この端末で最後まで行ける唯一の道がこれ。
 * ・パソコン → **保存**。パソコンからはリールを投稿できない＝
 *   ファイルをスマホへ渡すところまでが、この端末でできる最後。
 */
export function planExportActions(input: ExportActionPlanInput): ExportActionPlan {
  const {
    ua,
    maxTouchPoints = 0,
    mime,
    hasPostQueue,
    scheduled,
    hasSchedule,
    hasAiCaption,
    hookOptionCount = 0,
    otherDestinationCount = 0,
  } = input;

  const mp4 = isMp4(mime);
  const phone = isPhoneLike(ua, maxTouchPoints);
  const primary: PrimaryExportAction = mp4 && phone ? 'instagram' : 'download';

  const downloadLabel = mp4 ? 'MP4 をダウンロード' : 'WebM をダウンロード';

  // 畳んだ中に実際に描かれる「押せるもの」を数える。
  // 画面の条件分岐と 1 対 1 で並べる＝出ないものは数えない（数を盛らない）。
  const hiddenCount =
    1 /* 主から外れた側（保存 or インスタ） */ +
    1 /* 字幕コピー */ +
    1 /* 投稿の本文を AI に書いてもらう */ +
    1 /* Story 用テキストをコピー */ +
    1 /* 友達にリールを送る */ +
    1 /* 別ver. を書き出す */ +
    (hasSchedule ? 1 : 0) /* この枠で予約する */ +
    (hasPostQueue && !scheduled ? 1 : 0) /* 投稿予約に追加 */ +
    (scheduled && hasSchedule ? 1 : 0) /* 予約一覧をひらく */ +
    (!hasPostQueue && hasSchedule ? 1 : 0) /* 投稿予約をつくる */ +
    (hasAiCaption ? 1 : 0) /* 本文 + ハッシュタグをコピー */ +
    Math.max(0, hookOptionCount) +
    Math.max(0, otherDestinationCount);

  if (primary === 'instagram') {
    return {
      primary,
      primaryLabel: 'インスタで開く',
      primaryNote: 'この 1 つで終わります。動画を渡して、本文はコピー済みにします。',
      hiddenCount,
      moreLabel: `ほかの操作（${hiddenCount}）`,
      secondaryLabel: downloadLabel,
    };
  }

  return {
    primary,
    primaryLabel: downloadLabel,
    primaryNote: phone
      ? 'まず保存します。この形のままだと Instagram に弾かれることがあります。'
      : 'まず保存します。リールはスマホの Instagram アプリからのみ投稿できます。',
    hiddenCount,
    moreLabel: `ほかの操作（${hiddenCount}）`,
    secondaryLabel: 'インスタで開く',
  };
}
