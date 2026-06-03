const CACHE_NAME = "thermotrack-v1";
const STATIC_ASSETS = ["/", "/historique", "/planification", "/admin"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Supabase API calls (those go through IndexedDB fallback)
  if (request.method !== "GET") return;
  if (url.hostname.includes("supabase.co")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached ?? new Response("Offline", { status: 503 }));

      // Stale-while-revalidate: return cached immediately, update in background
      return cached ?? networkFetch;
    })
  );
});
