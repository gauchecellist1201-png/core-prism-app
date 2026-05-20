// ============================================================
// storage — ブラウザ内保存 (localStorage) の共通ラッパー
// 容量超過 (QuotaExceededError) を捕まえて画面内トーストで通知する
// ============================================================
import { notifyInApp } from './inAppNotify';

let lastQuotaNotifyAt = 0;
const QUOTA_NOTIFY_COOLDOWN_MS = 60 * 1000;

function isQuotaError(e: unknown): boolean {
  if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
    // Safari は 22 / QuotaExceededError、Firefox は 1014 / NS_ERROR_DOM_QUOTA_REACHED
    return (
      e.code === 22 ||
      e.code === 1014 ||
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
  }
  return false;
}

export interface SafeSetOptions {
  /** トーストに出す機能名 (例: "経費", "ナレッジ") */
  module?: string;
  /** trueなら静かに失敗する（既存挙動互換）。既定 false=通知する */
  silent?: boolean;
}

/** localStorage.setItem の安全版。容量超過で画面内トーストを出して false を返す */
export function safeSetItem(key: string, value: string, opts: SafeSetOptions = {}): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (isQuotaError(e)) {
      const now = Date.now();
      if (!opts.silent && now - lastQuotaNotifyAt > QUOTA_NOTIFY_COOLDOWN_MS) {
        lastQuotaNotifyAt = now;
        notifyInApp({
          kind: 'warn',
          title: '保存容量がいっぱいです',
          body: `${opts.module ? opts.module + 'の' : ''}古いデータを整理してから、もう一度保存してください。`,
          duration: 7000,
        });
      }
    }
    return false;
  }
}

/** JSON.stringify を内包した便利版 */
export function safeSetJSON(key: string, value: unknown, opts: SafeSetOptions = {}): boolean {
  return safeSetItem(key, JSON.stringify(value), opts);
}
