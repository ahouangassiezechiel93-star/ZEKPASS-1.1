// ══ ZEKPASS Service Worker ══
// Version du cache — incrémenter à chaque mise à jour du site
const CACHE_NAME = 'zekpass-v1';

// Fichiers à mettre en cache pour le mode hors-ligne
const ASSETS_TO_CACHE = [
  '/ZEKPASS-1.1/',
  '/ZEKPASS-1.1/index.html',
  '/ZEKPASS-1.1/manifest.json',
  '/ZEKPASS-1.1/icons/icon-192.png',
  '/ZEKPASS-1.1/icons/icon-512.png'
];

// ── Installation : mettre les assets en cache ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Cache partiel:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activation : supprimer les vieux caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch : stratégie Network First (toujours essayer le réseau d'abord) ──
// Supabase et les APIs restent toujours en temps réel
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Laisser passer les requêtes Supabase (API + Realtime) sans cache
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // Pour les assets statiques : Network First, fallback cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Mettre à jour le cache si réponse valide
        if (response && response.status === 200 && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, cloned);
          });
        }
        return response;
      })
      .catch(() => {
        // Pas de réseau → servir depuis le cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback sur index.html pour les navigations
          if (event.request.mode === 'navigate') {
            return caches.match('/ZEKPASS-1.1/index.html');
          }
        });
      })
  );
});

// ── Notifications push (optionnel pour plus tard) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'ZEKPASS', {
    body: data.body || '',
    icon: '/ZEKPASS-1.1/icons/icon-192.png',
    badge: '/ZEKPASS-1.1/icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/ZEKPASS-1.1/' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/ZEKPASS-1.1/')
  );
});
