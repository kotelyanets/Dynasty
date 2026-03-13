/**
 * eqStore.ts
 * ─────────────────────────────────────────────────────────────
 * Ten-band equalizer state managed by Zustand.
 *
 * Presets:
 *   Flat, Rock, Electronic, Acoustic, Bass Boost
 *
 * Gain values are in dB, range: -12 to +12.
 * Band order follows standard 10-band EQ:
 *   [31, 62, 125, 250, 500, 1K, 2K, 4K, 8K, 16K] Hz
 */

import { create } from 'zustand';
import { setAllEQBands, setEQBandGain, resetEQ, ensureAudioPipeline } from '@/audio/audioNodes';

// ── Presets ──────────────────────────────────────────────────

export const EQ_PRESETS: Record<string, { label: string; gains: number[] }> = {
  flat:       { label: 'Flat',       gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  rock:       { label: 'Rock',       gains: [4, 3, 1, -1, -2, 1, 3, 4, 5, 5] },
  electronic: { label: 'Electronic', gains: [5, 4, 2, 0, -2, 1, 0, 2, 4, 5] },
  acoustic:   { label: 'Acoustic',   gains: [3, 2, 1, 1, 0, 0, 1, 2, 2, 3] },
  bassBoost:  { label: 'Bass Boost', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
};

export const EQ_PRESET_KEYS = Object.keys(EQ_PRESETS) as (keyof typeof EQ_PRESETS)[];

// ── Band labels for UI ──────────────────────────────────────

export const EQ_BAND_LABELS = [
  '31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K',
];

// ── Store ────────────────────────────────────────────────────

interface EQState {
  enabled: boolean;
  preset: string;
  bands: number[]; // 10 gains in dB
}

interface EQActions {
  setEnabled: (on: boolean) => void;
  setPreset: (presetKey: string) => void;
  setBand: (index: number, gainDb: number) => void;
}

export type EQStore = EQState & EQActions;

export const useEQStore = create<EQStore>()((set, get) => ({
  enabled: false,
  preset: 'flat',
  bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],

  setEnabled: (on) => {
    set({ enabled: on });
    ensureAudioPipeline();
    if (on) {
      setAllEQBands(get().bands);
    } else {
      resetEQ();
    }
  },

  setPreset: (presetKey) => {
    const preset = EQ_PRESETS[presetKey];
    if (!preset) return;
    const bands = [...preset.gains];
    set({ preset: presetKey, bands });
    ensureAudioPipeline();
    if (get().enabled) {
      setAllEQBands(bands);
    }
  },

  setBand: (index, gainDb) => {
    const bands = [...get().bands];
    bands[index] = Math.max(-12, Math.min(12, gainDb));
    set({ bands, preset: 'custom' });
    ensureAudioPipeline();
    if (get().enabled) {
      setEQBandGain(index, gainDb);
    }
  },
}));
