/**
 * audioNodes.ts
 * ─────────────────────────────────────────────────────────────
 * Web Audio API pipeline for EQ and volume normalization.
 *
 * Chain:
 *   audioEl → MediaElementSource → BiquadFilter[0..9] → GainNode (normalization) → StereoPannerNode (head tracking) → destination
 *
 * The AudioContext is created lazily on the first user gesture
 * (required by iOS Safari's autoplay policy). Once created, the
 * pipeline stays active for the lifetime of the page.
 *
 * audioEl.volume continues to control the master volume as before.
 */

import { audioEl } from '@/store/playerStore';

// ── Standard 10-band EQ center frequencies (Hz) ────────────
export const EQ_FREQUENCIES = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;

// ── Singleton state ─────────────────────────────────────────

let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let eqFilters: BiquadFilterNode[] = [];
let normGain: GainNode | null = null;
let stereoPanner: StereoPannerNode | null = null;
let _initialized = false;

/**
 * Lazily initialise the Web Audio pipeline.
 * MUST be called from a user-gesture handler (e.g. play button click).
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function ensureAudioPipeline(): boolean {
  if (_initialized) {
    // Resume if suspended (iOS suspends on background → foreground)
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return true;
  }

  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;

    audioCtx = new AC();

    // Source node — connects the HTMLAudioElement into the graph.
    // Important: can only be created ONCE per element.
    sourceNode = audioCtx.createMediaElementSource(audioEl);

    // 10-band EQ — each filter is a peaking EQ at the standard frequency
    eqFilters = EQ_FREQUENCIES.map((freq, i) => {
      const filter = audioCtx!.createBiquadFilter();
      if (i === 0) {
        filter.type = 'lowshelf';
      } else if (i === EQ_FREQUENCIES.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
      }
      filter.frequency.value = freq;
      filter.gain.value = 0;
      filter.Q.value = 1.4;
      return filter;
    });

    // Normalization gain node (ReplayGain / LUFS adjustment)
    normGain = audioCtx.createGain();
    normGain.gain.value = 1.0;

    // Stereo panner node (for head-tracking spatial audio)
    stereoPanner = audioCtx.createStereoPanner();
    stereoPanner.pan.value = 0;

    // Wire the chain: source → EQ[0] → ... → EQ[9] → normGain → stereoPanner → destination
    let prev: AudioNode = sourceNode;
    for (const filter of eqFilters) {
      prev.connect(filter);
      prev = filter;
    }
    prev.connect(normGain);
    normGain.connect(stereoPanner);
    stereoPanner.connect(audioCtx.destination);

    _initialized = true;
    return true;
  } catch (err) {
    console.warn('[AudioNodes] Failed to initialise Web Audio pipeline:', err);
    return false;
  }
}

/** Returns true if the pipeline has been set up. */
export function isAudioPipelineReady(): boolean {
  return _initialized;
}

/**
 * Set the gain (dB) for a single EQ band.
 * Range: -12 to +12 dB.
 */
export function setEQBandGain(bandIndex: number, gainDb: number): void {
  const filter = eqFilters[bandIndex];
  if (filter) {
    filter.gain.value = Math.max(-12, Math.min(12, gainDb));
  }
}

/**
 * Set all 10 EQ band gains at once.
 * @param gains Array of 10 gain values in dB
 */
export function setAllEQBands(gains: number[]): void {
  for (let i = 0; i < eqFilters.length; i++) {
    const g = gains[i] ?? 0;
    eqFilters[i].gain.value = Math.max(-12, Math.min(12, g));
  }
}

/** Reset all EQ bands to flat (0 dB). */
export function resetEQ(): void {
  for (const filter of eqFilters) {
    filter.gain.value = 0;
  }
}

/**
 * Set the normalization gain.
 * @param gainDb Gain adjustment in dB (e.g., -3.5 for a loud track)
 */
export function setNormalizationGain(gainDb: number): void {
  if (!normGain) return;
  // Convert dB to linear gain: 10^(dB/20)
  const linear = Math.pow(10, gainDb / 20);
  normGain.gain.value = Math.max(0, Math.min(4, linear)); // cap at +12 dB
}

/** Reset normalization gain to unity (0 dB). */
export function resetNormalizationGain(): void {
  if (normGain) normGain.gain.value = 1.0;
}

/** Get the AudioContext (for advanced use). */
export function getAudioContext(): AudioContext | null {
  return audioCtx;
}

/**
 * Set the stereo pan value for head-tracking spatial audio.
 * @param value Pan value from -1 (full left) to 1 (full right)
 */
export function setStereoPan(value: number): void {
  if (!stereoPanner) return;
  stereoPanner.pan.value = Math.max(-1, Math.min(1, value));
}

/** Get the current StereoPannerNode (for head-tracking). */
export function getStereoPanner(): StereoPannerNode | null {
  return stereoPanner;
}
