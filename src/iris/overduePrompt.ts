// ============================================================
// CORE Iris ▸ 過ぎた予約の「締めくくり」
// ------------------------------------------------------------
// Iris は自動で Instagram へ送らない (通知投稿方式)。時刻が来ると
// 予約は `ready` になるだけで、実際に出した人も出さなかった人も
// 同じ見た目のまま永久に残る。`markPosted` は在るが押し忘れると
// `ready` が積み上がり、やること (IrisFlowHub) にも出続ける。
//
// そこで「時刻を1日以上過ぎた ready」にだけ、二択で1度だけ訊く。
// ここは計算だけ (DOM も localStorage も触らない) — 表示側と
// テストが同じ条件を見るように、判定の正本をこのファイルに置く。
// ============================================================
import type { ScheduledPost } from './usePostQueue';

/** 訊きはじめるまでの猶予。さっき過ぎたばかりの予約を急かさないため 24 時間。 */
export const OVERDUE_ASK_AFTER_MS = 24 * 60 * 60 * 1000;

/** 文言の正本 (責めない言い方。「出さなかった」ではなく「今回は出さない」)。 */
export const OVERDUE_ASK_TEXT = {
  question: '予定の時刻から1日以上たっています。Instagram に出しましたか？',
  posted: '出しました',
  skip: '今回は出さない',
  skipHint: 'リストの「やること」から外れるだけ。削除はせず、カレンダーには残ります',
} as const;

type OverdueCandidate = Pick<ScheduledPost, 'status' | 'scheduledAt'>;

/**
 * この予約に二択を出すか。
 * ・`ready` (時刻は過ぎたが、まだ出したとも出さないとも言っていない) だけが対象
 * ・予定時刻から 24 時間以上たっていること
 * ・時刻が壊れている予約には出さない (fail closed — 分からないなら訊かない)
 */
export function shouldAskOutcome(p: OverdueCandidate | null | undefined, now: number = Date.now()): boolean {
  if (!p || p.status !== 'ready') return false;
  const at = new Date(p.scheduledAt).getTime();
  if (!Number.isFinite(at)) return false;
  return now - at >= OVERDUE_ASK_AFTER_MS;
}

/** 二択を出している予約の件数 (「1日以上ほったらかしの予約」の実測値)。 */
export function overdueAskCount(posts: readonly OverdueCandidate[] | null | undefined, now: number = Date.now()): number {
  if (!posts?.length) return 0;
  return posts.reduce((n, p) => n + (shouldAskOutcome(p, now) ? 1 : 0), 0);
}
