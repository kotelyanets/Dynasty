/**
 * useArtistDetail.ts
 * ─────────────────────────────────────────────────────────────
 * Fetches a single artist with all their albums and tracks by ID.
 */

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { Artist } from '@/types/music';

interface UseArtistDetailResult {
  data: Artist | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useArtistDetail(artistId: string): UseArtistDetailResult {
  const [data, setData] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    api
      .getArtist(artistId)
      .then((artist) => {
        if (mounted) {
          setData(artist);
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
  }, [artistId, refreshTrigger]);

  const refetch = () => setRefreshTrigger((t) => t + 1);

  return { data, loading, error, refetch };
}
