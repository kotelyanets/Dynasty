/**
 * AudioProcessor.ts
 * ─────────────────────────────────────────────────────────────
 * Singleton Web Audio API processor that provides:
 *
 *   1. Karaoke mode (vocal removal via phase-inversion / mid-side)
 *   2. Spatial Audio (stereo widening via delay-based processing)
 *   3. Audio analyser for frequency visualization
 *
 * Architecture:
 *   audioEl → MediaElementSource → [splitter] → processing → [merger] → analyser → destination
 *
 * The AudioContext is lazily created on the first user interaction
 * (to comply with browser autoplay policies).
 */

import { audioEl } from '@/store/playerStore';
import { isAudioPipelineReady as isContextPipelineReady } from '@/audio/audioContext';

class AudioProcessorSingleton {
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Karaoke (vocal removal) nodes
  private splitter: ChannelSplitterNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private invertGain: GainNode | null = null;
  private invertGainR: GainNode | null = null;
  private karaokeGain: GainNode | null = null;
  private dryGain: GainNode | null = null;

  // Spatial audio nodes
  private spatialDelay: DelayNode | null = null;
  private spatialGain: GainNode | null = null;
  private spatialPanner: StereoPannerNode | null = null;
  private spatialDryGain: GainNode | null = null;

  // Master output
  private masterGain: GainNode | null = null;

  private _karaokeEnabled = false;
  private _spatialEnabled = false;
  private _initialized = false;

  /**
   * Lazily initialize the AudioContext and connect the processing graph.
   * Must be called from a user gesture handler.
   */
  init(): void {
    if (this._initialized) return;

    // If audioContext.ts already owns the MediaElementSource for audioEl,
    // we cannot create another one. Mark as initialized but skip graph setup.
    if (isContextPipelineReady()) {
      this._initialized = true;
      return;
    }

    try {
      this.ctx = new AudioContext();
      this.source = this.ctx.createMediaElementSource(audioEl);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Master gain (always connected)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;

      // ── Karaoke nodes ─────────────────────────────────
      // Vocal removal: L-R = left minus right (cancels center-panned vocals)
      this.splitter = this.ctx.createChannelSplitter(2);
      this.merger = this.ctx.createChannelMerger(2);
      this.invertGain = this.ctx.createGain();
      this.invertGain.gain.value = -1;
      this.invertGainR = this.ctx.createGain();
      this.invertGainR.gain.value = -1;
      this.karaokeGain = this.ctx.createGain();
      this.karaokeGain.gain.value = 0; // disabled by default
      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 1; // full dry signal

      // ── Spatial audio nodes ───────────────────────────
      // Stereo widening via micro-delay on one channel
      this.spatialDelay = this.ctx.createDelay(0.05);
      this.spatialDelay.delayTime.value = 0.012; // 12ms Haas effect
      this.spatialGain = this.ctx.createGain();
      this.spatialGain.gain.value = 0; // disabled by default
      this.spatialPanner = this.ctx.createStereoPanner();
      this.spatialPanner.pan.value = 0.3;
      this.spatialDryGain = this.ctx.createGain();
      this.spatialDryGain.gain.value = 1;

      // ── Connect the default graph (bypass) ────────────
      // source → masterGain → analyser → destination
      this._connectGraph();

      this._initialized = true;
    } catch (e) {
      console.warn('[AudioProcessor] Failed to initialize:', e);
    }
  }

  /** Rebuild the audio processing graph based on current effect states */
  private _connectGraph(): void {
    if (!this.ctx || !this.source || !this.masterGain || !this.analyser) return;

    // Disconnect everything first
    try { this.source.disconnect(); } catch { /* noop */ }
    try { this.masterGain.disconnect(); } catch { /* noop */ }
    try { this.splitter?.disconnect(); } catch { /* noop */ }
    try { this.merger?.disconnect(); } catch { /* noop */ }
    try { this.invertGain?.disconnect(); } catch { /* noop */ }
    try { this.invertGainR?.disconnect(); } catch { /* noop */ }
    try { this.karaokeGain?.disconnect(); } catch { /* noop */ }
    try { this.dryGain?.disconnect(); } catch { /* noop */ }
    try { this.spatialDelay?.disconnect(); } catch { /* noop */ }
    try { this.spatialGain?.disconnect(); } catch { /* noop */ }
    try { this.spatialPanner?.disconnect(); } catch { /* noop */ }
    try { this.spatialDryGain?.disconnect(); } catch { /* noop */ }

    if (this._karaokeEnabled && this.splitter && this.merger && this.invertGain && this.invertGainR && this.karaokeGain && this.dryGain) {
      // Karaoke graph: source → splitter → (L-R vocal cancellation) → merger → master
      this.source.connect(this.splitter);

      // Dry path (pass-through, attenuated)
      this.dryGain.gain.value = 0.15; // Keep a tiny bit of original for naturalness
      this.source.connect(this.dryGain);
      this.dryGain.connect(this.masterGain);

      // Karaoke path: left - right on both channels
      this.karaokeGain.gain.value = 1;

      // Left channel output = Left - Right
      this.splitter.connect(this.merger, 0, 0); // L → L
      this.splitter.connect(this.invertGain, 1, 0); // R → invert
      this.invertGain.connect(this.merger, 0, 0); // -R → L (L-R)

      // Right channel output = Right - Left (same karaoke on both sides)
      this.splitter.connect(this.merger, 1, 1); // R → R
      this.invertGainR.gain.value = -1;
      this.splitter.connect(this.invertGainR, 0, 0); // L → invert
      this.invertGainR.connect(this.merger, 0, 1); // -L → R (R-L)

      this.merger.connect(this.karaokeGain);
      this.karaokeGain.connect(this.masterGain);
    } else {
      // Normal: source → master
      this.source.connect(this.masterGain);
    }

    if (this._spatialEnabled && this.spatialDelay && this.spatialGain && this.spatialPanner && this.spatialDryGain) {
      // Spatial: master → delay → panner → analyser (mixed with dry)
      this.spatialDryGain.gain.value = 0.85;
      this.spatialGain.gain.value = 0.5;

      this.masterGain.connect(this.spatialDryGain);
      this.spatialDryGain.connect(this.analyser);

      this.masterGain.connect(this.spatialDelay);
      this.spatialDelay.connect(this.spatialPanner);
      this.spatialPanner.connect(this.spatialGain);
      this.spatialGain.connect(this.analyser);
    } else {
      this.masterGain.connect(this.analyser);
    }

    this.analyser.connect(this.ctx.destination);
  }

  // ── Public API ────────────────────────────────────────────

  get isInitialized(): boolean {
    return this._initialized;
  }

  get karaokeEnabled(): boolean {
    return this._karaokeEnabled;
  }

  get spatialEnabled(): boolean {
    return this._spatialEnabled;
  }

  setKaraoke(enabled: boolean): void {
    if (!this._initialized) this.init();
    this._karaokeEnabled = enabled;
    this._connectGraph();
  }

  setSpatialAudio(enabled: boolean): void {
    if (!this._initialized) this.init();
    this._spatialEnabled = enabled;
    this._connectGraph();
  }

  toggleKaraoke(): boolean {
    this.setKaraoke(!this._karaokeEnabled);
    return this._karaokeEnabled;
  }

  toggleSpatialAudio(): boolean {
    this.setSpatialAudio(!this._spatialEnabled);
    return this._spatialEnabled;
  }

  /** Get the analyser node for frequency visualization (e.g., lyrics mesh) */
  getAnalyser(): AnalyserNode | null {
    if (!this._initialized) this.init();
    return this.analyser;
  }

  /** Get frequency data for visualization */
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /** Get the bass energy level (0-255) for reactive backgrounds */
  getBassLevel(): number {
    const data = this.getFrequencyData();
    if (!data || data.length === 0) return 0;
    // Average the first 4 bins (lowest frequencies = bass)
    const bassSlice = data.slice(0, 4);
    return bassSlice.reduce((a, b) => a + b, 0) / bassSlice.length;
  }

  /** Resume AudioContext if suspended (call from user gesture) */
  resume(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }
}

// Export as singleton
export const audioProcessor = new AudioProcessorSingleton();
