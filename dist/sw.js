const CACHE_PREFIX = 'vg-counter-shell-';
const CACHE_NAME = CACHE_PREFIX + "60ceac05e7b5858e";
const PRECACHE = ["/index.html","/play.html","/assets/index-Ch4ZHVgW.js","/assets/index-iX4OhTAM.css","/manifest.webmanifest","/icons/app-192.png","/icons/app-512.png","/icons/app-maskable-512.png","/icons/apple-touch-icon.png","/fonts/barlow-condensed-600.ttf","/fonts/barlow-condensed-800.ttf","/field-circuit-blue.svg","/field-circuit-gold.svg","/field-circuit-guard.svg","/symbols/vg-tech-atlas.png","/reference-playmat.jpg","/skins/dragon-sanctuary.webp","/skins/moon-grove.webp"];
const KNOWN_ASSETS = new Set(PRECACHE);

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)));
    // Keep the running game intact. A waiting update activates on user request.
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const old = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME);
        // One preceding shell keeps assets available to any already-open tabs.
        await Promise.all(old.slice(0, -1).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});
async function cachedAsset(path) {
    const current = await (await caches.open(CACHE_NAME)).match(path);
    if (current) return current;
    const previous = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).reverse();
    for (const key of previous) {
        const found = await (await caches.open(key)).match(path);
        if (found) return found;
    }
}
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    if (request.mode === 'navigate' && ['/', '/index.html', '/play.html'].includes(url.pathname)) {
        // The shell and its versioned assets stay together until the update is accepted.
        event.respondWith(cachedAsset('/index.html').then(found => found || fetch(request)));
    } else if (KNOWN_ASSETS.has(url.pathname) || /^\/assets\/[^/]+\.(js|css)$/.test(url.pathname)) {
        event.respondWith(cachedAsset(url.pathname).then(found => found || fetch(request)));
    }
});
self.addEventListener('message', event => {
    if (event.data?.type === 'APPLY_UPDATE') self.skipWaiting();
    if (event.data?.type === 'CLAIM_CLIENTS') event.waitUntil(self.clients.claim());
});
