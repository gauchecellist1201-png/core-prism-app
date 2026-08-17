import type { KnowledgeItem } from '../types/identity';
import { selectRelevantKnowledge } from '../hooks/useClaude';

// 開いている資料の「隣」に、関係のあるものを勝手に置くための選び方。
//
// 設計の約束（BACKLOG「いま見ているものの隣に、関係あるものを勝手に出す」）:
//   ・新しい道具を作らない。既存の selectRelevantKnowledge に
//     「開いている資料そのもの」を問い合わせ文として渡すだけ。
//   ・AI を呼ばない。だから待ち時間 0ms・追加料金 0 円・電波が悪くても出る。
//   ・0 件のときは枠ごと出さない（空の器を作らない）。
//   ・黙って切らない。入りきらなかったぶんは「ほかに◯件」と正直に出す。
//   ・3 枠のうち 1 枠だけ「古い方」に予約する。新しい順に 3 件並べると
//     必ず直近が並んで、機械にしか出せない価値（忘れた頃のもの）が消えるため。

/** 「古い方」の枠に入れてよい最小の日数。これより新しいものは自分で思い出せる */
export const OLD_SLOT_MIN_DAYS = 90;

/** 問い合わせ文に混ぜる本文の長さ。全文を渡すと、ありふれた言葉だけで何にでも当たる */
const BODY_HEAD_CHARS = 300;

export interface RelatedKnowledgeResult {
  /** 隣に出すもの（最大 limit 件）。0 件なら枠ごと出さない */
  items: KnowledgeItem[];
  /** 同じ言葉を含むのに枠へ入りきらなかった件数。黙って切らないための数 */
  moreCount: number;
  /** 「古い方」の枠で入れたものの id。無ければ null */
  oldSlotId: string | null;
}

/**
 * 開いている資料そのものを問い合わせ文にする。
 * 見出し・タグ・要約・重要ポイントに、本文の頭だけを足す。
 */
export function queryFromItem(item: KnowledgeItem): string {
  return [
    item.title,
    item.tags.join(' '),
    item.analysis?.summary ?? '',
    item.analysis?.insights?.join(' ') ?? '',
    (item.content ?? '').slice(0, BODY_HEAD_CHARS),
  ].filter(Boolean).join(' ').trim();
}

/** createdAt から今日までの日数。日付として読めないものは 0（＝古い枠に入れない） */
export function ageInDays(createdAt: string, now: Date): number {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return 0;
  const diff = now.getTime() - t;
  if (diff <= 0) return 0;
  return Math.floor(diff / 86_400_000);
}

/**
 * 「2026-02-14」ではなく「半年前のあなた」と書く。
 * 数字より、時間が経った感じの方が効く。
 * OLD_SLOT_MIN_DAYS 未満なら null（＝古さを名乗らせない）。
 */
export function agoLabel(createdAt: string, now: Date): string | null {
  const days = ageInDays(createdAt, now);
  if (days < OLD_SLOT_MIN_DAYS) return null;
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return `${years}年前のあなた`;
  }
  const months = Math.round(days / 30);
  if (months === 6) return '半年前のあなた';
  return `${months}か月前のあなた`;
}

/**
 * 開いている資料の隣に出すものを選ぶ。AI は呼ばない（同期・即時）。
 *
 * @param current 開いている資料
 * @param all いま一覧に並んでいる資料すべて（current を含んでいてよい）
 * @param now 「古い方」の判定に使う今日
 * @param limit 隣に出す枠の数
 */
export function relatedKnowledge(
  current: KnowledgeItem,
  all: KnowledgeItem[],
  now: Date = new Date(),
  limit = 3,
): RelatedKnowledgeResult {
  const empty: RelatedKnowledgeResult = { items: [], moreCount: 0, oldSlotId: null };
  if (limit <= 0) return empty;

  const query = queryFromItem(current);
  // 見出しも本文も無いものは、何とでも当たってしまう。出さない方が正しい。
  if (query.length < 2) return empty;

  const candidates = all.filter(i => i.id !== current.id && i.personaId === current.personaId);
  if (candidates.length === 0) return empty;

  // selectRelevantKnowledge は score>0 のものだけを、高い順に返す。
  // ここでは全件ぶん受け取って、切るのは自分の枠の都合として明示的に行う。
  const ranked = selectRelevantKnowledge(query, candidates, candidates.length);
  if (ranked.length === 0) return empty;

  const picked = ranked.slice(0, limit);
  let oldSlotId: string | null = picked.find(i => ageInDays(i.createdAt, now) >= OLD_SLOT_MIN_DAYS)?.id ?? null;

  // まだ「古い方」が 1 件も入っていないときだけ、最後の 1 枠を譲る。
  // 該当が無ければ普通に上位を並べる（枠を空けない・「古いものはありません」も出さない）。
  if (oldSlotId === null && picked.length > 0) {
    const oldest = ranked.find(i => ageInDays(i.createdAt, now) >= OLD_SLOT_MIN_DAYS);
    if (oldest) {
      picked[picked.length - 1] = oldest;
      oldSlotId = oldest.id;
    }
  }

  return {
    items: picked,
    moreCount: Math.max(0, ranked.length - picked.length),
    oldSlotId,
  };
}
