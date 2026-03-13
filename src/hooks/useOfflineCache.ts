/**
 * useOfflineCache.ts
 * ─────────────────────────────────────────────────────────────
 * React hook that wraps the Cache Storage API to let users
 * download tracks for offline playback.
 *
 * How it works:
 *   1. `downloadTrack(track)` fetches the audio stream + cover art
 *      and stores them in the `vault-audio-v1` cache.
 *   2. The service worker (sw.js) intercepts /api/stream/* requests
 *      and serves cached responses when available.
 *   3. `isDownloaded(trackId)` checks the cache synchronously
 *      (via a local Set that is hydrated on mount).
 *   4. `removeDownload(trackId)` evicts the cached files.
 *
 * The cache name MUST match the one in sw.js so both layers
 * agree on where to read/write audio data.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Track } from '@/types/music';

const AUDIO_CACHE = 'vault-audio-v1';
const META_KEY = 'vault_offline_tracks';

// ─────────────────────────────────────────────────────────────
//  Persisted metadata (localStorage — track IDs → titles)
//  We keep a lightweight index so the UI can show which tracks
//  are downloaded without opening the cache on every render.
// ─────────────────────────────────────────────────────────────

interface OfflineMeta {
  [trackId: string]: { title: string; artist: string };
}

function loadMeta(): OfflineMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as OfflineMeta) : {};
  } catch {
    return {};
  }
}

function saveMeta(meta: OfflineMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Storage full — silent fail
  }
}

// ─────────────────────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────────────────────

export function useOfflineCache() {
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(() => {
    return new Set(Object.keys(loadMeta()));
  });
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  // Keep a ref so callbacks always see the latest set
  const downloadedRef = useRef(downloadedIds);
  downloadedRef.current = downloadedIds;

  // Hydrate from actual cache on mount (reconcile with localStorage)
  useEffect(() => {
    if (!('caches' in window)) return;

    (async () => {
      const cache = await caches.open(AUDIO_CACHE);
      const keys = await cache.keys();
      const cachedIds = new Set<string>();
      for (const req of keys) {
        const url = new URL(req.url);
        // Extract trackId from /api/stream/:trackId
        const match = url.pathname.match(/\/api\/stream\/(.+)/);
        if (match) cachedIds.add(match[1]);
      }
      setDownloadedIds(cachedIds);

      // Reconcile localStorage meta
      const meta = loadMeta();
      const updated: OfflineMeta = {};
      for (const id of cachedIds) {
        if (meta[id]) updated[id] = meta[id];
      }
      saveMeta(updated);
    })();
  }, []);

  // ── Download a track to the cache ──────────────────────────

  const downloadTrack = useCallback(async (track: Track): Promise<boolean> => {
    if (!('caches' in window)) return false;
    if (!track.audioUrl) return false;
    if (downloadedRef.current.has(track.id)) return true;

    setDownloading((prev) => new Set(prev).add(track.id));

    try {
      const cache = await caches.open(AUDIO_CACHE);

      // Fetch and cache the audio stream
      const audioResponse = await fetch(track.audioUrl);
      if (!audioResponse.ok) throw new Error(`HTTP ${audioResponse.status}`);
      await cache.put(track.audioUrl, audioResponse);

      // Also cache the cover art (if it's a real URL)
      if (track.coverUrl && !track.coverUrl.startsWith('data:')) {
        try {
          const coverResponse = await fetch(track.coverUrl);
          if (coverResponse.ok) {
            await cache.put(track.coverUrl, coverResponse);
          }
        } catch {
          // Cover cache failure is non-fatal
        }
      }

      // Update local state + persistent meta
      setDownloadedIds((prev) => {
        const next = new Set(prev);
        next.add(track.id);
        return next;
      });

      const meta = loadMeta();
      meta[track.id] = { title: track.title, artist: track.artist };
      saveMeta(meta);

      return true;
    } catch (err) {
      console.error('[OfflineCache] Download failed:', err);
      return false;
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  }, []);

  // ── Remove a track from the cache ──────────────────────────

  const removeDownload = useCallback(async (track: Track): Promise<void> => {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(AUDIO_CACHE);

      if (track.audioUrl) {
        await cache.delete(track.audioUrl);
      }
      if (track.coverUrl && !track.coverUrl.startsWith('data:')) {
        await cache.delete(track.coverUrl);
      }

      setDownloadedIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });

      const meta = loadMeta();
      delete meta[track.id];
      saveMeta(meta);
    } catch (err) {
      console.error('[OfflineCache] Remove failed:', err);
    }
  }, []);

  // ── Check if a track is downloaded ─────────────────────────

  const isDownloaded = useCallback(
    (trackId: string): boolean => downloadedIds.has(trackId),
    [downloadedIds],
  );

  // ── Check if a track is currently downloading ──────────────

  const isDownloading = useCallback(
    (trackId: string): boolean => downloading.has(trackId),
    [downloading],
  );

  return {
    downloadTrack,
    removeDownload,
    isDownloaded,
    isDownloading,
    downloadedIds,
  };
}
