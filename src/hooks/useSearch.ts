/**
 * useSearch.ts
 * ─────────────────────────────────────────────────────────────
 * Searches across all entities (tracks, albums, artists).
 * Debounced — fires 300ms after the user stops typing.
 */

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { Track, Album, Artist } from '@/types/music';

interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
}

interface UseSearchResult {
  data: SearchResults;
  loading: boolean;
  error: Error | null;
}

const EMPTY: SearchResults = { tracks: [], albums: [], artists: [] };
const DEBOUNCE_MS = 300;

export function useSearch(query: string): UseSearchResult {
  const [data, setData] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setData(EMPTY);
      setLoading(false);
      setError(null);
      return;
    }

    // Show spinner immediately so the UI doesn't feel stuck.
    setLoading(true);

    let mounted = true;

    const timer = setTimeout(() => {
      api
        .search(query.trim())
        .then((results) => {
          if (mounted) {
            setData(results);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (mounted) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  return { data, loading, error };
}
