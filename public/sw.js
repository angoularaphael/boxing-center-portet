/**
 * Boxing Center Portet — service worker.
 * Pages: network-first (a publish must show up on the next visit), cached copy
 * as offline/slow-network fallback. Hashed build assets, fonts and images:
 * cache-first (they are immutable or change rarely). /api, /admin and /media
 * (range requests) are never intercepted.
 */
const VERSION = "bcp-v1";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const IMAGES = `${VERSION}-images`;
const IMAGE_CAP = 160;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, ASSETS, IMAGES];
      for (const key of await caches.keys()) {
        if (!keep.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

async function trim(cacheName, cap) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - cap; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/^\/(api|admin|media)(\/|$)/.test(url.pathname)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(PAGES)).put(req, res.clone());
          return res;
        } catch {
          return (await caches.match(req)) || (await caches.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  const isAsset = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/fonts/");
  const isImage = url.pathname.startsWith("/img/") || /\.(png|svg|webp|jpg|jpeg|ico)$/.test(url.pathname);
  if (!isAsset && !isImage) return;

  event.respondWith(
    (async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.status === 200) {
        const name = isAsset ? ASSETS : IMAGES;
        (await caches.open(name)).put(req, res.clone());
        if (!isAsset) trim(IMAGES, IMAGE_CAP);
      }
      return res;
    })()
  );
});
