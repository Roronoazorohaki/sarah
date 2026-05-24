// Sarah — Service Worker
// Stratégie : network-first pour la navigation (HTML/JS) → les mises à jour
// arrivent automatiquement aux utilisateurs ayant installé la PWA.
// Cache-first avec revalidation pour les icônes/manifest (rare update).
// Bumper APP_VERSION à chaque déploiement.

const APP_VERSION = 'sarah-v3-2026-05-24';
const CACHE_NAME = APP_VERSION;
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(CORE_ASSETS).catch(() => {/* tolère assets manquants */})
    )
  );
  // Active immédiatement la nouvelle version dès qu'elle est prête.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Permet au client de demander la prise de contrôle immédiate
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNav = req.mode === 'navigate'
              || req.destination === 'document'
              || req.headers.get('accept')?.includes('text/html');
  const isHTML = isNav || url.pathname.endsWith('.html');
  const isJS = url.pathname.endsWith('.js');

  if (isHTML || isJS) {
    // Network-first : on essaie le réseau, fallback cache
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() =>
        caches.match(req).then((cached) => cached || caches.match('./index.html'))
      )
    );
    return;
  }

  // Stale-while-revalidate pour le reste (icônes, manifest, JSON…)
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchAndCache = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchAndCache;
    })
  );
});
