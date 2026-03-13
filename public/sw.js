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

// ─────────────────────────────────────────────────────────────
//  Background Sync — replay queued offline actions
// ─────────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'vault-sync') {
    event.waitUntil(replayOfflineQueue());
  }
});

// ─────────────────────────────────────────────────────────────
//  Push Notifications — show alerts for new releases
// ─────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = { title: 'Vault Music', body: 'New music available!' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23FA2D48"/><text x="50" y="68" text-anchor="middle" font-size="50" fill="white">♪</text></svg>',
      badge: data.badge,
      tag: data.tag || 'vault-notification',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if one exists
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          if (url !== '/') client.navigate(url);
          return;
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});

/**
 * Replay all queued offline actions from IndexedDB.
 * Called by the Background Sync API when connectivity returns.
 */
async function replayOfflineQueue() {
  const DB_NAME = 'vault-offline-queue';
  const STORE_NAME = 'actions';

  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const actions = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const action of actions) {
      try {
        const init = {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
        };
        if (action.body) init.body = action.body;

        const response = await fetch(action.url, init);
        if (response.ok || response.status === 409) {
          const deleteTx = db.transaction(STORE_NAME, 'readwrite');
          deleteTx.objectStore(STORE_NAME).delete(action.id);
        }
      } catch {
        // Still offline — will retry on next sync
        break;
      }
    }

    db.close();
  } catch (err) {
    console.warn('[SW] Background sync failed:', err);
  }
}
