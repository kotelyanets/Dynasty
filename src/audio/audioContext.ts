/**
 * audioContext.ts
 * ─────────────────────────────────────────────────────────────
 * Shared Web Audio API pipeline for crossfade and spectrum analysis.
 *
 * Graph:
 *   audioEl      → sourceA → mainGain ─┐
 *                                       ├→ analyser → masterGain → destination
 *   crossfadeEl  → sourceB → xfGain  ──┘
 *
 *  • mainGain   — controls the primary deck volume (for crossfade animation)
 *  • xfGain     — controls the crossfade deck volume (for crossfade animation)
 *  • masterGain — user volume (setVolume / toggleMute)
 *  • analyser   — provides frequency data for the spectrum visualiser
 *
 * The AudioContext is created lazily on the first user-initiated play()
 * to comply with browser autoplay policies that require a user gesture.
 *
 * IMPORTANT: Once `createMediaElementSource(el)` is called, the element's
 * own `.volume` and `.muted` properties no longer affect audio output.
 * All volume control MUST go through the GainNodes.
 */

// ─────────────────────────────────────────────────────────────
//  Crossfade audio element (second deck)
// ─────────────────────────────────────────────────────────────

export const crossfadeEl = new Audio();
crossfadeEl.preload = 'auto';
crossfadeEl.setAttribute('playsinline', 'true');
crossfadeEl.setAttribute('webkit-playsinline', 'true');

// ─────────────────────────────────────────────────────────────
//  Web Audio nodes (initialised lazily)
// ─────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;
let mainGain: GainNode | null = null;
let xfGain: GainNode | null = null;
let masterGain: GainNode | null = null;
let analyserNode: AnalyserNode | null = null;

// Track whether we've already created sources for each element
// (createMediaElementSource can only be called once per element).
let sourcesCreated = false;

// ─────────────────────────────────────────────────────────────
//  Initialisation
// ─────────────────────────────────────────────────────────────

/**
 * Initialise the Web Audio API pipeline.
 * Must be called in response to a user gesture (click/touch/play).
 * Safe to call multiple times — only initialises once.
 *
 * After this call:
 *  • audioEl.volume and crossfadeEl.volume have NO effect on output.
 *  • Use setMasterVolume() and the GainNode accessors instead.
 */
export function initAudioPipeline(
  mainAudioEl: HTMLAudioElement,
): void {
  if (audioCtx) {
    // Already initialised — just make sure context is running
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return; // Browser doesn't support Web Audio API

  audioCtx = new Ctor();

  // Create nodes
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 64; // 32 frequency bins — enough for a compact bar visualiser
  analyserNode.smoothingTimeConstant = 0.82;

  mainGain = audioCtx.createGain();
  xfGain = audioCtx.createGain();
  masterGain = audioCtx.createGain();

  // Initial gain values
  mainGain.gain.value = 1;
  xfGain.gain.value = 0;
  masterGain.gain.value = 1;

  if (!sourcesCreated) {
    const sourceA = audioCtx.createMediaElementSource(mainAudioEl);
    const sourceB = audioCtx.createMediaElementSource(crossfadeEl);

    sourceA.connect(mainGain);
    sourceB.connect(xfGain);
    sourcesCreated = true;
  }

  mainGain.connect(analyserNode);
  xfGain.connect(analyserNode);
  analyserNode.connect(masterGain);
  masterGain.connect(audioCtx.destination);
}

// ─────────────────────────────────────────────────────────────
//  Accessors
// ─────────────────────────────────────────────────────────────

/** Returns true if the Web Audio pipeline has been initialised. */
export function isAudioPipelineReady(): boolean {
  return audioCtx !== null;
}

/** Resume the AudioContext (call before play). */
export function ensureContextResumed(): void {
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume();
  }
}

export function getAnalyserNode(): AnalyserNode | null {
  return analyserNode;
}

export function getMainGain(): GainNode | null {
  return mainGain;
}

export function getCrossfadeGain(): GainNode | null {
  return xfGain;
}

// ─────────────────────────────────────────────────────────────
//  Volume helpers
// ─────────────────────────────────────────────────────────────

/**
 * Set the user-controlled master volume (0–1).
 * Falls back to audioEl.volume if AudioContext is not yet active.
 */
export function setMasterVolume(
  value: number,
  mainAudioEl: HTMLAudioElement,
): void {
  if (masterGain) {
    masterGain.gain.value = value;
  } else {
    mainAudioEl.volume = value;
  }
}

/**
 * Mute/unmute via the master gain.
 * Falls back to audioEl.muted if AudioContext is not yet active.
 */
export function setMasterMuted(
  muted: boolean,
  mainAudioEl: HTMLAudioElement,
  volume: number,
): void {
  if (masterGain) {
    masterGain.gain.value = muted ? 0 : volume;
  } else {
    mainAudioEl.muted = muted;
    if (!muted) mainAudioEl.volume = volume;
  }
}
