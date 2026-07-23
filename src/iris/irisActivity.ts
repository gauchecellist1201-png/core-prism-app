// ============================================================
// IRIS ▸ Activity Log (honest value receipt の土台)
//
// 役割:
//   Iris が「実際にユーザーのために生成・実行したこと」だけを記録する。
//   ここに記録されるのは “本当に成功したとき” のみ — 推定や水増しは一切しない
//   (honest-numbers ルール)。これを集計して「今週、Iris があなたのために
//   動いた量」を可視化し、価値を毎週“体感”させる → 解約を減らし課金を増やす。
//
//   記録ポイント (すべて成功した瞬間に 1 回だけ呼ぶ):
//     - script   : リール台本 / 本格台本を生成した
//     - caption  : Instagram キャプションを生成した
//     - ideas    : 企画(投稿アイデア)プールを生成した
//     - mediakit : メディアキットを書き出した
//     - dm       : 営業 DM 下書きを生成した
//
//   マルチアカウント切替で数字が混ざらないよう、アクティブアカウント単位で
//   scope する。容量は直近 MAX 件で打ち切り (古いものから捨てる)。
// ============================================================

import { getActiveAccount } from './multiAccount';

export type IrisActivityType = 'script' | 'caption' | 'ideas' | 'mediakit' | 'dm';

interface ActivityEntry {
  t: IrisActivityType;
  ts: number; // epoch ms
}

const KEY_BASE = 'core_iris_activity_v1';
const MAX = 400;

/** アクティブアカウント単位でキーを scope する (混ざり防止)。 */
function activityKey(): string {
  let acct = 'default';
  try { acct = getActiveAccount()?.id || 'default'; } catch { /* */ }
  return `${KEY_BASE}:${acct}`;
}

function load(): ActivityEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(activityKey());
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/**
 * Iris が実際に成果物を出した瞬間に 1 回だけ呼ぶ。
 * 失敗時 (try/catch のエラー側) では絶対に呼ばないこと — 数字が嘘になる。
 */
export function logIrisActivity(t: IrisActivityType): void {
  if (typeof window === 'undefined') return;
  try {
    const arr = load();
    arr.unshift({ t, ts: Date.now() });
    localStorage.setItem(activityKey(), JSON.stringify(arr.slice(0, MAX)));
    // 同一タブ内の受信側 (値レシート) に即時反映させる
    window.dispatchEvent(new CustomEvent('iris-activity'));
  } catch { /* quota 超過などは黙って無視 (記録は補助機能) */ }
}

export interface ActivitySummary {
  /** 集計対象期間 (日) */
  days: number;
  /** 期間内の総件数 */
  total: number;
  /** 種別ごとの件数 */
  byType: Record<IrisActivityType, number>;
  /** 全期間で 1 件でも記録があるか (初回オンボーディング判定用) */
  hasAny: boolean;
}

/** 直近 days 日間の活動を集計する。water-mark なし・記録された実数のみ。 */
export function getActivitySummary(days = 7): ActivitySummary {
  const all = load();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const byType: Record<IrisActivityType, number> = {
    script: 0, caption: 0, ideas: 0, mediakit: 0, dm: 0,
  };
  let total = 0;
  for (const e of all) {
    if (!e || typeof e.ts !== 'number') continue;
    if (e.ts < since) continue;
    if (byType[e.t] === undefined) continue;
    byType[e.t]++;
    total++;
  }
  return { days, total, byType, hasAny: all.length > 0 };
}

export interface LifetimeSummary {
  /** 記録されている全期間の総件数 (直近 MAX 件までが対象) */
  total: number;
  /** 種別ごとの件数 */
  byType: Record<IrisActivityType, number>;
  /** 記録されている中で最も古いイベントの epoch ms (無ければ 0) */
  earliestTs: number;
}

/**
 * 記録されている“これまで”の活動を全部集計する (日付フィルタなし)。
 * 注意: ストアは直近 MAX 件で打ち切られるため、厳密には「記録が残っている
 * 範囲での累計」。誇張はしない (honest-numbers)。UI では「これまで」と表現し、
 * 特定の開始日は断言しない。
 */
export function getLifetimeSummary(): LifetimeSummary {
  const all = load();
  const byType: Record<IrisActivityType, number> = {
    script: 0, caption: 0, ideas: 0, mediakit: 0, dm: 0,
  };
  let total = 0;
  let earliestTs = 0;
  for (const e of all) {
    if (!e || typeof e.ts !== 'number') continue;
    if (byType[e.t] === undefined) continue;
    byType[e.t]++;
    total++;
    if (earliestTs === 0 || e.ts < earliestTs) earliestTs = e.ts;
  }
  return { total, byType, earliestTs };
}
