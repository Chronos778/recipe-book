const CACHE_NAME = 'recipe-book-cache-v5';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './main.js',
    './store.js',
    './api.js',
    './utils.js',
    './router.js',
    './components.js',
    './recipes.json',
    './manifest.json',
];

self.addEventListener('install', (event) => {
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
                // Ignore fetch errors to prevent unhandled rejection spam when offline
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
        })
    );
});
