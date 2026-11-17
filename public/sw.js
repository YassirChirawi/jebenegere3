/* Service worker de L'Carta
 * - Pages : réseau d'abord (toujours la dernière version), copie en cache si hors ligne.
 * - Code et sons/images (/_expo/static, /assets) : noms uniques à chaque build, donc cache d'abord.
 * - Tout ce qui va vers un autre domaine (serveur de jeu, avatars) n'est jamais touché.
 */
const VERSION = 'jg3-v1'; // garder le même nom dans register-sw.js (cache du code)
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(['/', '/manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return; // sons lus par morceaux : on laisse le navigateur faire
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Seule la page du jeu (/) sert de secours hors ligne ; /privacy et /terms ont leur propre copie
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname === '/' ? '/' : url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname, { cacheName: PAGES }).then((hit) => hit || caches.match('/', { cacheName: PAGES })))
    );
    return;
  }

  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(STATIC).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res.status === 200) c.put(req, res.clone());
          return res;
        }))
      )
    );
  }
});
