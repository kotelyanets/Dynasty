/**
 * TrackHeatmap.tsx — Replay Drops Heatmap Overlay
 * ─────────────────────────────────────────────────────────────
 * Renders a semi-transparent heatmap overlay on the progress bar
 * showing which moments of a track are most frequently seeked to.
 * Inspired by SoundCloud's "hot" sections visualization.
 */

import { useState, useEffect } from 'react';

const BASE_URL: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  '';

interface TrackHeatmapProps {
  trackId: string;
  /** Width of the container in pixels or '100%' */
  className?: string;
}

export function TrackHeatmap({ trackId, className = '' }: TrackHeatmapProps) {
  const [buckets, setBuckets] = useState<number[]>([]);

  useEffect(() => {
    if (!BASE_URL || !trackId) return;

    fetch(`${BASE_URL}/api/seek-events/${trackId}/heatmap?buckets=50`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.buckets)) {
          setBuckets(data.buckets as number[]);
        }
      })
      .catch(() => {});
  }, [trackId]);

  if (buckets.length === 0 || buckets.every((b) => b === 0)) {
    return null; // No data — don't render anything
  }

  return (
    <div className={`flex items-end gap-[1px] h-6 ${className}`} aria-hidden="true">
      {buckets.map((intensity, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px] transition-all duration-300"
          style={{
            height: `${Math.max(2, intensity * 100)}%`,
            backgroundColor: `rgba(252, 60, 68, ${0.15 + intensity * 0.45})`,
          }}
        />
      ))}
    </div>
  );
}
