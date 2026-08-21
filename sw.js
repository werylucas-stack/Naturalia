// Les Carnets du Naturaliste - Service Worker
// Cache l'application pour fonctionnement hors-ligne

const CACHE_NAME = 'carnets-naturaliste-v30.0';

// Le noyau de l'app : sans ces fichiers rien ne s'affiche.
// Ils sont prechargés à l'installation, un par un pour qu'un seul manquant
// ne fasse pas échouer tout le lot (le défaut de cache.addAll).
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  // Polices auto-hebergees (plus aucun appel a Google Fonts)
  // Cormorant Garamond est variable : ces 4 fichiers couvrent 300 a 700
  './fonts/cormorant-garamond-400-normal-latin.woff2',
  './fonts/cormorant-garamond-400-normal-latin-ext.woff2',
  './fonts/cormorant-garamond-400-italic-latin.woff2',
  './fonts/cormorant-garamond-400-italic-latin-ext.woff2',
  './fonts/old-standard-tt-400-normal-latin.woff2',
  './fonts/old-standard-tt-400-normal-latin-ext.woff2',
  './fonts/old-standard-tt-400-italic-latin.woff2',
  './fonts/old-standard-tt-400-italic-latin-ext.woff2',
  './fonts/old-standard-tt-700-normal-latin.woff2',
  './fonts/old-standard-tt-700-normal-latin-ext.woff2',
];

// INSTALL : on précharge les assets essentiels
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Un par un, et jamais addAll : addAll est atomique, un seul fichier
      // absent rejetait tout le lot et l'app se retrouvait sans cache.
      return Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] non mis en cache:', url, err);
          })
        )
      );
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
