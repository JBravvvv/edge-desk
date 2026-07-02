/* Edge Desk service worker — caches the app shell so it opens instantly and
   works offline once installed. Bump CACHE when you change any asset. */
const CACHE = 'edge-desk-v6';
const ASSETS = [
  './',
  './index.html',
  './app.jsx',
  './data.json',
  './manifest.webmanifest',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './vendor/babel.min.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Only manage our own origin. Google Fonts / Claude API pass straight to the
  // network (and simply fail gracefully offline).
  if (url.origin !== location.origin) return;

  // Live data must never be served stale: network-first, cache the latest as a
  // single canonical copy so the app still opens (with last-known data) offline.
  if (url.pathname.endsWith('/data.json') || url.pathname.endsWith('data.json')) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./data.json', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./data.json'))
    );
    return;
  }

  // Cache-first, then network; fall back to the app shell for navigations.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Promise.reject('offline')));
    })
  );
});
