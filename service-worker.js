/* ===================================================================
   service-worker.js — يجعل التطبيق يعمل بالكامل بدون إنترنت
   =================================================================== */

const CACHE_VERSION = 'shaysta-wood-manager-v1';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './storage.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// استراتيجية: الشبكة أولاً للملفات الأساسية عند توفر الإنترنت (لضمان التحديثات)،
// مع الرجوع الفوري إلى الكاش عند انعدام الاتصال. الطلبات الأخرى: كاش أولاً.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached || caches.match('./index.html'));

      // إن وُجدت نسخة في الكاش، أعدها فورًا (سرعة + عمل بدون إنترنت)
      // وحدّث الكاش في الخلفية عبر networkFetch.
      return cached || networkFetch;
    })
  );
});
