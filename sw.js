// Les Carnets du Naturaliste - Service Worker
// Cache l'application pour fonctionnement hors-ligne

const CACHE_NAME = 'carnets-naturaliste-v32.0';

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

// FETCH : deux stratégies selon la nature du fichier.
//
//   Le code de l'app (page, index.html) → RÉSEAU D'ABORD, en contournant
//   explicitement le cache HTTP du navigateur avec cache:'no-store'.
//   C'est le point clé : GitHub Pages répond max-age=600, et sans no-store
//   le service worker récupérait un index.html vieux de dix minutes puis le
//   rangeait dans son propre cache — l'app restait figée sur une version
//   périmée alors même que le réseau marchait.
//
//   Les illustrations, polices et icônes → CACHE D'ABORD, avec revalidation
//   en arrière-plan. Affichage instantané et hors-ligne, tout en récupérant
//   les nouvelles versions pour la fois suivante.
function estCodeDeLApp(request) {
  if (request.mode === 'navigate') return true;
  const url = new URL(request.url);
  return /\.(html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  if (estCodeDeLApp(event.request)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cloned).catch(() => {});
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cached) => cached || caches.match('./index.html')
          )
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const reseau = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cloned).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => cached);
      return cached || reseau;
    })
  );
});

// Message handler : permet de forcer un update depuis l'app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
