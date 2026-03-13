/**
 * LyricsMesh.tsx
 * ─────────────────────────────────────────────────────────────
 * Real-time animated mesh background that "pulses" to the bass.
 *
 * Extracts 4 dominant colors from the album art and renders a
 * Canvas gradient that shifts with the music's frequency data.
 */

import { useRef, useEffect, useCallback } from 'react';
import { audioProcessor } from '@/audio/AudioProcessor';

interface LyricsMeshProps {
  coverUrl: string;
  isPlaying: boolean;
}

/** Extract dominant colors from an image via canvas sampling */
function extractColors(img: HTMLImageElement): string[] {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return ['#fc3c44', '#1a1a2e', '#16213e', '#0f3460'];

  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  // Sample 4 quadrants for color variety
  const quadrants = [
    { x: size * 0.25, y: size * 0.25 },
    { x: size * 0.75, y: size * 0.25 },
    { x: size * 0.25, y: size * 0.75 },
    { x: size * 0.75, y: size * 0.75 },
  ];

  return quadrants.map(({ x, y }) => {
    const idx = (Math.floor(y) * size + Math.floor(x)) * 4;
    return `rgb(${data[idx]}, ${data[idx + 1]}, ${data[idx + 2]})`;
  });
}

export function LyricsMesh({ coverUrl, isPlaying }: LyricsMeshProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef<string[]>(['#fc3c44', '#1a1a2e', '#16213e', '#0f3460']);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  // Load colors from cover
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      colorsRef.current = extractColors(img);
    };
    img.src = coverUrl;
  }, [coverUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const colors = colorsRef.current;

    // Get bass level from AudioProcessor (0-255)
    const bassLevel = audioProcessor.getBassLevel();
    const bassNorm = bassLevel / 255; // 0-1
    const pulse = 0.3 + bassNorm * 0.7; // scale factor for "flash"

    timeRef.current += isPlaying ? 0.008 : 0.002;
    const t = timeRef.current;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw 4 animated gradient blobs
    const blobs = [
      { cx: w * (0.3 + 0.2 * Math.sin(t * 0.7)), cy: h * (0.3 + 0.2 * Math.cos(t * 0.5)), r: w * 0.5 * pulse },
      { cx: w * (0.7 + 0.15 * Math.cos(t * 0.6)), cy: h * (0.3 + 0.2 * Math.sin(t * 0.8)), r: w * 0.45 * pulse },
      { cx: w * (0.3 + 0.2 * Math.cos(t * 0.9)), cy: h * (0.7 + 0.15 * Math.sin(t * 0.4)), r: w * 0.5 * pulse },
      { cx: w * (0.7 + 0.15 * Math.sin(t * 0.5)), cy: h * (0.7 + 0.2 * Math.cos(t * 0.7)), r: w * 0.45 * pulse },
    ];

    blobs.forEach((blob, i) => {
      const grad = ctx.createRadialGradient(blob.cx, blob.cy, 0, blob.cx, blob.cy, blob.r);
      const alpha = 0.4 + bassNorm * 0.3;
      grad.addColorStop(0, colors[i % colors.length].replace('rgb', 'rgba').replace(')', `, ${alpha})`));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });

    animRef.current = requestAnimationFrame(draw);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };
    resize();
    window.addEventListener('resize', resize);

    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.85 }}
      aria-hidden="true"
    />
  );
}
