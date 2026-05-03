// CORE Prism OS — Service Worker
// 役割: オフラインキャッシュ + 将来のプッシュ通知対応
const CACHE_VERSION = 'core-prism-v1';
const STATIC_ASSETS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {/* assets が無くても install を失敗にしない */})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // ナビゲーション要求はネットワーク優先 + 失敗時キャッシュ
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/').then((r) => r || new Response('オフライン', { status: 503 })))
    );
    return;
  }
  // 静的アセットはキャッシュ優先
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => cached || new Response('', { status: 504 }))
    )
  );
});

// プッシュ通知受信 (将来 VAPID 鍵設定後に有効化)
self.addEventListener('push', (event) => {
  let data = { title: 'CORE Prism', body: '新しいお知らせがあります', url: '/' };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch { data.body = event.data.text(); }
  }
  const opts = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url },
    tag: 'core-prism',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(data.title, opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) {
        if (c.url === url && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
