// Naturalia - Service Worker
// Cache l'application pour fonctionnement hors-ligne

const CACHE_NAME = 'naturalia-v26.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  // Google Fonts (CSS + woff2)
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&display=swap'
];

// INSTALL : on précharge les assets essentiels
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('[SW] Précache partiel:', err);
        // On essaie quand même de cacher l'index seul
        return cache.add('./').catch(() => {});
      });
    })
  );
  self.skipWaiting();
});

// ACTIVATE : nettoie les vieux caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    })
  );
  self.clients.claim();
});

// FETCH : Stratégie "Network first, fallback cache"
// → l'utilisateur a toujours la dernière version si réseau,
//   et l'app marche entièrement offline sinon.
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET (POST, etc.)
  if (event.request.method !== 'GET') return;

  // Ignorer chrome-extension://, etc.
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre en cache une copie pour usage offline futur
        if (response && response.status === 200) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        // Pas de réseau → on tape dans le cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Si rien : on retourne au moins l'index.html (SPA-style)
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// Message handler : permet de forcer un update depuis l'app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
