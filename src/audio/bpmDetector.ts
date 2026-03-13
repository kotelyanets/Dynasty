/**
 * bpmDetector.ts
 * ─────────────────────────────────────────────────────────────
 * Lightweight BPM detection using Web Audio API peak analysis.
 *
 * Analyses an audio buffer's energy peaks to estimate tempo (BPM).
 * Used for automatic DJ-style crossfade beatmatching between tracks.
 *
 * Algorithm:
 *   1. Decode audio to OfflineAudioContext
 *   2. Apply low-pass filter to isolate kick drum frequencies
 *   3. Detect energy peaks above threshold
 *   4. Calculate average interval between peaks → BPM
 */

/**
 * Detect BPM from an audio buffer.
 * Uses time-domain peak detection on a filtered signal.
 */
export async function detectBPM(audioBuffer: AudioBuffer): Promise<number> {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // mono analysis

  // Low-pass filter the signal to isolate bass/kick
  const filtered = lowPassFilter(channelData, sampleRate, 150);

  // Get the envelope via peak detection
  const peaks = findPeaks(filtered, sampleRate);

  if (peaks.length < 2) return 120; // fallback BPM

  // Calculate intervals between peaks
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  // Group similar intervals and find the most common
  const bpm = intervalsToTempo(intervals, sampleRate);
  return bpm;
}

/**
 * Simple low-pass filter (single-pole IIR).
 */
function lowPassFilter(
  data: Float32Array,
  sampleRate: number,
  cutoff: number,
): Float32Array {
  const rc = 1.0 / (cutoff * 2 * Math.PI);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);

  const filtered = new Float32Array(data.length);
  filtered[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    filtered[i] = filtered[i - 1] + alpha * (data[i] - filtered[i - 1]);
  }
  return filtered;
}

/**
 * Find peaks in the audio signal above a dynamic threshold.
 * Returns array of sample indices where peaks occur.
 */
function findPeaks(data: Float32Array, sampleRate: number): number[] {
  // Calculate RMS for dynamic threshold
  let sumSq = 0;
  for (let i = 0; i < data.length; i++) {
    sumSq += data[i] * data[i];
  }
  const rms = Math.sqrt(sumSq / data.length);
  const threshold = rms * 1.4;

  // Minimum distance between peaks (~60 BPM = 1 sec)
  const minDistance = Math.floor(sampleRate * 0.3);

  const peaks: number[] = [];
  let lastPeak = -minDistance;

  for (let i = 1; i < data.length - 1; i++) {
    if (
      Math.abs(data[i]) > threshold &&
      Math.abs(data[i]) > Math.abs(data[i - 1]) &&
      Math.abs(data[i]) > Math.abs(data[i + 1]) &&
      i - lastPeak >= minDistance
    ) {
      peaks.push(i);
      lastPeak = i;
    }
  }

  return peaks;
}

/**
 * Convert peak intervals to BPM using histogram binning.
 * Returns the most likely tempo in the 60–200 BPM range.
 */
function intervalsToTempo(intervals: number[], sampleRate: number): number {
  // Convert sample intervals to BPM values
  const bpms = intervals.map((interval) => (60 * sampleRate) / interval);

  // Bin into buckets (1 BPM resolution)
  const bins = new Map<number, number>();
  for (const bpm of bpms) {
    // Only consider reasonable tempos
    let normalized = bpm;
    // Halve or double to bring into 60–200 range
    while (normalized > 200) normalized /= 2;
    while (normalized < 60) normalized *= 2;

    const rounded = Math.round(normalized);
    bins.set(rounded, (bins.get(rounded) ?? 0) + 1);
  }

  // Find the most common BPM
  let bestBpm = 120;
  let bestCount = 0;
  for (const [bpm, count] of bins) {
    if (count > bestCount) {
      bestCount = count;
      bestBpm = bpm;
    }
  }

  return bestBpm;
}

/**
 * Crossfade with BPM matching.
 *
 * Calculates the playbackRate ratio needed to match the outgoing
 * track's tempo to the incoming track's tempo. The speed adjustment
 * is kept within ±8% to avoid noticeable pitch distortion.
 *
 * @param outgoingBpm BPM of the track ending
 * @param incomingBpm BPM of the track starting
 * @returns playbackRate to apply to the outgoing track (1.0 = no change)
 */
export function calcBeatmatchRate(outgoingBpm: number, incomingBpm: number): number {
  if (outgoingBpm <= 0 || incomingBpm <= 0) return 1.0;

  const ratio = incomingBpm / outgoingBpm;

  // Limit speed change to ±8% to avoid noticeable pitch distortion
  return Math.max(0.92, Math.min(1.08, ratio));
}
