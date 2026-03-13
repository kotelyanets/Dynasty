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
 * Also handles:
 *   • Initialising the Web Audio API pipeline (EQ + normalization)
 *     on first user interaction.
 *   • Applying per-track loudness normalization (LUFS → GainNode).
 *   • Notifying the sleep timer when a track ends.
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
import { ensureAudioPipeline, setNormalizationGain, resetNormalizationGain } from '@/audio/audioNodes';
import { useSleepTimerStore } from '@/store/sleepTimerStore';

/** Target loudness for normalization (Spotify / Apple Music standard). */
const TARGET_LUFS = -14;

export function useAudioEngine() {
  // Track whether we've received a user-initiated play command
  // (i.e., isPlaying was set to true before canplay fired).
  const pendingPlay = useRef(false);

  useEffect(() => {
    const store = usePlayerStore.getState;

    // ── timeupdate ──────────────────────────────────────────
    const onTimeUpdate = () => {
      store()._setCurrentTime(audioEl.currentTime);

      if (audioEl.buffered.length > 0 && audioEl.duration > 0) {
        const bufferedEnd = audioEl.buffered.end(audioEl.buffered.length - 1);
        store()._setBuffered(bufferedEnd / audioEl.duration);
      }
    };

    // ── durationchange ─────────────────────────────────────
    const onDurationChange = () => {
      if (isFinite(audioEl.duration)) {
        store()._setDuration(audioEl.duration);
      }
    };

    // ── canplay ─────────────────────────────────────────────
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
    const onWaiting = () => store()._setBufferingState('buffering');

    // ── playing ─────────────────────────────────────────────
    const onPlaying = () => {
      store()._setIsPlaying(true);
      store()._setBufferingState('ready');
      // Ensure Web Audio pipeline is active (requires user gesture on iOS)
      ensureAudioPipeline();
    };

    // ── pause ───────────────────────────────────────────────
    const onPause = () => store()._setIsPlaying(false);

    // ── ended ───────────────────────────────────────────────
    const onEnded = () => {
      store()._setIsPlaying(false);
      // Notify sleep timer
      useSleepTimerStore.getState()._onTrackEnd();
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
    const unsubscribe = usePlayerStore.subscribe(
      (s) => s.isPlaying,
      (isPlaying) => {
        if (isPlaying) {
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

    // ── Subscribe to track changes for loudness normalization ─
    const unsubNorm = usePlayerStore.subscribe(
      (s) => s.currentTrack,
      (track) => {
        if (!track?.loudnessLufs) {
          resetNormalizationGain();
          return;
        }
        // Calculate gain adjustment: how much louder/quieter than target
        const gainDb = TARGET_LUFS - track.loudnessLufs;
        setNormalizationGain(gainDb);
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
      unsubNorm();
    };
  }, []); // ← empty deps: this runs once, the ref to audioEl is stable
}
