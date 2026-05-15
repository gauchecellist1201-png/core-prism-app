// ============================================================
// inAppNotify — 画面右下トーストを発火する小さなヘルパー
// メール送信が全部だめだった時の最後のフォールバック先
// InAppNotificationToast がイベントを受け取り、5 秒だけ表示
// ============================================================

export type NotifyKind = 'success' | 'info' | 'warn';

export interface NotifyDetail {
  kind: NotifyKind;
  title: string;
  body?: string;
  /** ミリ秒。既定 5000 */
  duration?: number;
}

const EVENT_NAME = 'core:notify';

export function notifyInApp(detail: NotifyDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<NotifyDetail>(EVENT_NAME, { detail }));
}

export const NOTIFY_EVENT = EVENT_NAME;
