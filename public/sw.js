/* Root-scoped worker for the Attendance PWA. It controls /_astro/ as well as
 * /scan/, but only handles scanner navigations. The build fills in the cache
 * list and version in this file. */
const VERSION = "dev";
const PRECACHE = ["/scan/"];
const CACHE = `scan-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map(async (url) => {
            try {
              const response = await fetch(url);
              if (response.ok) await cache.put(url, response);
            } catch {
              // A later online open can fill a missing entry through fetch.
            }
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

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

const refresh = (cache, request, key) => {
  fetch(request)
    .then((response) => {
      if (response.ok) return cache.put(key, response);
    })
    .catch(() => {});
};

const fromCache = async (request, key = request) => {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(key);
  if (cached) {
    refresh(cache, request, key);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(key, response.clone());
    return response;
  } catch {
    return new Response("Attendance is not ready offline yet.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname.startsWith("/scan/")) {
    event.respondWith(fromCache(request, "/scan/"));
    return;
  }

  if (
    url.pathname.startsWith("/_astro/") ||
    url.pathname.startsWith("/scan/")
  ) {
    event.respondWith(fromCache(request));
  }
});
