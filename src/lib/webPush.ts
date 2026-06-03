// ============================================================
// webPush.ts — Service Worker + Push Subscription クライアント API
//
// オーナー指示 (2026-06-03 第 10 波 SS):
//   オーナーがアプリを閉じていてもブラウザ通知を出せる土台。
//
// フロー:
//   1) requestPermission()      ブラウザの通知許可を要求
//   2) subscribePush(publicKey) Push Manager に subscribe + サーバへ POST
//   3) unsubscribePush()        購読解除
// ============================================================

const SUBSCRIBE_PATH = '/api/push/subscribe';

/** URL-safe Base64 → Uint8Array */
function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - b64.length % 4) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Service Worker が登録されているか確認し、未登録なら登録 */
async function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    // ready まで待つ
    return await navigator.serviceWorker.ready.then(() => reg);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[webPush] SW 登録失敗', e);
    return null;
  }
}

export async function isPushSupported(): Promise<boolean> {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

export async function subscribePush(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!await isPushSupported()) return null;
  const perm = await requestPermission();
  if (perm !== 'granted') return null;

  const reg = await ensureRegistration();
  if (!reg) return null;

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // 既存購読をサーバにも同期 (端末リセット時のリカバリ)
    await postSubscription(existing).catch(() => { /* */ });
    return existing;
  }

  try {
    const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
    // TS: PushSubscriptionOptionsInit が ArrayBuffer 互換を要求するので buffer を切り出す
    const appServerKey = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
    await postSubscription(sub);
    return sub;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[webPush] subscribe 失敗', e);
    return null;
  }
}

export async function unsubscribePush(): Promise<boolean> {
  const reg = await ensureRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  try {
    await sub.unsubscribe();
    // サーバ側の削除も (ベストエフォート)
    await fetch(SUBSCRIBE_PATH, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => { /* */ });
    return true;
  } catch {
    return false;
  }
}

async function postSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  await fetch(SUBSCRIBE_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys, // { p256dh, auth }
    }),
    keepalive: true,
  });
}
