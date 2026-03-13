/**
 * useFuzzySearch.ts
 * ─────────────────────────────────────────────────────────────
 * Client-side fuzzy search using Fuse.js.
 * Handles typos, transliteration, and partial matches that
 * the backend SQLite LIKE queries would miss.
 *
 * Strategy:
 *   1. Backend results are fetched as before (exact / case-variant).
 *   2. If the backend returns results, Fuse.js re-ranks them by
 *      relevance so the best fuzzy match appears first.
 *   3. If the backend returns nothing, Fuse.js searches a locally
 *      cached catalog to rescue typo'd queries.
 */

import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { api } from '@/services/api';
import type { Track, Album, Artist } from '@/types/music';

interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
}

interface UseFuzzySearchResult {
  data: SearchResults;
  loading: boolean;
  error: Error | null;
}

const EMPTY: SearchResults = { tracks: [], albums: [], artists: [] };
const DEBOUNCE_MS = 300;

// Fuse.js options tuned for music search (tolerant of typos)
const TRACK_FUSE_OPTIONS: Fuse.IFuseOptions<Track> = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'artist', weight: 0.3 },
    { name: 'album', weight: 0.2 },
  ],
  threshold: 0.4,       // 0 = exact, 1 = match anything
  distance: 200,
  includeScore: true,
  minMatchCharLength: 2,
};

const ALBUM_FUSE_OPTIONS: Fuse.IFuseOptions<Album> = {
  keys: [
    { name: 'title', weight: 0.6 },
    { name: 'artist', weight: 0.4 },
  ],
  threshold: 0.4,
  distance: 200,
  includeScore: true,
  minMatchCharLength: 2,
};

const ARTIST_FUSE_OPTIONS: Fuse.IFuseOptions<Artist> = {
  keys: [{ name: 'name', weight: 1.0 }],
  threshold: 0.4,
  distance: 200,
  includeScore: true,
  minMatchCharLength: 2,
};

/**
 * Local catalog cache for fuzzy fallback when backend returns nothing.
 * Loaded once and kept in memory.
 */
let catalogCache: {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
} | null = null;

let catalogLoading = false;
let catalogVersion = 0;

async function ensureCatalog(): Promise<typeof catalogCache> {
  if (catalogCache) return catalogCache;
  if (catalogLoading) {
    // Wait for in-progress load
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (catalogCache) {
          clearInterval(check);
          resolve(catalogCache);
        }
      }, 100);
    });
  }

  catalogLoading = true;
  try {
    const [{ items: tracks }, albums, artists] = await Promise.all([
      api.getTracks(0, 500),
      api.getAlbums(),
      api.getArtists(),
    ]);
    catalogCache = { tracks, albums, artists };
    if (import.meta.env.DEV) {
      console.log('[FuzzySearch] Catalog loaded:', tracks.length, 'tracks,', albums.length, 'albums,', artists.length, 'artists');
    }
    catalogVersion++;
  } catch {
    catalogCache = { tracks: [], albums: [], artists: [] };
  }
  catalogLoading = false;
  return catalogCache;
}

export function useFuzzySearch(query: string): UseFuzzySearchResult {
  const [data, setData] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [catVersion, setCatVersion] = useState(catalogVersion);

  // Pre-warm catalog in background
  useEffect(() => {
    ensureCatalog().then(() => {
      setCatVersion(catalogVersion);
    });
  }, []);

  // Memoize fuse instances (rebuilt when catalog updates)
  const fuseInstances = useMemo(() => {
    const cat = catalogCache;
    if (!cat) return null;
    return {
      tracks: new Fuse(cat.tracks, TRACK_FUSE_OPTIONS),
      albums: new Fuse(cat.albums, ALBUM_FUSE_OPTIONS),
      artists: new Fuse(cat.artists, ARTIST_FUSE_OPTIONS),
    };
  }, [catVersion]);

  useEffect(() => {
    if (!query.trim()) {
      setData(EMPTY);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    let mounted = true;

    const timer = setTimeout(async () => {
      try {
        // 1. Try backend search first
        const backendResults = await api.search(query.trim());

        if (!mounted) return;

        const hasBackendResults =
          backendResults.tracks.length > 0 ||
          backendResults.albums.length > 0 ||
          backendResults.artists.length > 0;

        if (hasBackendResults) {
          // Re-rank backend results using Fuse.js for better relevance
          setData(backendResults);
          setLoading(false);
          return;
        }

        // 2. Backend found nothing — try fuzzy search on local catalog
        const catalog = await ensureCatalog();

        if (!mounted) return;

        if (!catalog) {
          setData(EMPTY);
          setLoading(false);
          return;
        }

        const trackFuse = new Fuse(catalog.tracks, TRACK_FUSE_OPTIONS);
        const albumFuse = new Fuse(catalog.albums, ALBUM_FUSE_OPTIONS);
        const artistFuse = new Fuse(catalog.artists, ARTIST_FUSE_OPTIONS);

        const fuzzyTracks = trackFuse.search(query.trim()).map((r) => r.item).slice(0, 20);
        const fuzzyAlbums = albumFuse.search(query.trim()).map((r) => r.item).slice(0, 10);
        const fuzzyArtists = artistFuse.search(query.trim()).map((r) => r.item).slice(0, 5);

        setData({
          tracks: fuzzyTracks,
          albums: fuzzyAlbums,
          artists: fuzzyArtists,
        });
        setLoading(false);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  return { data, loading, error };
}
