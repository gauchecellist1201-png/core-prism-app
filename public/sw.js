// CORE Prism OS — Service Worker
// 役割: オフラインキャッシュ + 将来のプッシュ通知対応
// v3: network-first 化 + 古い JS/CSS をフラッシュ (旧 SW 由来の真っ白問題を解消)
// v4 (2026-07-26): ★/api/ を絶対にキャッシュしないよう修正。
//   これまで API の GET 応答が「キャッシュ優先」の分岐に落ちており、一度掴んだ
//   応答を永久に返し続けていた。実害: Google 連携の設定を有効化した後も
//   ブラウザが古い {"configured":false} を返し続け、新方式が使われず
//   「連携したのに毎回切れる」状態が続いた（オーナー報告 2026-07-26）。
//   連携状態・残高・通知など「今の値」を返す API がすべて同じ地雷を踏むため、
//   パス単位で除外する。
const CACHE_VERSION = 'core-prism-v4';
const STATIC_ASSETS = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

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
  const url = new URL(req.url);
  // ★API は絶対にキャッシュしない (2026-07-26)
  //   連携状態などの「今の値」を返すため、1回でもキャッシュすると古い答えを
  //   返し続けて不具合の原因になる。SW は一切介入せずネットワークに素通しする。
  if (url.pathname.startsWith('/api/')) return;
  // ナビゲーション要求はネットワーク優先 + 失敗時キャッシュ
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/').then((r) => r || new Response('オフライン', { status: 503 })))
    );
    return;
  }
  // JS / CSS / フォント / SVG はネットワーク優先 (デプロイ更新を即反映)
  const isCodeAsset = /\.(js|css|woff2?|ttf|svg)$/i.test(url.pathname) || url.pathname.startsWith('/assets/');
  if (isCodeAsset) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req).then((cached) => cached || new Response('', { status: 504 })))
    );
    return;
  }
  // 画像など それ以外はキャッシュ優先 (高速 + オフライン対応)
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
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
