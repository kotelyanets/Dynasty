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
import { ensureContextResumed, isAudioPipelineReady } from '@/audio/audioContext';
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
      // Resume the audioContext.ts pipeline as well (fixes "No Sound on PC")
      ensureContextResumed();
    };

    // ── pause ───────────────────────────────────────────────
    const onPause = () => store()._setIsPlaying(false);

    // ── ended ───────────────────────────────────────────────
    const onEnded = () => {
      if (store()._isCrossfading) return;
      store()._setIsPlaying(false);
      // Notify sleep timer
      useSleepTimerStore.getState()._onTrackEnd();
      store().next();
    };

    // ── error ───────────────────────────────────────────────
    const onError = (e: Event) => {
      const err = audioEl.error;
      const codes: Record<number, string> = {
        1: 'MEDIA_ERR_ABORTED',
        2: 'MEDIA_ERR_NETWORK',
        3: 'MEDIA_ERR_DECODE',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
      };
      const codeStr = err ? (codes[err.code] ?? `UNKNOWN_CODE_${err.code}`) : 'NO_ERROR_OBJECT';
      const msg = `🔴 STRICT AUDIO_ERROR: ${codeStr} | msg: ${err?.message || 'N/A'}`;
      console.error('[AudioEngine]', msg, e);
      // Attempt to toast via a global hack, or just rely on state _setError
      if (typeof window !== 'undefined') {
        const toastEl = document.createElement('div');
        toastEl.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:red;color:white;padding:10px 20px;border-radius:8px;z-index:999999;font-weight:bold;font-size:14px;';
        toastEl.textContent = msg;
        document.body.appendChild(toastEl);
        setTimeout(() => toastEl.remove(), 8000);
      }
      
      store()._setError(msg);
      store()._setBufferingState('error');
    };

    // ── stalled ─────────────────────────────────────────────
    const onStalled = (e: Event) => {
      console.warn('[AudioEngine] 🟡 STALLED event fired!', e);
      if (store().isPlaying) store()._setBufferingState('buffering');
    };

    // ── suspend ─────────────────────────────────────────────
    const onSuspend = (e: Event) => {
      console.warn('[AudioEngine] SUSPEND event fired!', e);
    };

    // ── volumechange ────────────────────────────────────────
    const onVolumeChange = () => {
      usePlayerStore.setState({
        volume: audioEl.volume,
        isMuted: audioEl.muted,
      });
    };

    // ── Resume AudioContext on first user interaction (No Sound on PC fix) ─
    // Don't remove the listener until the AudioContext actually exists and is
    // running, otherwise an early click before playTrack() creates the context
    // would discard the listener permanently.
    const resumeOnInteraction = () => {
      ensureContextResumed();
      // Only stop listening once the pipeline is initialised and running
      if (isAudioPipelineReady()) {
        document.removeEventListener('click', resumeOnInteraction);
        document.removeEventListener('touchstart', resumeOnInteraction);
        document.removeEventListener('keydown', resumeOnInteraction);
      }
    };
    document.addEventListener('click', resumeOnInteraction);
    document.addEventListener('touchstart', resumeOnInteraction);
    document.addEventListener('keydown', resumeOnInteraction);

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
    audioEl.addEventListener('suspend', onSuspend);
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
      audioEl.removeEventListener('suspend', onSuspend);
      audioEl.removeEventListener('volumechange', onVolumeChange);
      document.removeEventListener('click', resumeOnInteraction);
      document.removeEventListener('touchstart', resumeOnInteraction);
      document.removeEventListener('keydown', resumeOnInteraction);
      unsubscribe();
      unsubNorm();
    };
  }, []); // ← empty deps: this runs once, the ref to audioEl is stable
}
