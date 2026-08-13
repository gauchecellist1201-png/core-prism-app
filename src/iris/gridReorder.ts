// ============================================================
// IRIS ▸ 並びの中で予約の順番を入れ替える（Later の「掴んで動かす」の移植）
//
// 思想:
//   並びを見て「これは後だな」と気づいた、その指で直せるようにする。
//   気づいた場所と直す場所が別々（並びプレビュー / 予約リスト）だと、
//   別画面へ移動する間に気づきが消える。
//
// 大事な約束:
//   ・入れ替えるのは「枠（予約時刻）」だけ。画像も本文もハッシュタグも 1 文字も動かさない。
//     ＝よく伸びる時間帯へ自動で割り当てた枠を壊さない。
//   ・動かせるのは「まだ出していない予約」だけ。投稿済みは過去なので動かせない。
//   ・保存先は予約リストそのもの（localStorage の iris_post_queue_v1）。
//     並び用に別のコピーを持たない（2 か所で別々に持つと必ずズレる）。
//   ・書けたかどうかを必ず戻り値で見る。書けていないのに「入れ替えました」と言わない。
// ============================================================

const QUEUE_KEY = 'iris_post_queue_v1';

/** 同じタブの中で予約リストが変わったことを知らせる合図（storage イベントは同じタブでは飛ばない） */
export const QUEUE_CHANGED_EVENT = 'iris:post-queue-changed';

/** 入れ替える前の状態。「元に戻す」はこれをそのまま書き戻す。 */
export interface SlotSnapshot {
  id: string;
  scheduledAt: string;
  status: string;
}

interface QueueLike {
  id?: unknown;
  status?: unknown;
  scheduledAt?: unknown;
  [k: string]: unknown;
}

/** 並びに出る＝まだ出していない予約（時刻待ち / 時刻は来たがまだ出していない）だけ動かせる */
export function isMovableStatus(status: unknown): boolean {
  return status === 'scheduled' || status === 'ready';
}

function timeOf(v: unknown): number {
  if (typeof v !== 'string' || !v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** 予約時刻が未来なら「時刻待ち」、過ぎていれば「出せる」。入れ替えで時刻が動くので付け直す。 */
function statusForTime(at: number, now: number): 'scheduled' | 'ready' {
  return at > now ? 'scheduled' : 'ready';
}

export interface SwapResult<T> {
  next: T[];
  /** 元に戻すための入れ替え前スナップショット（2 件） */
  before: SlotSnapshot[];
}

/**
 * 予約 2 件の「枠（予約時刻）」だけを入れ替えた新しい配列を返す。
 * 入れ替えられない組み合わせ（同じもの・見つからない・投稿済み・時刻が読めない）は null。
 * 元の配列は書き換えない。
 */
export function swapScheduledSlots<T extends QueueLike>(
  list: T[],
  aId: string,
  bId: string,
  now: number = Date.now(),
): SwapResult<T> | null {
  if (!Array.isArray(list) || !aId || !bId || aId === bId) return null;
  const a = list.find((p) => p && p.id === aId);
  const b = list.find((p) => p && p.id === bId);
  if (!a || !b) return null;
  if (!isMovableStatus(a.status) || !isMovableStatus(b.status)) return null;

  const aAt = timeOf(a.scheduledAt);
  const bAt = timeOf(b.scheduledAt);
  // 時刻が読めないものは「いつ並ぶか」を言えない＝入れ替えの意味が決まらないので触らない
  if (!aAt || !bAt) return null;
  if (aAt === bAt) return null; // 同じ時刻なら入れ替えても並びは変わらない（何もしない）

  const before: SlotSnapshot[] = [
    { id: String(a.id), scheduledAt: String(a.scheduledAt), status: String(a.status) },
    { id: String(b.id), scheduledAt: String(b.scheduledAt), status: String(b.status) },
  ];

  const next = list.map((p) => {
    if (!p || typeof p !== 'object') return p;
    if (p.id === aId) return { ...p, scheduledAt: b.scheduledAt, status: statusForTime(bAt, now) };
    if (p.id === bId) return { ...p, scheduledAt: a.scheduledAt, status: statusForTime(aAt, now) };
    return p;
  });

  return { next, before };
}

/** スナップショットを書き戻した配列を返す（「元に戻す」）。対象が消えていた分は黙って飛ばす。 */
export function restoreSlots<T extends QueueLike>(list: T[], before: SlotSnapshot[]): T[] {
  if (!Array.isArray(list) || !Array.isArray(before) || before.length === 0) return list;
  const byId = new Map(before.map((s) => [s.id, s]));
  return list.map((p) => {
    if (!p || typeof p !== 'object') return p;
    const s = byId.get(String(p.id));
    return s ? { ...p, scheduledAt: s.scheduledAt, status: s.status } : p;
  });
}

// ─── 保存（予約リストそのもの） ─────────────────────────

export function readQueue(): QueueLike[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/**
 * 予約リストを保存し、開いている画面すべてに知らせる。
 * 書けたら true。容量不足などで書けなければ false（呼び出し側は成功と言ってはいけない）。
 */
export function writeQueue(list: unknown[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch {
    return false;
  }
  try {
    window.dispatchEvent(new CustomEvent(QUEUE_CHANGED_EVENT));
  } catch { /* 通知できなくても保存は済んでいる */ }
  return true;
}

export type SwapOutcome =
  | { ok: true; before: SlotSnapshot[] }
  | { ok: false; reason: 'not-swappable' | 'save-failed' };

/** 予約リストを読んで 2 件の枠を入れ替え、保存まで行う。 */
export function applySlotSwap(aId: string, bId: string, now: number = Date.now()): SwapOutcome {
  const list = readQueue();
  const res = swapScheduledSlots(list, aId, bId, now);
  if (!res) return { ok: false, reason: 'not-swappable' };
  if (!writeQueue(res.next)) return { ok: false, reason: 'save-failed' };
  return { ok: true, before: res.before };
}

/** 「元に戻す」。書き戻せたら true。 */
export function applySlotRestore(before: SlotSnapshot[]): boolean {
  const list = readQueue();
  return writeQueue(restoreSlots(list, before));
}
