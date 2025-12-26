/**
 * ZenReader - Service Worker
 * Handles offline caching and share target requests
 */

const CACHE_NAME = 'zenreader-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/storage.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/markdown.js',
  '/js/components/article-card.js',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// External CDN resources to cache
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js',
  'https://unpkg.com/turndown@7.1.2/dist/turndown.js'
];

// Install: precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache static assets
      await cache.addAll(STATIC_ASSETS);
      // Cache CDN assets (may fail if offline, that's ok)
      try {
        await cache.addAll(CDN_ASSETS);
      } catch (e) {
        console.warn('Could not cache CDN assets:', e);
      }
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: handle requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle share target requests - serve index.html
  // The app will parse query params on load
  if (url.pathname === '/share') {
    event.respondWith(
      caches.match('/index.html').then((response) => {
        return response || fetch('/index.html');
      })
    );
    return;
  }

  // Netlify functions - network only (cannot cache)
  if (url.pathname.startsWith('/.netlify/functions/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For same-origin requests, use cache-first strategy
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200) {
            return response;
          }
          // Clone and cache the response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        });
      })
    );
    return;
  }

  // For CDN requests, try cache first, then network
  if (CDN_ASSETS.some((asset) => event.request.url.startsWith(asset.split('?')[0]))) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
    return;
  }

  // Default: network only
  event.respondWith(fetch(event.request));
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
