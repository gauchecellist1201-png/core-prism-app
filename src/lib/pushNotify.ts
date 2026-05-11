// ============================================================
// pushNotify — ブラウザ通知 (Notification API + Service Worker)
// ============================================================
// VAPID 鍵を使った WebPush ではなく、PWA インストール環境で
// Service Worker.showNotification を使ってローカル通知を出すラッパ。
// パーミッション未取得時に勝手にリクエストしない (UX 配慮)。
// ============================================================

const PERM_ASKED_KEY = 'core_notification_asked_v1';

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission {
  if (!notificationSupported()) return 'denied';
  return Notification.permission;
}

export function notificationAlreadyAsked(): boolean {
  try { return localStorage.getItem(PERM_ASKED_KEY) === '1'; } catch { return false; }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationSupported()) return 'denied';
  try { localStorage.setItem(PERM_ASKED_KEY, '1'); } catch { /* */ }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

interface ShowOpts {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** 重複を避けたい場合の dedupe キー */
  dedupeKey?: string;
}

const DEDUPE_KEY = 'core_notification_dedupe_v1';

function alreadyShown(dedupe?: string): boolean {
  if (!dedupe) return false;
  try {
    const map: Record<string, number> = JSON.parse(localStorage.getItem(DEDUPE_KEY) || '{}');
    const ts = map[dedupe];
    // 12 時間以内に同じ dedupe で出していたらスキップ
    return typeof ts === 'number' && Date.now() - ts < 12 * 3600 * 1000;
  } catch { return false; }
}

function markShown(dedupe?: string) {
  if (!dedupe) return;
  try {
    const map: Record<string, number> = JSON.parse(localStorage.getItem(DEDUPE_KEY) || '{}');
    map[dedupe] = Date.now();
    // 古いキーを掃除
    const cutoff = Date.now() - 7 * 86400 * 1000;
    for (const k of Object.keys(map)) if (map[k] < cutoff) delete map[k];
    localStorage.setItem(DEDUPE_KEY, JSON.stringify(map));
  } catch { /* */ }
}

export async function showLocalNotification(opts: ShowOpts): Promise<boolean> {
  if (!notificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  if (alreadyShown(opts.dedupeKey)) return false;

  const payload = {
    body: opts.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: opts.url || '/' },
    tag: opts.tag || 'core-prism',
    renotify: true,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(opts.title, payload);
        markShown(opts.dedupeKey);
        return true;
      }
    }
    // SW 無し → ページ内通知にフォールバック
    new Notification(opts.title, payload);
    markShown(opts.dedupeKey);
    return true;
  } catch {
    return false;
  }
}
