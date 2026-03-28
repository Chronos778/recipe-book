const CACHE_NAME = 'recipe-book-cache-v4';
const urlsToCache = [
    new URL('./', self.location).toString(),
    new URL('./index.html', self.location).toString(),
    new URL('./styles.css', self.location).toString(),
    new URL('./main.js', self.location).toString(),
    new URL('./recipes.js', self.location).toString(),
    new URL('./manifest.json', self.location).toString(),
    new URL('./service-worker.js', self.location).toString(),
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

    if (request.destination === 'image') {
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

    event.respondWith(
        caches.match(request).then((response) => {
            if (response) {
                return response;
            }
            return fetch(request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache);
                });
                return response;
            });
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
