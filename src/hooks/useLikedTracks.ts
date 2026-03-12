import { useEffect, useState, useCallback } from 'react';
import { getLikedTrackIds, setLikedTrackIds } from '@/services/api';

export function useLikedTracks() {
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getLikedTrackIds()
      .then((ids) => {
        if (!mounted) return;
        setLikedIds(new Set(ids));
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const toggleLike = useCallback(async (trackId: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      // Fire-and-forget sync with backend; we optimistically update UI.
      void setLikedTrackIds(Array.from(next));
      return next;
    });
  }, []);

  const isLiked = useCallback(
    (trackId: string) => likedIds.has(trackId),
    [likedIds],
  );

  return { likedIds, isLiked, toggleLike, loading };
}

