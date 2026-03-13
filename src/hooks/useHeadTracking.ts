/**
 * useHeadTracking.ts
 * ─────────────────────────────────────────────────────────────
 * Fake Spatial Audio / Head Tracking.
 *
 * Uses the DeviceOrientation API (gyroscope) to detect head turns
 * and shifts the stereo field via a StereoPannerNode so the sound
 * stage feels anchored in space — like musicians standing in front
 * of you.
 *
 * When the user turns their head (phone) left, the sound shifts
 * right, and vice versa, mimicking Spatial Audio behavior.
 *
 * iOS note: DeviceOrientationEvent.requestPermission() is required
 * on iOS 13+ — we call it from a user gesture handler (the enable
 * function returned from this hook).
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { setStereoPan, isAudioPipelineReady } from '@/audio/audioNodes';

/** Maximum pan deflection (0..1). 0.6 keeps it subtle. */
const MAX_PAN = 0.6;

/**
 * How many degrees of head rotation maps to full pan.
 * ±30° of rotation → full left/right pan.
 */
const ROTATION_RANGE = 30;

export function useHeadTracking() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const baselineAlpha = useRef<number | null>(null);

  // Check support on mount
  useEffect(() => {
    setSupported('DeviceOrientationEvent' in window);
  }, []);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (!isAudioPipelineReady()) return;

    const alpha = event.alpha; // 0–360 compass heading
    if (alpha === null) return;

    // Set baseline on first reading so current position = center
    if (baselineAlpha.current === null) {
      baselineAlpha.current = alpha;
    }

    // Calculate relative rotation from baseline
    let delta = alpha - baselineAlpha.current;

    // Wrap around 360° boundary
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // Normalize to -1..1 range, then clamp
    // Turning head LEFT (positive delta) should pan sound RIGHT (positive pan)
    const normalized = Math.max(-1, Math.min(1, delta / ROTATION_RANGE));
    const pan = normalized * MAX_PAN;

    setStereoPan(pan);
  }, []);

  const enable = useCallback(async () => {
    if (!supported) return false;

    // iOS 13+ requires explicit permission
    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        if (result !== 'granted') return false;
      } catch {
        return false;
      }
    }

    baselineAlpha.current = null;
    window.addEventListener('deviceorientation', handleOrientation);
    setEnabled(true);
    return true;
  }, [supported, handleOrientation]);

  const disable = useCallback(() => {
    window.removeEventListener('deviceorientation', handleOrientation);
    setStereoPan(0); // reset to center
    baselineAlpha.current = null;
    setEnabled(false);
  }, [handleOrientation]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (enabled) {
        window.removeEventListener('deviceorientation', handleOrientation);
        setStereoPan(0);
      }
    };
  }, [enabled, handleOrientation]);

  return { enabled, supported, enable, disable };
}
