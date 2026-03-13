/**
 * usePictureInPicture.ts
 * ─────────────────────────────────────────────────────────────
 * Picture-in-Picture hook for the music player.
 *
 * Draws the album cover art and track info onto a hidden canvas,
 * captures it as a video stream, and requests PiP on that video
 * element. Updates the canvas when the track changes.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';

// Canvas dimensions for PiP window
const PIP_WIDTH = 360;
const PIP_HEIGHT = 360;

export function usePictureInPicture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const [isPiPActive, setIsPiPActive] = useState(false);

  const isPiPSupported =
    typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;

  // Create canvas + video elements once
  useEffect(() => {
    if (!isPiPSupported) return;

    const canvas = document.createElement('canvas');
    canvas.width = PIP_WIDTH;
    canvas.height = PIP_HEIGHT;
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.display = 'none';
    document.body.appendChild(video);
    videoRef.current = video;

    // Capture canvas as video stream
    const stream = canvas.captureStream(1); // 1 FPS
    video.srcObject = stream;

    // Listen for PiP events
    video.addEventListener('enterpictureinpicture', () => setIsPiPActive(true));
    video.addEventListener('leavepictureinpicture', () => setIsPiPActive(false));

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      canvas.remove();
      video.remove();
    };
  }, [isPiPSupported]);

  // Draw track info onto canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = usePlayerStore.getState();
    const track = state.currentTrack;

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, PIP_WIDTH, PIP_HEIGHT);

    if (!track) {
      ctx.fillStyle = '#666';
      ctx.font = 'bold 24px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No Track Playing', PIP_WIDTH / 2, PIP_HEIGHT / 2);
      return;
    }

    // Try to draw album art
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Fill with album art
      ctx.drawImage(img, 0, 0, PIP_WIDTH, PIP_HEIGHT);

      // Dark overlay at bottom for text legibility
      const gradient = ctx.createLinearGradient(0, PIP_HEIGHT * 0.5, 0, PIP_HEIGHT);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, PIP_HEIGHT * 0.5, PIP_WIDTH, PIP_HEIGHT * 0.5);

      // Track title
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        truncateText(ctx, track.title, PIP_WIDTH - 40),
        PIP_WIDTH / 2,
        PIP_HEIGHT - 60,
      );

      // Artist name
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '16px -apple-system, sans-serif';
      ctx.fillText(
        truncateText(ctx, track.artist, PIP_WIDTH - 40),
        PIP_WIDTH / 2,
        PIP_HEIGHT - 32,
      );

      // Play state indicator
      if (state.isPlaying) {
        drawPlayingBars(ctx, PIP_WIDTH / 2 - 15, PIP_HEIGHT - 16, 30, 8);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px -apple-system, sans-serif';
        ctx.fillText('PAUSED', PIP_WIDTH / 2, PIP_HEIGHT - 10);
      }
    };
    img.onerror = () => {
      // No art — show text only
      ctx.fillStyle = '#1c1c1e';
      ctx.fillRect(0, 0, PIP_WIDTH, PIP_HEIGHT);

      ctx.fillStyle = '#fc3c44';
      ctx.font = 'bold 64px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♪', PIP_WIDTH / 2, PIP_HEIGHT / 2 - 20);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px -apple-system, sans-serif';
      ctx.fillText(
        truncateText(ctx, track.title, PIP_WIDTH - 40),
        PIP_WIDTH / 2,
        PIP_HEIGHT / 2 + 30,
      );

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '16px -apple-system, sans-serif';
      ctx.fillText(
        truncateText(ctx, track.artist, PIP_WIDTH - 40),
        PIP_WIDTH / 2,
        PIP_HEIGHT / 2 + 56,
      );
    };
    img.src = track.coverUrl;
  }, []);

  // Keep canvas updated when track or play state changes
  useEffect(() => {
    if (!isPiPActive) return;

    const unsub = usePlayerStore.subscribe(
      (s) => ({ id: s.currentTrack?.id, playing: s.isPlaying }),
      () => drawCanvas(),
      { equalityFn: (a, b) => a.id === b.id && a.playing === b.playing },
    );

    // Initial draw
    drawCanvas();

    return unsub;
  }, [isPiPActive, drawCanvas]);

  const togglePiP = useCallback(async () => {
    if (!isPiPSupported) return;
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        drawCanvas();
        // Small delay to ensure canvas has rendered
        await new Promise((r) => setTimeout(r, 100));
        await video.play();
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('[PiP] Failed:', err);
    }
  }, [isPiPSupported, drawCanvas]);

  return { isPiPActive, isPiPSupported, togglePiP };
}

// ── Helpers ─────────────────────────────────────────────────

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

function drawPlayingBars(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.fillStyle = '#fc3c44';
  const barW = width / 5;
  for (let i = 0; i < 3; i++) {
    const barH = height * (0.4 + Math.random() * 0.6);
    ctx.fillRect(x + i * barW * 1.8, y + height - barH, barW, barH);
  }
}
