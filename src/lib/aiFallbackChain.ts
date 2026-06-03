// ============================================================
// aiFallbackChain.ts — Claude / Gemini 階段式 fallback
//
// オーナー指示 (2026-06-03 第 12 波 XX):
//   /api/ai が rate limit / timeout したら自動的に上位 → 下位モデルへ
//   階段式リトライ。1 発失敗で諦めるケースを撲滅。
//
// チェーン:
//   1. 要求モデル (例: claude-haiku-4-5)
//   2. claude-sonnet-4-5  (Haiku が rate limit したら Sonnet も含めて再試行)
//   3. gemini-2.5-flash   (Anthropic 系全滅時の最終 fallback)
//
// 再試行条件:
//   - HTTP 429 (rate limit)
//   - HTTP 5xx
//   - network error (fetch throw)
//   - timeout (AbortController で 30s)
//
// 4xx (400/401/403) は即時諦め (リクエスト構造が悪い等のため再試行しても無駄)
// ============================================================

// 失敗ログは console.warn にフォールバック (errorCapture が console を hook している)
import { recordFailure, recordSuccess, sleepIfNeeded } from './aiBackoff';

export interface AiPayload {
  model: string;
  max_tokens?: number;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AiResponse {
  content?: Array<{ text?: string; type?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
  /** 実際にどのモデルで応答が返ったか (フォールバックのトレース) */
  resolvedModel?: string;
  /** どのステップで成功したか (0=最初, 1=2 段目, 2=最終) */
  fallbackStep?: number;
}

export interface FallbackOptions {
  timeoutMs?: number;
  /** AbortSignal を渡せばユーザー操作 (例: 「中断」ボタン) で停止できる */
  signal?: AbortSignal;
  /** 各ステップの試行を観測したい場合のコールバック (UI に「Sonnet にリトライ中…」と出す等) */
  onStep?: (step: number, model: string, reason?: string) => void;
  /** カスタムチェーン (テスト用 / 上位プラン用)。未指定なら既定チェーン */
  chain?: string[];
}

const DEFAULT_CHAIN_SUFFIX = ['claude-sonnet-4-5', 'gemini-2.5-flash'];
const DEFAULT_TIMEOUT_MS = 30_000;

function resolveChain(requestedModel: string, custom?: string[]): string[] {
  if (custom && custom.length > 0) return Array.from(new Set(custom));
  const chain = [requestedModel, ...DEFAULT_CHAIN_SUFFIX];
  // 重複削除 (要求モデルが既に Sonnet / Gemini ならそれ以降だけ残す)
  return Array.from(new Set(chain));
}

function isRetryableHttp(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599) || status === 408;
}

class TimeoutError extends Error {
  constructor() { super('AI request timed out'); this.name = 'TimeoutError'; }
}

async function callOnce(
  payload: AiPayload,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<{ ok: true; data: AiResponse } | { ok: false; status: number; retryable: boolean; error: string; retryAfterHeader: string | null }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new TimeoutError()), timeoutMs);
  const onAbort = () => ac.abort(externalSignal?.reason);
  if (externalSignal) externalSignal.addEventListener('abort', onAbort, { once: true });

  try {
    // PPP (2026-06-04): 直近 429/503 で待機時間が残っていれば待つ
    await sleepIfNeeded();
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      let msg = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(txt);
        msg = j?.error?.message || j?.message || msg;
      } catch { /* */ }
      const retryAfter = res.headers.get('retry-after');
      return { ok: false, status: res.status, retryable: isRetryableHttp(res.status), error: msg, retryAfterHeader: retryAfter };
    }
    const data = (await res.json()) as AiResponse;
    return { ok: true, data };
  } catch (e) {
    const isAbort = (e as Error)?.name === 'AbortError' || e instanceof TimeoutError;
    return {
      ok: false,
      status: isAbort ? 408 : 0,
      retryable: isAbort || true, // ネットワークエラーは retry 価値あり
      error: isAbort ? 'request_timed_out_or_aborted' : ((e as Error)?.message || 'network_error'),
      retryAfterHeader: null,
    };
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
  }
}

/**
 * Anthropic 互換 /api/ai を 階段式 fallback 付きで呼び出す。
 * 全段失敗した場合は最後のエラーを throw する。
 */
export async function callAiWithFallback(
  basePayload: AiPayload,
  opts: FallbackOptions = {},
): Promise<AiResponse> {
  const chain = resolveChain(basePayload.model, opts.chain);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: { status: number; error: string; model: string } = { status: 0, error: 'no_attempt', model: '' };

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    opts.onStep?.(i, model, i === 0 ? undefined : `previous failed: ${lastError.error}`);
    const r = await callOnce({ ...basePayload, model }, timeoutMs, opts.signal);
    if (r.ok) {
      // PPP (2026-06-04): 成功でバックオフ状態をリセット
      recordSuccess();
      return { ...r.data, resolvedModel: r.data.model || model, fallbackStep: i };
    }
    lastError = { status: r.status, error: r.error, model };
    // PPP (2026-06-04): 429 / 503 / 408 / network はバックオフ記録 + UI 通知
    if (r.status === 429 || r.status === 503 || r.status === 408 || r.status === 0) {
      recordFailure(r.status, r.retryAfterHeader);
    }
    // 4xx (retryable=false) は即時離脱しない: 次のモデルでは構造的問題が回避されることもある (例: model not found)
    // ただし 401/403 は env/auth の話なので全段ダメ。離脱。
    if (r.status === 401 || r.status === 403) break;
    // ユーザーが中断したら離脱
    if (opts.signal?.aborted) break;
    // 通信失敗 / 429 / 5xx / 400 は次のモデルへ進む (chain 全段試す)
    try {
      // eslint-disable-next-line no-console
      console.warn(`[ai-fallback] step=${i} model=${model} status=${r.status} → next`, r.error);
    } catch { /* */ }
  }

  const err = new Error(`AI 全 ${chain.length} モデル失敗: ${lastError.error} (最終モデル: ${lastError.model})`);
  (err as { status?: number }).status = lastError.status;
  throw err;
}
