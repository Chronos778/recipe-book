const CACHE_NAME = 'recipe-book-cache-v27';
const urlsToCache = [
    './',
    './index.html',
    './css/variables.css',
    './css/base.css',
    './css/layout.css',
    './css/components.css',
    './css/modals.css',
    './css/responsive.css',
    './js/main.js',
    './js/store.js',
    './js/api.js',
    './js/utils.js',
    './js/router.js',
    './js/components.js',
    './js/idb.js',
    './manifest.json',
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Cache-First for images (Unsplash)
    if (request.destination === 'image' || request.url.includes('images.unsplash.com')) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;

                return fetch(request).then((networkResponse) => {
                    if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
                        const responseToCache = networkResponse.clone();
                        event.waitUntil(caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        }));
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // Stale-While-Revalidate for everything else
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // If fetch fails (offline), return cached response if available, or a 503 fallback
                if (cachedResponse) return cachedResponse;
                return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
            });

            // Return cached response immediately if available, while fetching in background
            return cachedResponse || fetchPromise;
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});
