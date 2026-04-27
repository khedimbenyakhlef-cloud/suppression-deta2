/* ═══════════════════════════════════════════════════════════════
   SUPPRESSION DÉTA — Service Worker v1.0
   PWA : Cache offline, logo barre des tâches, installation
═══════════════════════════════════════════════════════════════ */
"use strict";

const CACHE_NAME    = 'suppression-deta-v1.0';
const CACHE_STATIC  = 'suppression-deta-static-v1';
const CACHE_DYNAMIC = 'suppression-deta-dynamic-v1';

// Fichiers à mettre en cache immédiatement (shell de l'app)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/engine.js',
  '/js/game.js',
  '/js/ui.js',
  '/assets/images/favicon.svg',
  '/assets/images/favicon.ico',
  '/assets/images/logo_large.svg',
  '/assets/images/hero-bg.jpg',
  '/assets/images/city-bg.jpg',
  '/assets/images/alex.png',
  '/assets/images/lana.png',
  '/assets/images/liam.png',
  '/assets/images/enemy.png',
  '/assets/images/enemy2.png',
  '/assets/images/boss.png',
  '/assets/images/tileset.png',
  '/assets/images/minimap_base.png',
  '/assets/images/crosshair.png',
  '/assets/images/explosion.png',
  '/assets/images/gas_inferno.png',
  '/assets/images/gas_rire.png',
  '/assets/images/gas_inerte.png',
  '/assets/images/gas_fume.png',
  '/assets/sounds/gunshot.wav',
  '/assets/sounds/explosion.wav',
  '/assets/sounds/gas_hiss.wav',
  '/assets/sounds/laugh.wav',
  '/assets/sounds/hit.wav',
  '/assets/sounds/click.wav',
  '/assets/sounds/powerup.wav',
  '/assets/sounds/heartbeat.wav',
  '/assets/sounds/hack.wav',
  '/assets/sounds/ambient.wav',
  '/assets/sounds/jump.wav',
  '/assets/sounds/gameover.wav',
  '/assets/sounds/levelup.wav',
];

// ── INSTALLATION ──────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installation Suppression Déta v1.0');
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        console.log('[SW] Mise en cache des assets statiques');
        // Cache séquentiel pour éviter les erreurs individuelles
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => console.warn(`[SW] Cache fail: ${url}`, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATION ────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activation');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => { console.log('[SW] Suppression ancien cache:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── STRATÉGIE DE CACHE ────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API : Network-first (toujours frais si possible, sinon erreur claire)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Assets statiques : Cache-first (performance maximale)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Pages HTML : Stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

// ── STRATÉGIES ───────────────────────────────────────────────────────────────

// Cache-first : cache → réseau → cache dynamique
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Asset non disponible hors-ligne', { status: 503 });
  }
}

// Network-first : réseau → cache → erreur
async function networkFirst(request) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout?.(5000) });
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Hors-ligne', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Stale-while-revalidate : cache immédiat + refresh en arrière-plan
async function staleWhileRevalidate(request) {
  const cache   = await caches.open(CACHE_DYNAMIC);
  const cached  = await caches.match(request);
  const fetching = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || await fetching || new Response('Page non disponible', { status: 503 });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function isStaticAsset(pathname) {
  return (
    pathname.endsWith('.css')  || pathname.endsWith('.js')   ||
    pathname.endsWith('.png')  || pathname.endsWith('.jpg')  ||
    pathname.endsWith('.jpeg') || pathname.endsWith('.svg')  ||
    pathname.endsWith('.ico')  || pathname.endsWith('.wav')  ||
    pathname.endsWith('.mp3')  || pathname.endsWith('.woff2')
  );
}

// ── MESSAGES INTER-THREADS ────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.action === 'skipWaiting') self.skipWaiting();
  if (event.data?.action === 'clearCache') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
