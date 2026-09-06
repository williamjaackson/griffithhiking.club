/* The scanner's service worker.
 *
 * Its whole job is to make /scan/ open in aeroplane mode. It caches the page,
 * the scripts, styles and fonts the page uses, and the barcode reader's
 * WebAssembly, and it answers from that cache first. Nothing else on the site
 * goes through it: the registration scopes it to /scan/.
 *
 * The two lines below are filled in at build time by integrations/precache.ts.
 * In development they are left as they are, and the worker is not registered.
 */
const VERSION = "dev";
const PRECACHE = ["/scan/"];

const CACHE = `scan-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

/* A new version throws the old cache away and takes over open pages at once.
 * The page that is open keeps the scripts it has already loaded, so nothing it
 * is doing breaks; the next open gets the new version. */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("scan-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* Cache first, then the network, and a good answer from the network is kept.
 * A bad one (no signal, a login page, a 404) is passed through and never
 * stored, so the cache cannot be poisoned by a bad moment. */
const fromCacheThenNetwork = async (request, key = request) => {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(key);
  if (cached) {
    // Refresh in the background, so a deploy reaches the phone whenever it is
    // next online, without the page waiting on the network to open.
    event_refresh(cache, request, key);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(key, response.clone());
    return response;
  } catch {
    // A missing cache entry must not leave a navigation hanging offline.
    return new Response(
      "Attendance is not ready offline yet. Open it once while online.",
      {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
};

const event_refresh = (cache, request, key) => {
  fetch(request)
    .then((response) => {
      if (response.ok) return cache.put(key, response);
    })
    .catch(() => {
      // Offline. The cached copy stands.
    });
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Any navigation within scope is the one page, whatever hash or query it
  // arrived with.
  if (request.mode === "navigate" && url.pathname.startsWith("/scan/")) {
    event.respondWith(fromCacheThenNetwork(request, "/scan/"));
    return;
  }

  if (
    url.pathname.startsWith("/_astro/") ||
    url.pathname.startsWith("/scan/")
  ) {
    event.respondWith(fromCacheThenNetwork(request));
  }
});
