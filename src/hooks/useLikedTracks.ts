import { useEffect, useCallback } from 'react';
import { useLikedStore } from '@/store/likedStore';

/**
 * Thin wrapper around the global Zustand liked-tracks store.
 *
 * Because every component shares the same store, toggling a like
 * in NowPlaying instantly updates TrackRow, AlbumDetail, etc.
 */
export function useLikedTracks() {
  const likedIds = useLikedStore((s) => s.likedIds);
  const loading = useLikedStore((s) => s.loading);
  const toggleLike = useLikedStore((s) => s.toggleLike);
  const hydrate = useLikedStore((s) => s.hydrate);

  // Trigger hydration on first mount (idempotent — only fetches once).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { hydrate(); }, []);

  const isLiked = useCallback(
    (trackId: string) => likedIds.has(trackId),
    [likedIds],
  );

  return { likedIds, isLiked, toggleLike, loading };
}

