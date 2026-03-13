/**
 * extractColors.ts
 * ─────────────────────────────────────────────────────────────
 * Extracts dominant colors from an image URL using an offscreen
 * canvas.  Used by NowPlaying to drive the animated mesh-gradient
 * background — similar to Apple Music's "living" colour bleed.
 *
 * Algorithm: downsample the image to 64×64, bucket pixel colours
 * with a simple k-means–like quantisation, then return the top N
 * most frequent & saturated colours.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Load an image onto an offscreen canvas and return its pixel data.
 */
function getImageData(src: string, size = 64): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D not available'));
      ctx.drawImage(img, 0, 0, size, size);
      resolve(ctx.getImageData(0, 0, size, size));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/** Minimum R+G+B sum — pixels darker than this are nearly black and uninteresting */
const MIN_BRIGHTNESS = 45;
/** Maximum R+G+B sum — pixels brighter than this are nearly white and uninteresting */
const MAX_BRIGHTNESS = 720;

/**
 * Simple colour bucketing: round each channel to the nearest
 * multiple of `step` and count occurrences.
 */
function quantize(data: Uint8ClampedArray, step = 32): RGB[] {
  const buckets = new Map<string, { color: RGB; count: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip near-transparent pixels
    if (a < 128) continue;
    // Skip very dark and very light pixels (not interesting for gradients)
    const brightness = r + g + b;
    if (brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS) continue;

    const qr = Math.round(r / step) * step;
    const qg = Math.round(g / step) * step;
    const qb = Math.round(b / step) * step;
    const key = `${qr},${qg},${qb}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.count++;
      // Accumulate actual values for averaging later
      existing.color.r += r;
      existing.color.g += g;
      existing.color.b += b;
    } else {
      buckets.set(key, { color: { r, g, b }, count: 1 });
    }
  }

  // Average each bucket and sort by frequency × saturation
  return [...buckets.values()]
    .map(({ color, count }) => ({
      r: Math.round(color.r / count),
      g: Math.round(color.g / count),
      b: Math.round(color.b / count),
      count,
      saturation: saturationOf(
        Math.round(color.r / count),
        Math.round(color.g / count),
        Math.round(color.b / count),
      ),
    }))
    .sort((a, b) => b.count * (1 + b.saturation) - a.count * (1 + a.saturation))
    .map(({ r, g, b }) => ({ r, g, b }));
}

function saturationOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Extract the N most dominant, vibrant colours from an image URL.
 * Returns CSS `rgb()` strings.
 *
 * Falls back to a default palette if the image cannot be loaded.
 */
export async function extractDominantColors(
  src: string,
  count = 4,
): Promise<string[]> {
  const fallback = [
    'rgb(30, 30, 40)',
    'rgb(60, 30, 80)',
    'rgb(20, 50, 80)',
    'rgb(50, 20, 60)',
  ];

  try {
    const imageData = await getImageData(src);
    const colors = quantize(imageData.data);

    if (colors.length < count) {
      // Not enough distinct colours — pad with fallback
      const result = colors.map((c) => `rgb(${c.r}, ${c.g}, ${c.b})`);
      while (result.length < count) result.push(fallback[result.length % fallback.length]);
      return result;
    }

    return colors.slice(0, count).map((c) => `rgb(${c.r}, ${c.g}, ${c.b})`);
  } catch {
    return fallback.slice(0, count);
  }
}
