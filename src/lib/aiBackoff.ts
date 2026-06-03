// ============================================================
// aiBackoff.ts — クライアント側 適応式バックオフ
//
// オーナー指示 (2026-06-04 第 18 波 PPP):
//   /api/ai の 429 受信時、retry-after を尊重しつつ指数バックオフ。
//   UI に「混雑中、N 秒待機」を表示する CustomEvent も発火。
//
// 設計:
//   - 直近の 429 / 503 を覚えておき、次回呼出時に「もう N 秒待ったほうがいい」と返す
//   - 指数バックオフ: 1 → 2 → 4 → 8 → 16 (秒、cap 60)
//   - 成功 / 4xx (非 429) が返ったらカウンタリセット
//   - retry-after ヘッダがあればそれを最低保証で採用
//   - UI イベント: window.dispatchEvent('core:ai-throttle', { detail: { waitSec, reason } })
// ============================================================

const STATE_KEY = 'core_ai_backoff_state_v1';

interface BackoffState {
  attempts: number;       // 連続失敗回数
  retryAtMs: number;      // この時刻まで待つ
  lastReason: '429' | '503' | 'network' | null;
}

function load(): BackoffState {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') return { attempts: 0, retryAtMs: 0, lastReason: null, ...p };
    }
  } catch { /* */ }
  return { attempts: 0, retryAtMs: 0, lastReason: null };
}

function save(s: BackoffState) {
  try { sessionStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* */ }
}

function emit(waitSec: number, reason: string) {
  try {
    window.dispatchEvent(new CustomEvent('core:ai-throttle', { detail: { waitSec, reason } }));
  } catch { /* */ }
}

/** いま AI 呼出を試みる前に「あと N 秒待ったほうがいい」を返す。0 なら今すぐ OK。 */
export function getWaitSec(): number {
  const s = load();
  if (s.retryAtMs <= 0) return 0;
  const left = Math.ceil((s.retryAtMs - Date.now()) / 1000);
  return left > 0 ? left : 0;
}

/** 429 / 503 / network 失敗を記録し、待機時間を計算 + UI に通知 */
export function recordFailure(status: number, retryAfterHeader: string | null): number {
  const s = load();
  const next: BackoffState = { ...s, attempts: s.attempts + 1 };
  next.lastReason = status === 429 ? '429' : status >= 500 ? '503' : 'network';
  // 指数バックオフ (cap 60s)
  const expBase = Math.min(60, Math.pow(2, Math.min(5, next.attempts - 1)));
  // retry-after を優先 (秒数 or HTTP-date)
  let serverHint = 0;
  if (retryAfterHeader) {
    const n = Number(retryAfterHeader);
    if (Number.isFinite(n) && n > 0) {
      serverHint = Math.min(120, n);
    } else {
      const t = Date.parse(retryAfterHeader);
      if (Number.isFinite(t)) serverHint = Math.max(0, Math.ceil((t - Date.now()) / 1000));
    }
  }
  const waitSec = Math.max(expBase, serverHint, 1);
  next.retryAtMs = Date.now() + waitSec * 1000;
  save(next);
  emit(waitSec, next.lastReason || 'unknown');
  return waitSec;
}

/** 成功 / 致命的でないエラー (4xx 非 429) でリセット */
export function recordSuccess() {
  const s = load();
  if (s.attempts === 0 && s.retryAtMs === 0) return;
  save({ attempts: 0, retryAtMs: 0, lastReason: null });
  emit(0, 'cleared');
}

/** 現在の retry-after 残秒を Promise で待つ。0 ならすぐ resolve */
export async function sleepIfNeeded(): Promise<void> {
  const w = getWaitSec();
  if (w <= 0) return;
  await new Promise((r) => setTimeout(r, w * 1000));
}
