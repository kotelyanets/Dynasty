/**
 * SpectrumBars.tsx
 * ─────────────────────────────────────────────────────────────
 * Compact frequency-bar visualiser that dances in time with the
 * playing track.  Designed to overlay on album art or sit beside
 * the track title in the MiniPlayer / NowPlaying views.
 *
 * Props:
 *   barCount  — number of bars (default 5)
 *   height    — container height in px (default 20)
 *   gap       — gap between bars in px (default 2)
 *   color     — CSS colour for bars (default white at 80% opacity)
 *   className — extra classes on the root container
 */

import { memo } from 'react';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';

interface SpectrumBarsProps {
  barCount?: number;
  height?: number;
  gap?: number;
  color?: string;
  className?: string;
}

export const SpectrumBars = memo(function SpectrumBars({
  barCount = 5,
  height = 20,
  gap = 2,
  color = 'rgba(255,255,255,0.8)',
  className = '',
}: SpectrumBarsProps) {
  const bars = useAudioAnalyser(barCount);

  return (
    <div
      className={`flex items-end ${className}`}
      style={{ height, gap }}
      aria-hidden="true"
    >
      {bars.map((value, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${Math.max(10, value * 100)}%`,
            backgroundColor: color,
            borderRadius: 1,
            transition: 'height 0.08s ease-out',
          }}
        />
      ))}
    </div>
  );
});
