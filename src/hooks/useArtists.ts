/**
 * useArtists.ts
 * ─────────────────────────────────────────────────────────────
 * Fetches all artists from the backend API.
 * Returns: { data, loading, error, refetch }
 */

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { Artist } from '@/types/music';

interface UseArtistsResult {
  data: Artist[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useArtists(): UseArtistsResult {
  const [data, setData] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    api
      .getArtists()
      .then((artists) => {
        if (mounted) {
          setData(artists);
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
