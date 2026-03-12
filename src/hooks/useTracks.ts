/**
 * useTracks.ts
 * ─────────────────────────────────────────────────────────────
 * Fetches paginated tracks. For large libraries (5,000+ songs),
 * the backend paginates to avoid transferring massive JSON.
 * 
 * By default, fetches the first 1000 tracks (enough for most UIs).
 * Can be extended to load-more pagination if needed.
 */

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { Track } from '@/types/music';

interface UseTracksResult {
  data: Track[];
  total: number;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  loadMore: () => void;
  hasMore: boolean;
}

const PAGE_SIZE = 500; // Fetch 500 tracks per page

export function useTracks(): UseTracksResult {
  const [data, setData] = useState<Track[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    api
      .getTracks(page, PAGE_SIZE)
      .then((result) => {
        if (mounted) {
          setData((prev) => (page === 0 ? result.items : [...prev, ...result.items]));
          setTotal(result.total);
          setHasMore(result.items.length === PAGE_SIZE);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [page, refreshTrigger]);

  const refetch = () => {
    setPage(0);
    setData([]);
    setRefreshTrigger((t) => t + 1);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage((p) => p + 1);
    }
  };

  return { data, total, loading, error, refetch, loadMore, hasMore };
}
