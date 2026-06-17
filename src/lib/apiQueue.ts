// ============================================================
// AI API 共有キュー: 並列制限 + リトライ + Circuit Breaker
// ============================================================

const MAX_CONCURRENT = 4;  // 2→4 (会議文字起こし等のチャンク並列処理を高速化。429 はリトライで吸収)
const MAX_RETRIES = 4;

type Task<T> = () => Promise<T>;
type Pending = { run: () => Promise<void>; };

let active = 0;
const queue: Pending[] = [];

// ─── Circuit Breaker (quota 超過時に 60 秒新規呼び出し停止) ───
let circuitOpenUntil = 0;
let circuitReason = '';

function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

// マスターモード (オーナーが /master で入力した Claude API 経路) なら
// Gemini の quota 由来の Circuit を無視する
function isMasterMode(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('core_master_key_v1') === 'GAUCHE2026';
  } catch {
    return false;
  }
}
function openCircuit(reasonMsg: string, durationMs = 60_000) {
  circuitOpenUntil = Date.now() + durationMs;
  circuitReason = reasonMsg;
}
export function getCircuitStatus(): { open: boolean; remainingSec: number; reason: string } {
  const remaining = Math.max(0, circuitOpenUntil - Date.now());
  return {
    open: remaining > 0,
    remainingSec: Math.ceil(remaining / 1000),
    reason: circuitReason,
  };
}
export function resetCircuit() {
  circuitOpenUntil = 0;
  circuitReason = '';
}

function flush() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    active++;
    item.run().finally(() => {
      active--;
      flush();
    });
  }
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /rate limit|429|concurrent connections|too many requests/i.test(msg);
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /quota|exceeded.*plan|free.*tier.*limit/i.test(msg);
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // quota 超過は永続的 (リトライしても無駄) → 一時エラー扱いから除外
  if (isQuotaError(err)) return false;
  return /5\d\d|timeout|network|fetch failed|overloaded/i.test(msg) || isRateLimitError(err);
}

function backoff(attempt: number, isRateLimit: boolean): number {
  const base = isRateLimit ? 4000 : 800;
  return base * Math.pow(2, attempt) + Math.random() * 500;
}

/**
 * AI API 呼び出しをキュー経由で実行する。
 * - 並列数を制限
 * - 一時エラー時は自動リトライ
 * - quota 超過時は circuit breaker で 60 秒新規拒否
 */
export function enqueueClaudeCall<T>(task: Task<T>): Promise<T> {
  // Circuit が open なら即拒否 (大量エラー連発を防止)
  // ただしマスターモード (Claude API 直叩き) なら Gemini quota とは別経路なので通す
  if (isCircuitOpen() && !isMasterMode()) {
    const remain = Math.ceil((circuitOpenUntil - Date.now()) / 1000);
    return Promise.reject(new Error(
      `AI が一時的に混みあっています。あと ${remain} 秒お待ちください。${circuitReason}`
      + ` ─── すぐに解除したい場合は /master を開いて Claude API キーを入力してください。`
    ));
  }

  return new Promise<T>((resolve, reject) => {
    const run = async () => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await task();
          // AI 呼出し成功 → クレジット消費を記録 (master は credits.ts で無視される)
          try {
            const m = await import('./credits');
            m.consume('brief', 'ai-call');
          } catch { /* credits 未ロード時は無視 */ }
          resolve(result);
          return;
        } catch (err) {
          lastErr = err;

          // quota 超過なら即 circuit を開く + リトライしない
          // ただしマスターモードでの quota は Claude 側の問題なので circuit に登録しない
          if (isQuotaError(err)) {
            if (!isMasterMode()) {
              const errMsg = err instanceof Error ? err.message : String(err);
              openCircuit(errMsg.slice(0, 80), 60_000);
            }
            reject(err);
            return;
          }

          if (attempt === MAX_RETRIES || !isTransientError(err)) {
            reject(err);
            return;
          }
          const wait = backoff(attempt, isRateLimitError(err));
          await new Promise(r => setTimeout(r, wait));
        }
      }
      reject(lastErr);
    };
    queue.push({ run });
    flush();
  });
}

export function getQueueStatus(): { active: number; pending: number } {
  return { active, pending: queue.length };
}
