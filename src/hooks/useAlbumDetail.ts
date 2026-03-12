/**
 * useAlbumDetail.ts
 * ─────────────────────────────────────────────────────────────
 * Fetches a single album with all its tracks by ID.
 */

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { Album } from '@/types/music';

interface UseAlbumDetailResult {
  data: Album | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAlbumDetail(albumId: string): UseAlbumDetailResult {
  const [data, setData] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    api
      .getAlbum(albumId)
      .then((album) => {
        if (mounted) {
          setData(album);
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
  }, [albumId, refreshTrigger]);

  const refetch = () => setRefreshTrigger((t) => t + 1);

  return { data, loading, error, refetch };
}
