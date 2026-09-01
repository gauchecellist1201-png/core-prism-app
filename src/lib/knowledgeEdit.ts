// ナレッジの「その場で直す」— 見出し・本文を、別画面へ飛ばさずに書き換える。
//
// ここは純粋な関数だけ置く（React も IndexedDB も触らない）ので、
// 「直したのに保存されない」「直したら中身が消えた」を実物のテストで固定できる。
//
// 守っていること:
//   ・見出しが空になる書き換えは通さない（一覧で何なのか分からなくなる）
//   ・本文を書き換えたら chunks とタグも必ず作り直す
//     （chunks が古いままだと、AI は「直す前の文章」を根拠に答え続ける＝いちばん質の悪い嘘）
//   ・要約 (analysis) は消さずに **古い印 (analysisStale) を立てるだけ**
//     （消すと「読み込み直す」までの間、手がかりがゼロになる）
//   ・画像 base64・取込バッチ ID・作成日時など、触っていないものは1つも落とさない
import { v4 as uuidv4 } from 'uuid';
import type { KnowledgeItem, KnowledgeChunk } from '../types/identity';

const CHUNK_SIZE = 400; // characters per chunk

/** 全文テキストを RAG 用チャンクに割る（取り込み時と「その場で直す」で同じ物を使う） */
export function chunkText(text: string): KnowledgeChunk[] {
  const sentences = text.split(/(?<=[。！？\n])\s*/);
  const chunks: KnowledgeChunk[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > CHUNK_SIZE && current.length > 0) {
      chunks.push({ id: uuidv4(), content: current.trim() });
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) {
    chunks.push({ id: uuidv4(), content: current.trim() });
  }
  return chunks;
}

/** 本文からタグをローカル推定（AI を呼ばない＝無料・即時） */
export function inferTags(text: string): string[] {
  const patterns: [RegExp, string][] = [
    [/医療|歯科|患者|診断|治療|薬|手術/i, '医療'],
    [/不動産|物件|賃料|テナント|投資|収益|利回り/i, '不動産'],
    [/音楽|楽譜|演奏|チェロ|バイオリン|ピアノ|楽器/i, '音楽'],
    [/売上|収支|財務|キャッシュフロー|利益|コスト/i, '財務'],
    [/会議|ミーティング|議事録|アジェンダ/i, '会議'],
    [/contract|契約|法律|条項|合意/i, '法務'],
    [/AI|機械学習|データ|プログラム|コード/i, 'テクノロジー'],
    [/スケジュール|予定|カレンダー|日程/i, '予定'],
  ];
  return patterns
    .filter(([re]) => re.test(text))
    .map(([, tag]) => tag)
    .slice(0, 4);
}

export interface KnowledgeEditPatch {
  title: string;
  /** 省略した時は本文に一切触らない（取り込んだ資料は見出しだけ直せる） */
  content?: string;
}

export type KnowledgeEditResult =
  | { ok: true; item: KnowledgeItem; changed: boolean }
  | { ok: false; reason: string };

/** 本文をここで直せるのは、自分で書いたもの（メモ／音声メモ／取り込んだ URL 要約）だけ */
export function canEditBody(item: KnowledgeItem): boolean {
  return item.sourceType === 'note' || item.sourceType === 'url' || item.sourceType === 'auto';
}

/**
 * 見出し・本文の書き換えを 1 件に適用した「新しい item」を返す（元の item は書き換えない）。
 * 何も変わらない時は changed:false を返すので、呼ぶ側は保存を起こさなくてよい。
 */
export function applyKnowledgeEdit(
  item: KnowledgeItem,
  patch: KnowledgeEditPatch,
  now: string = new Date().toISOString(),
): KnowledgeEditResult {
  const title = patch.title.trim();
  if (!title) {
    return { ok: false, reason: '見出しが空です。1文字以上にしてください。' };
  }

  const bodyGiven = patch.content !== undefined;
  if (bodyGiven && !canEditBody(item)) {
    // 取り込んだ資料の本文は、元ファイルから機械で取り出した文字＝ここで書き換える口は作らない
    return { ok: false, reason: '取り込んだ資料の本文は、ここでは直せません（見出しだけ直せます）。' };
  }

  const nextContent = bodyGiven ? patch.content!.trim() : item.content;
  if (bodyGiven && !nextContent) {
    return { ok: false, reason: '本文が空です。消したい時は「削除」を使ってください。' };
  }

  const titleChanged = title !== item.title;
  const contentChanged = bodyGiven && nextContent !== item.content;
  if (!titleChanged && !contentChanged) {
    return { ok: true, item, changed: false };
  }

  const next: KnowledgeItem = { ...item, title, updatedAt: now };
  if (contentChanged) {
    next.content = nextContent;
    next.chunks = chunkText(nextContent);
    next.tags = inferTags(nextContent);
    // 要約は「直す前の文章」から作ったもの。消さずに古い印だけ立てる。
    if (item.analysis) next.analysisStale = true;
  }
  return { ok: true, item: next, changed: true };
}
