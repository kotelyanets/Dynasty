/**
 * useAutoplayInfinity.ts
 * ─────────────────────────────────────────────────────────────
 * When the ♾️ Infinite Autoplay mode is active and the queue
 * runs out, this hook fetches similar tracks from the API and
 * appends them so the music never stops.
 *
 * Reacts to the `_awaitingAutoplay` flag set by `next()` in the
 * player store when it reaches the end of the queue.
 */

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { api } from '@/services/api';

export function useAutoplayInfinity() {
  const fetching = useRef(false);

  useEffect(() => {
    const unsub = usePlayerStore.subscribe(
      (s) => s._awaitingAutoplay,
      async (awaiting) => {
        if (!awaiting || fetching.current) return;
        fetching.current = true;

        try {
          const { currentTrack, queue, queueIndex } = usePlayerStore.getState();
          if (!currentTrack) return;

          const recs = await api.getRecommendations(currentTrack.id, 10);

          if (recs.length > 0) {
            const store = usePlayerStore.getState();
            // Append the recommendations to the queue
            store.addToQueue(recs);
            // Reset the flag
            store._setAwaitingAutoplay(false);

            // Now try advancing again — the queue has new tracks
            const updatedQueue = usePlayerStore.getState().queue;
            const nextIdx = queueIndex + 1;
            if (nextIdx < updatedQueue.length) {
              store.playTrack(updatedQueue[nextIdx], updatedQueue, nextIdx);
            }
          } else {
            // No recommendations found — stop playback
            const store = usePlayerStore.getState();
            store._setAwaitingAutoplay(false);
            store._setIsPlaying(false);
          }
        } catch (err) {
          console.error('[AutoplayInfinity] Failed to fetch recommendations:', err);
          const store = usePlayerStore.getState();
          store._setAwaitingAutoplay(false);
          store._setIsPlaying(false);
        } finally {
          fetching.current = false;
        }
      },
    );

    return unsub;
  }, []);
}
