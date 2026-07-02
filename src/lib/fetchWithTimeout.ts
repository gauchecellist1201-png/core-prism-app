// ============================================================
// fetchWithTimeout — 弱い電波で応答が返らず固まる（ボタンが押せたまま無限スピナー）を防ぐ。
// 一定時間で abort し、呼び出し側の catch に渡して「もう一度」へ落とせるようにする。
// AbortError は isAbort() で判定し、利用側はやさしい文言に置き換えられる。
// ============================================================
export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = 20000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => { try { ctrl.abort(); } catch { /* noop */ } }, ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** タイムアウト（abort）由来のエラーか。やさしい文言の出し分けに使う。 */
export function isAbort(err: unknown): boolean {
  return err instanceof DOMException ? err.name === 'AbortError' : (err as { name?: string })?.name === 'AbortError';
}
