/**
 * useAudioEngine.ts
 * ─────────────────────────────────────────────────────────────
 * This hook is mounted ONCE at the root of the application
 * (inside <PlayerStoreProvider> in App.tsx).
 *
 * Responsibility:
 *   Attach every relevant HTMLAudioElement event to the matching
 *   Zustand action so the store always reflects the true audio state.
 *
 * Why a hook instead of doing this in the store itself?
 *   The Web Audio API's event system is side-effectful and React
 *   manages the cleanup lifecycle via useEffect. Keeping it here
 *   also makes the store pure/testable without a DOM.
 *
 * iOS-specific notes:
 *   • 'waiting'   fires when the buffer stalls mid-stream (e.g. slow 4G).
 *   • 'canplay'   fires when Safari has buffered enough to start playing —
 *                 this is where we actually call audioEl.play() to satisfy
 *                 the browser's "gesture required" policy after load().
 *   • 'ended'     fires instead of 'timeupdate' hitting duration, so we
 *                 must handle auto-advance here too.
 */

import { useEffect, useRef } from 'react';
import { audioEl, usePlayerStore } from '@/store/playerStore';

export function useAudioEngine() {
  // Track whether we've received a user-initiated play command
  // (i.e., isPlaying was set to true before canplay fired).
  const pendingPlay = useRef(false);

  useEffect(() => {
    const store = usePlayerStore.getState;

    // ── timeupdate ──────────────────────────────────────────
    // Fires ~4× per second (250 ms). We sync currentTime and
    // compute the buffered fraction from the TimeRanges object.
    const onTimeUpdate = () => {
      store()._setCurrentTime(audioEl.currentTime);

      // Calculate how much of the file is buffered (0–1)
      if (audioEl.buffered.length > 0 && audioEl.duration > 0) {
        // Use the end of the last buffered range as the high-water mark
        const bufferedEnd = audioEl.buffered.end(audioEl.buffered.length - 1);
        store()._setBuffered(bufferedEnd / audioEl.duration);
      }
    };

    // ── durationchange ─────────────────────────────────────
    // Fires once the browser knows the exact length of the file.
    // For VBR MP3s this can update mid-stream, so we always sync.
    const onDurationChange = () => {
      if (isFinite(audioEl.duration)) {
        store()._setDuration(audioEl.duration);
      }
    };

    // ── canplay ─────────────────────────────────────────────
    // The browser has buffered enough to begin playing without
    // an immediate stall. This is the correct place to call play()
    // after a src change — calling it in playTrack() directly can
    // race with the load() call on iOS.
    const onCanPlay = () => {
      store()._setBufferingState('ready');
      if (pendingPlay.current || store().isPlaying) {
        pendingPlay.current = false;
        audioEl.play().catch((err: Error) => {
          if (err.name !== 'AbortError') {
            store()._setError(err.message);
          }
        });
      }
    };

    // ── waiting ─────────────────────────────────────────────
    // Network stall during playback (e.g. the buffer ran out).
    const onWaiting = () => store()._setBufferingState('buffering');

    // ── playing ─────────────────────────────────────────────
    // Audio has actually started making sound. Distinct from 'play'
    // which fires when play() is called but before audio has started.
    const onPlaying = () => {
      store()._setIsPlaying(true);
      store()._setBufferingState('ready');
    };

    // ── pause ───────────────────────────────────────────────
    const onPause = () => store()._setIsPlaying(false);

    // ── ended ───────────────────────────────────────────────
    // Track finished naturally. Advance to next (store handles
    // repeat-one by re-seeking to 0 and calling play).
    const onEnded = () => {
      store()._setIsPlaying(false);
      store().next();
    };

    // ── error ───────────────────────────────────────────────
    const onError = () => {
      const err = audioEl.error;
      const messages: Record<number, string> = {
        1: 'Playback aborted',
        2: 'Network error while fetching audio',
        3: 'Audio decoding failed',
        4: 'Audio format not supported',
      };
      const msg = err ? (messages[err.code] ?? `Media error ${err.code}`) : 'Unknown audio error';
      console.error('[AudioEngine]', msg, err);
      store()._setError(msg);
      store()._setBufferingState('error');
    };

    // ── stalled ─────────────────────────────────────────────
    // The browser is trying to fetch but the server has stalled.
    const onStalled = () => {
      if (store().isPlaying) store()._setBufferingState('buffering');
    };

    // ── volumechange ────────────────────────────────────────
    const onVolumeChange = () => {
      usePlayerStore.setState({
        volume: audioEl.volume,
        isMuted: audioEl.muted,
      });
    };

    // ── Register all listeners ───────────────────────────────
    audioEl.addEventListener('timeupdate', onTimeUpdate);
    audioEl.addEventListener('durationchange', onDurationChange);
    audioEl.addEventListener('canplay', onCanPlay);
    audioEl.addEventListener('waiting', onWaiting);
    audioEl.addEventListener('playing', onPlaying);
    audioEl.addEventListener('pause', onPause);
    audioEl.addEventListener('ended', onEnded);
    audioEl.addEventListener('error', onError);
    audioEl.addEventListener('stalled', onStalled);
    audioEl.addEventListener('volumechange', onVolumeChange);

    // ── Subscribe to isPlaying changes from the store ───────
    // When the user presses Play/Pause from the UI (not from
    // hardware keys — those go through MediaSession → store.play/pause
    // → audioEl), we need to propagate the state change to audioEl.
    const unsubscribe = usePlayerStore.subscribe(
      (s) => s.isPlaying,
      (isPlaying) => {
        if (isPlaying) {
          // If the audio is not yet ready, mark pendingPlay so canplay
          // will trigger the play() call instead.
          if (audioEl.readyState < 3 && audioEl.src) {
            pendingPlay.current = true;
          } else if (audioEl.src && audioEl.paused) {
            audioEl.play().catch((err: Error) => {
              if (err.name !== 'AbortError') {
                usePlayerStore.getState()._setError(err.message);
              }
            });
          }
        } else {
          if (!audioEl.paused) audioEl.pause();
        }
      },
    );

    return () => {
      audioEl.removeEventListener('timeupdate', onTimeUpdate);
      audioEl.removeEventListener('durationchange', onDurationChange);
      audioEl.removeEventListener('canplay', onCanPlay);
      audioEl.removeEventListener('waiting', onWaiting);
      audioEl.removeEventListener('playing', onPlaying);
      audioEl.removeEventListener('pause', onPause);
      audioEl.removeEventListener('ended', onEnded);
      audioEl.removeEventListener('error', onError);
      audioEl.removeEventListener('stalled', onStalled);
      audioEl.removeEventListener('volumechange', onVolumeChange);
      unsubscribe();
    };
  }, []); // ← empty deps: this runs once, the ref to audioEl is stable
}
