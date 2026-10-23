// Bump VERSION when publishing changed app files or cards. Caches are scoped to
// this repository path; other apps on the same github.io origin are left alone.
const VERSION = 'v1';
const BASE = new URL('./', self.location);
const PREFIX = `stack-deck:${BASE.pathname}:`;
const CACHE = `${PREFIX}${VERSION}`;
const FILES = ['./','./index.html','./styles.css','./app.js','./deck.js','./data/cards.json','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'].map(path => new URL(path, BASE).href);

self.addEventListener('install', event => {
  // Installation is atomic: an incomplete download is never announced ready.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Versioned, cache-first assets keep HTML, JS and data in sync offline.
    const cached = await cache.match(event.request, {ignoreSearch:true});
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) {
      if (event.request.mode === 'navigate' && url.pathname === BASE.pathname) return await cache.match(new URL('./index.html',BASE).href);
      throw error;
    }
  })());
});
