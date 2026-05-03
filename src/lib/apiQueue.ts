// ============================================================
// Claude API 共有キュー: 並列接続数を絞ってレート制限を回避
// ============================================================

const MAX_CONCURRENT = 2;
const MAX_RETRIES = 4;

type Task<T> = () => Promise<T>;
type Pending = { run: () => Promise<void>; };

let active = 0;
const queue: Pending[] = [];

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

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /5\d\d|timeout|network|fetch failed|overloaded/i.test(msg) || isRateLimitError(err);
}

function backoff(attempt: number, isRateLimit: boolean): number {
  // レート制限なら長めに待つ。それ以外は短め。
  const base = isRateLimit ? 4000 : 800;
  return base * Math.pow(2, attempt) + Math.random() * 500;
}

/**
 * Claude API 呼び出しをキュー経由で実行する。
 * 並列数を制限し、レート制限/一時エラー時は自動リトライする。
 */
export function enqueueClaudeCall<T>(task: Task<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = async () => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await task();
          resolve(result);
          return;
        } catch (err) {
          lastErr = err;
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
