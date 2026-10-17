// 離線快取：先試網路，失敗才用快取（開發時改了檔案也能馬上看到新版）
const CACHE = 'aipet-p1-v1';
const FILES = [
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
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
