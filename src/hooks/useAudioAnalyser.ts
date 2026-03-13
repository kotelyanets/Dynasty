/**
 * useAudioAnalyser.ts
 * ─────────────────────────────────────────────────────────────
 * Reads frequency data from the Web Audio API AnalyserNode
 * and returns an array of normalised bar heights (0–1) at
 * ~60 fps using requestAnimationFrame.
 *
 * Returns an empty array when:
 *   • The AudioContext has not been initialised yet.
 *   • Nothing is currently playing.
 *
 * Usage:
 *   const bars = useAudioAnalyser(barCount);
 *   // bars: number[] of length `barCount`, values 0–1
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAnalyserNode } from '@/audio/audioContext';
import { usePlayerStore } from '@/store/playerStore';

/**
 * @param barCount  Number of frequency bars to return (default 16).
 */
export function useAudioAnalyser(barCount = 16): number[] {
  const [bars, setBars] = useState<number[]>(() => new Array(barCount).fill(0));
  const rafId = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const tick = useCallback(() => {
    const analyser = getAnalyserNode();
    if (!analyser) {
      rafId.current = requestAnimationFrame(tick);
      return;
    }

    // Lazily allocate the buffer
    if (!dataArrayRef.current || dataArrayRef.current.length !== analyser.frequencyBinCount) {
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    analyser.getByteFrequencyData(dataArrayRef.current);

    // Map the raw frequency bins (typically 32 with fftSize=64) down to
    // the requested barCount by averaging adjacent bins.
    const data = dataArrayRef.current;
    const binCount = data.length;
    const step = Math.max(1, Math.floor(binCount / barCount));
    const result: number[] = [];

    for (let i = 0; i < barCount; i++) {
      const start = i * step;
      const end = Math.min(start + step, binCount);
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += data[j];
      }
      // Normalise to 0–1
      result.push(sum / ((end - start) * 255));
    }

    setBars(result);
    rafId.current = requestAnimationFrame(tick);
  }, [barCount]);

  useEffect(() => {
    if (isPlaying) {
      rafId.current = requestAnimationFrame(tick);
    } else {
      // Fade bars to zero when paused
      setBars(new Array(barCount).fill(0));
    }

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [isPlaying, tick, barCount]);

  return bars;
}
