import { useEffect, useState, useCallback } from 'react';
import { getLikedTrackIds, addLikedTrack, removeLikedTrack } from '@/services/api';

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
    const wasLiked = likedIds.has(trackId);

    // Optimistic UI update
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });

    try {
      // Persist to backend
      if (wasLiked) {
        await removeLikedTrack(trackId);
      } else {
        await addLikedTrack(trackId);
      }
    } catch {
      // Revert on failure
      setLikedIds((prev) => {
        const reverted = new Set(prev);
        if (wasLiked) {
          reverted.add(trackId);
        } else {
          reverted.delete(trackId);
        }
        return reverted;
      });
    }
  }, [likedIds]);

  const isLiked = useCallback(
    (trackId: string) => likedIds.has(trackId),
    [likedIds],
  );

  return { likedIds, isLiked, toggleLike, loading };
}

