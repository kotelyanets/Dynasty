/**
 * useAlbums.ts
 * ─────────────────────────────────────────────────────────────
 * Fetches all albums from the backend API.
 */

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { Album } from '@/types/music';

interface UseAlbumsResult {
  data: Album[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAlbums(): UseAlbumsResult {
  const [data, setData] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    api
      .getAlbums()
      .then((albums) => {
        if (mounted) {
          setData(albums);
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
  }, [refreshTrigger]);

  const refetch = () => setRefreshTrigger((t) => t + 1);

  return { data, loading, error, refetch };
}
