// ============================================================
// inlineCommandResult — コマンドバーの「答えの札」に出す中身を組み立てる
//
// なぜ要るか (2026-08-14):
//   コマンドバーで何かを選ぶと、これまでは必ず `onClose()` が走って
//   見ていた画面ごと別の場所へ連れて行かれた。答えが 1 つ返るだけの用事
//   (資料を1件読む・変更の記録を1件読む・提案の採用を切り替える) でも
//   同じだったので、ひとこと調べるたびに作業中の画面を失う。
//   = 訊くこと自体をためらう、という一番もったいない壊れ方だった。
//
//   ここは「画面を移らずに返せる答え」の形だけを決める。DOM も React も触らない
//   ので、切り出した本文・切ったかどうか・空っぽの時の言い分をそのまま試験できる。
//
// 嘘を出さないための決め: 本文は実データをそのまま渡すだけで、要約も補完もしない。
//   長すぎて切った時は必ず `truncated` を立てて画面に言わせる (黙って切らない)。
//   読める文字が 1 つも無い時は、無いという事実を返す (それらしい文を作らない)。
// ============================================================

export type InlineCommandResult = {
  /** 札の身元。同じ物を選び直した時に作り直しても差分が出ないようにする鍵 */
  id: string;
  /** 何の答えか (1 行) */
  title: string;
  /** 種類・日付など、本文ではない添え書き */
  meta?: string;
  /** 実データの本文。無い時は undefined (「本文なし」という文を作らない) */
  body?: string;
  /** 本文を途中で切った時だけ true */
  truncated?: boolean;
  /** コピーできる全文 (切る前)。無ければコピーボタンを出さない */
  copyText?: string;
  /**
   * 本文を出せない / 出せても言い足りない時の、事実だけの一行。
   * (読める文字が入っていない・保存できなかった・結果はここでは分からない など)
   * それらしい文で埋める代わりに、分からないことを分からないと書くための欄。
   */
  emptyReason?: string;
  /** 札の右下に小さく 1 つだけ置く「この画面を開く」 */
  open?: { label: string; run: () => void };
};

/** 札に出す本文の上限。これを超えたら切って、切ったことを言う。 */
export const INLINE_BODY_MAX = 1200;

/**
 * 本文を札に収まる長さへ切る。
 * - 前後の空白は落とすが、途中の改行はそのまま残す (箇条書きが 1 行に潰れると読めない)
 * - 上限以内なら 1 文字も触らない = 切っていない時に `truncated` を立てない
 */
export function previewBody(raw: string | undefined | null, max = INLINE_BODY_MAX): {
  body?: string;
  truncated: boolean;
} {
  const text = (raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return { truncated: false };
  if (text.length <= max) return { body: text, truncated: false };
  return { body: text.slice(0, max), truncated: true };
}

const FILE_KIND_LABEL: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  xlsx: 'Excel',
  pptx: 'PowerPoint',
  csv: '表 (CSV)',
  text: 'テキスト',
  image: '画像',
  unknown: '資料',
};

/** 取り込んだ日を「8月14日」の形にする。読めない値は黙って落とす (Invalid Date を出さない) */
export function formatTakenInDate(createdAt: string | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
}

export type KnowledgeLike = {
  id: string;
  title: string;
  content?: string;
  fileKind?: string;
  tags?: string[];
  createdAt?: string;
};

/**
 * ナレッジ 1 件を、画面を移らずに読める札にする。
 * 画像だけの資料など、読み取れる文字が無い時は「無い」と言い切る
 * (中身があるように見せない = ここで嘘をつくと、探し直す時間だけを奪う)。
 */
export function buildKnowledgeResult(
  k: KnowledgeLike,
  open?: { label: string; run: () => void },
  max = INLINE_BODY_MAX,
): InlineCommandResult {
  const { body, truncated } = previewBody(k.content, max);
  const bits: string[] = [];
  const kindLabel = k.fileKind ? FILE_KIND_LABEL[k.fileKind] : undefined;
  if (kindLabel) bits.push(kindLabel);
  const day = formatTakenInDate(k.createdAt);
  if (day) bits.push(`${day} に取り込み`);
  const tags = (k.tags ?? []).filter(Boolean).slice(0, 3);
  if (tags.length > 0) bits.push(tags.join(' · '));

  return {
    id: `knowledge:${k.id}`,
    title: k.title,
    meta: bits.length > 0 ? bits.join(' · ') : undefined,
    body,
    truncated,
    copyText: body ? (k.content ?? '').replace(/\r\n/g, '\n').trim() : undefined,
    emptyReason: body
      ? undefined
      : k.fileKind === 'image'
        ? 'この資料は画像です。読み取れる文字は入っていません。'
        : 'この資料には、まだ読み取れる文字が入っていません。',
    open,
  };
}

// ────────────────────────────────────────────────────────────
// 提案の「採用 ⇄ 未判定」を、画面を移らずに切り替えた時の札
//
// なぜ書いた後の値を渡させるか (2026-08-19):
//   保存側 (`aiSuggestionLog.setStatus`) は **失敗しても何も言わずに帰る**。
//   ①その id が履歴に無ければ黙って return し ②入れ物がいっぱいなら
//   `QuotaExceededError` を握りつぶす。どちらも例外を投げないので、
//   「try/catch が通った＝保存できた」と数えると、1 文字も書けていないのに
//   画面だけが「採用に変えました」と言う。押した人はもう一度押す理由を失う。
//   だから **書いた後にもう一度読んだ実測値** (`after`) だけを根拠にする。
// ────────────────────────────────────────────────────────────

export type SuggestionLike = {
  id: string;
  title: string;
  detail?: string;
  cxoName?: string;
};

const SUGGESTION_STATUS_LABEL: Record<string, string> = {
  adopted: '採用',
  pending: '未判定',
  rejected: '却下',
  held: '保留',
};

/** 押した時点の状態から、次に入れたい状態を決める (採用 ⇄ 未判定 の 2 つだけを行き来する) */
export function nextSuggestionStatus(current: string | undefined): 'adopted' | 'pending' {
  return current === 'adopted' ? 'pending' : 'adopted';
}

/**
 * 提案 1 件の札。`after` は **保存を試みた後に読み直した実際の値**。
 * `after === wanted` の時だけ「変えました」と言い、そうでなければ変わらなかった事実を書く。
 */
export function buildSuggestionResult(args: {
  suggestion: SuggestionLike;
  wanted: 'adopted' | 'pending';
  /** 書いた後に読み直した状態。読めなかった (履歴から消えている) 時は undefined */
  after: string | undefined;
  open?: { label: string; run: () => void };
  max?: number;
}): InlineCommandResult {
  const { suggestion: s, wanted, after, open, max = INLINE_BODY_MAX } = args;
  const saved = after === wanted;
  const { body, truncated } = previewBody(s.detail, max);
  const who = s.cxoName ? `${s.cxoName} の提案` : '提案';

  return {
    id: `suggestion:${s.id}`,
    title: s.title,
    meta: saved
      ? `${who} · 「${SUGGESTION_STATUS_LABEL[wanted]}」に変えました`
      : `${who} · 「${SUGGESTION_STATUS_LABEL[wanted]}」に変えられませんでした`,
    body,
    truncated,
    copyText: body ? (s.detail ?? '').replace(/\r\n/g, '\n').trim() : undefined,
    emptyReason: saved
      ? undefined
      : after === undefined
        ? 'この提案は履歴に残っていないため、状態を変えられません。AI 提案の履歴で確かめてください。'
        : `いまは「${SUGGESTION_STATUS_LABEL[after] ?? after}」のままです。この端末に保存できませんでした。`,
    open,
  };
}
