/* GymGate service worker: keeps the kiosk and member pass usable on weak or
   dropped connections. Owner pages are never cached (they hold private data). */
const VERSION = 'gg-v1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const IMAGES = `${VERSION}-img`;
const OFFLINE_URL = '/offline';
const CACHED_PAGES = ['/kiosk', '/m'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function photoKey(url) {
  // Signed URLs change their token on every refresh; cache by path only.
  const u = new URL(url);
  u.search = '';
  return u.toString();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Member photos from Supabase Storage: show cached copy instantly, refresh in background.
  if (url.pathname.includes('/storage/v1/object/sign/')) {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const key = photoKey(req.url);
        const cached = await cache.match(key);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(key, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // Build assets are content-hashed: cache forever.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(woff2?|png|svg)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === 'navigate') {
    const cacheable = CACHED_PAGES.includes(url.pathname);
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable && res.ok) caches.open(PAGES).then((c) => c.put(url.pathname, res.clone()));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(PAGES);
          return (cacheable && (await cache.match(url.pathname))) || (await cache.match(OFFLINE_URL)) || Response.error();
        }),
    );
  }
});
