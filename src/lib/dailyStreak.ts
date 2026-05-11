// ============================================================
// dailyStreak — 「今日も Iris 開いた! N 日連続」リテンション計測
// ============================================================
// localStorage に最終起動日と現在の連続日数を保存。
// touch() を呼ぶたびに 1) 同日なら何もしない 2) 翌日なら streak+1
// 3) 2 日以上空いていたら streak=1 にリセット。
// ============================================================

const KEY = 'core_daily_streak_v1';

interface StreakState {
  /** 直近に touch した日付 (YYYY-MM-DD, ローカル) */
  lastDate: string;
  /** 連続継続日数 */
  streak: number;
  /** 過去最高 */
  best: number;
  /** 初回起動日 */
  firstDate: string;
  /** 再エンゲージメール送信済みフラグ (YYYY-MM-DD ごと) */
  reengagedOn?: string;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((db - da) / 86400000);
}

function load(): StreakState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.lastDate !== 'string' || typeof p?.streak !== 'number') return null;
    return p as StreakState;
  } catch {
    return null;
  }
}

function save(s: StreakState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ }
}

export interface TouchResult {
  streak: number;
  best: number;
  /** true: 今日はじめての起動 (streak が更新された) */
  freshOpen: boolean;
  /** 1 日以上空いて戻ってきたか (再エンゲージメールの対象) */
  returnedAfterAbsence: boolean;
  /** 直前の起動からの空白日数 (0 = 同日, 1 = 昨日も開いた) */
  gapDays: number;
}

/** 起動時に呼ぶ。連続日数を更新して結果を返す。 */
export function touchStreak(): TouchResult {
  const today = todayLocal();
  const prev = load();

  if (!prev) {
    const next: StreakState = { lastDate: today, streak: 1, best: 1, firstDate: today };
    save(next);
    return { streak: 1, best: 1, freshOpen: true, returnedAfterAbsence: false, gapDays: 0 };
  }

  const gap = daysBetween(prev.lastDate, today);

  if (gap === 0) {
    return { streak: prev.streak, best: prev.best, freshOpen: false, returnedAfterAbsence: false, gapDays: 0 };
  }

  let streak: number;
  if (gap === 1) {
    streak = prev.streak + 1;
  } else {
    // 2 日以上空いた → リセット
    streak = 1;
  }
  const best = Math.max(prev.best ?? 0, streak);
  const next: StreakState = { ...prev, lastDate: today, streak, best };
  save(next);
  return {
    streak,
    best,
    freshOpen: true,
    returnedAfterAbsence: gap >= 2,
    gapDays: gap,
  };
}

export function getStreak(): { streak: number; best: number; lastDate: string | null } {
  const s = load();
  if (!s) return { streak: 0, best: 0, lastDate: null };
  return { streak: s.streak, best: s.best ?? s.streak, lastDate: s.lastDate };
}

export function markReengagedToday(): void {
  const s = load();
  if (!s) return;
  save({ ...s, reengagedOn: todayLocal() });
}

export function shouldSendReengagement(gapDays: number): boolean {
  if (gapDays < 1) return false;
  const s = load();
  if (!s) return false;
  // 同じ日に複数回送らない
  if (s.reengagedOn === todayLocal()) return false;
  return true;
}
