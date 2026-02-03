// This is the "Offline page" service worker

importScripts('workbox-sw.js');

const CACHE = "OSSM-possum-offline-v1";

// TODO: replace the following with the correct offline fallback page i.e.: const offlineFallbackPage = "offline.html";
const offlineFallbackPage = "index.html";

// serviceworker.js

self.addEventListener('fetch', function (event) {
  // This is a hack to allow SharedArrayBuffer in Capacitor apps on Github Pages and as PWA
  // Intercept all requests initiated from the document
  event.respondWith(
    fetch(event.request).then(function (response) {
      // It's a hack/workaround, but this makes it work on static hosting
      // We must clone the response to modify headers
      const newResponse = new Response(response.body, response);

      // Set the COEP and COOP headers
      newResponse.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      newResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

      return newResponse;
    })
  );
});


self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener('install', async (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(offlineFallbackPage))
  );
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloadResp = await event.preloadResponse;

        if (preloadResp) {
          return preloadResp;
        }

        const networkResp = await fetch(event.request);
        return networkResp;
      } catch (error) {

        const cache = await caches.open(CACHE);
        const cachedResp = await cache.match(offlineFallbackPage);
        return cachedResp;
      }
    })());
  }
});