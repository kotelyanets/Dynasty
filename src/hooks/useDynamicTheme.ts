/**
 * useDynamicTheme.ts — Dynamic Theme (Contextual Colors)
 * ─────────────────────────────────────────────────────────────
 * Extracts the dominant color from the current track's album art
 * and applies it as CSS variables on the document root.
 *
 * The color is used to tint UI elements (buttons, backgrounds,
 * sliders) to match the currently playing track's aesthetic.
 *
 * CSS variables set:
 *   --brand-color: rgb(r, g, b)
 *   --brand-color-light: rgba(r, g, b, 0.3)
 *   --brand-color-dark: rgba(r, g, b, 0.8)
 */

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';

interface RGB {
  r: number;
  g: number;
  b: number;
}

const DEFAULT_COLOR: RGB = { r: 252, g: 60, b: 68 }; // #fc3c44

/**
 * Extract the dominant color from an image using a canvas.
 * This is a lightweight alternative to color-thief that works
 * without any external dependencies.
 */
function extractDominantColor(imageUrl: string): Promise<RGB> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_COLOR);
          return;
        }

        // Sample at a small size for performance
        const sampleSize = 10;
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;

        let r = 0, g = 0, b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          // Skip very dark and very light pixels
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (brightness < 30 || brightness > 225) continue;

          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }

        if (count === 0) {
          resolve(DEFAULT_COLOR);
          return;
        }

        // Boost saturation slightly for more vibrant UI
        const result: RGB = {
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count),
        };

        // Ensure the color has enough saturation
        const max = Math.max(result.r, result.g, result.b);
        const min = Math.min(result.r, result.g, result.b);
        if (max - min < 30) {
          // Too grey — use default brand color
          resolve(DEFAULT_COLOR);
          return;
        }

        resolve(result);
      } catch {
        resolve(DEFAULT_COLOR);
      }
    };
    img.onerror = () => resolve(DEFAULT_COLOR);
    img.src = imageUrl;
  });
}

function applyThemeColor(color: RGB): void {
  const root = document.documentElement;
  root.style.setProperty('--brand-color', `rgb(${color.r}, ${color.g}, ${color.b})`);
  root.style.setProperty('--brand-color-light', `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`);
  root.style.setProperty('--brand-color-dark', `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`);
}

export function useDynamicTheme(): void {
  const lastCoverRef = useRef<string>('');

  useEffect(() => {
    // Apply default on mount
    applyThemeColor(DEFAULT_COLOR);

    const unsub = usePlayerStore.subscribe(
      (state) => state.currentTrack?.coverUrl ?? '',
      (coverUrl) => {
        if (!coverUrl || coverUrl === lastCoverRef.current) return;
        lastCoverRef.current = coverUrl;

        extractDominantColor(coverUrl)
          .then((color) => applyThemeColor(color))
          .catch(() => applyThemeColor(DEFAULT_COLOR));
      }
    );

    return unsub;
  }, []);
}
