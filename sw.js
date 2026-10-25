// 離線快取：先試網路，失敗才用快取（開發時改了檔案也能馬上看到新版）
// 改了 FILES 清單時，把 CACHE 的版本號加 1，舊快取會在啟用時刪掉
const CACHE = 'aipet-v2';
const FILES = [
  './',
  'index.html',
  'config.js',
  'app/main.js',
  'app/store.js',
  'app/api.js',
  'pet/serial.js',
  'pet/appearance.js',
  'pet/render.js',
  'prototype.html',
  'prototype.js',
  'engine/stroke.js',
  'engine/raster.js',
  'engine/knn.js',
  'engine/health.js',
  'engine/synth.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return; // GAS 等外部網址不經過快取
  // no-cache：每次都跟伺服器確認有沒有新版，避免瀏覽器拿到舊檔
  const req = e.request.mode === 'navigate' ? new Request(e.request.url, { cache: 'no-cache' }) : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
