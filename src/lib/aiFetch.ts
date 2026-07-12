import { fetchWithTimeout } from './fetchWithTimeout';

// ============================================================
// aiFetch — /api/ai を 40 秒タイムアウト付きで叩く共通ヘルパー。
// 直 fetch('/api/ai', …) は無応答時に永久 hang し、ボタンは押せたまま
// 無限スピナー（＝離脱）になる。40 秒で abort し呼び出し側の catch へ渡す。
// キュー(enqueueClaudeCall)を通らない生成系の最後の砦。
// ============================================================
export function aiFetch(init: RequestInit): Promise<Response> {
  return fetchWithTimeout('/api/ai', init, 40000);
}
