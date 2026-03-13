/**
 * sw.js — Service Worker for Vault Music
 * ─────────────────────────────────────────────────────────────
 * Provides two layers of offline support:
 *
 *  1. APP SHELL  — The index.html (single-file build) is cached
 *     on install so the app opens even in Airplane Mode.
 *
 *  2. AUDIO CACHE — When the user taps "Download", the main thread
 *     uses the Cache Storage API to store the audio file in the
 *     `vault-audio-v1` cache. This service worker intercepts
 *     subsequent /api/stream/* requests and serves them from cache
 *     when available (cache-first strategy for audio).
 *
 * Cache names are versioned so a future update can bust stale data
 * by changing the version suffix and cleaning up in the activate event.
 */

const APP_CACHE   = 'vault-app-v1';
const AUDIO_CACHE = 'vault-audio-v1';

// ─────────────────────────────────────────────────────────────
//  Install — cache the app shell
// ─────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) =>
      // Cache the main HTML entry point (which contains all inlined JS/CSS)
      cache.addAll(['/'])
    )
  );
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

// ─────────────────────────────────────────────────────────────
//  Activate — clean up old cache versions
// ─────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const currentCaches = [APP_CACHE, AUDIO_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !currentCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  // Start controlling all open tabs immediately
  self.clients.claim();
});

// ─────────────────────────────────────────────────────────────
//  Fetch — serve from cache when available
// ─────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ── Audio streams: cache-first ──────────────────────────
  // If the audio file was previously downloaded by the user,
  // serve it from cache. Otherwise fall through to the network.
  if (url.pathname.startsWith('/api/stream/')) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request);
        })
      )
    );
    return;
  }

  // ── Cover images: cache-first (populated alongside audio) ──
  if (url.pathname.startsWith('/api/cover/') || url.pathname.startsWith('/covers/')) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request);
        })
      )
    );
    return;
  }

  // ── App shell: network-first, fallback to cache ─────────
  // Try the network first so the user always gets the latest
  // version; fall back to the cached shell when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update the cached shell with the fresh version
          const clone = response.clone();
          caches.open(APP_CACHE).then((cache) => cache.put('/', clone));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // ── Everything else: network only ───────────────────────
  // API calls, etc. are not cached — they need live data.
});
