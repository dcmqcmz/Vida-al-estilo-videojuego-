// AFTER GAME — Service Worker
const CACHE_NAME = 'after-game-v3';
const ASSETS = ['./manifest.json'];

// Install — cache only static assets, skip waiting so new SW activates immediately
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate — clean old caches and take control of all open tabs immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — NETWORK-FIRST for navigation/HTML so updates always show up immediately.
// Falls back to cache only when offline. Other assets (icons, manifest) use cache-first.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const isHTML = e.request.mode === 'navigate' || e.request.destination === 'document';

  if (isHTML) {
    // Always try the network first for the app shell, so new deployments show instantly.
    // cache:'no-store' forces the browser to bypass its own HTTP cache, not just the SW cache.
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets: cache-first (fast), with network fallback + cache refresh.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return (
        cached ||
        fetch(e.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached)
      );
    })
  );
});

// Handle scheduled notifications from the app
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body: body,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'after-game-' + Date.now(),
      });
    }, delay);
  }
});

// Notification click — focus or open the app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
