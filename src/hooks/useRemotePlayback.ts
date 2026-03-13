/**
 * useRemotePlayback.ts
 * ─────────────────────────────────────────────────────────────
 * Integration with AirPlay and Smart TVs via the Remote Playback API.
 *
 * The Remote Playback API lets the browser hand off media playback
 * to external devices (Apple TV, AirPlay speakers, Chromecast, etc.)
 * that Safari discovers on the local network.
 *
 * Safari on iOS supports this natively — when available, we show a
 * "Cast" button that triggers the system device picker.
 */

import { useState, useEffect, useCallback } from 'react';
import { audioEl } from '@/store/playerStore';

export function useRemotePlayback() {
  const [available, setAvailable] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const remote = (audioEl as HTMLMediaElement & { remote?: RemotePlayback }).remote;
    if (!remote) {
      setAvailable(false);
      return;
    }

    // Check initial state
    const updateState = () => {
      setConnected(remote.state === 'connected');
    };

    // Watch for availability changes
    remote.watchAvailability((isAvailable) => {
      setAvailable(isAvailable);
    }).catch(() => {
      // watchAvailability not supported — assume available
      setAvailable(true);
    });

    remote.addEventListener('connecting', updateState);
    remote.addEventListener('connect', updateState);
    remote.addEventListener('disconnect', updateState);

    updateState();

    return () => {
      remote.removeEventListener('connecting', updateState);
      remote.removeEventListener('connect', updateState);
      remote.removeEventListener('disconnect', updateState);
      remote.cancelWatchAvailability().catch(() => {});
    };
  }, []);

  const prompt = useCallback(async () => {
    const remote = (audioEl as HTMLMediaElement & { remote?: RemotePlayback }).remote;
    if (!remote) return;

    try {
      await remote.prompt();
    } catch (err) {
      // User cancelled the picker — not an error
      if ((err as DOMException).name !== 'NotAllowedError') {
        console.warn('[RemotePlayback] prompt failed:', err);
      }
    }
  }, []);

  return { available, connected, prompt };
}
