self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open('orderflow-v1').then((cache) => cache.addAll([
            '/admin/style.css',
            '/admin/icon.svg'
        ]))
    );
});

self.addEventListener('fetch', (e) => {
    // Pour une app connectée, on privilégie le réseau, fallback sur le cache
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
