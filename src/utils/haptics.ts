/**
 * haptics.ts
 * ─────────────────────────────────────────────────────────────
 * Lightweight haptic-feedback utility.
 *
 * Calls `navigator.vibrate()` when available (Android Chrome,
 * Samsung Internet, etc.). On iOS Safari, vibrate() is not
 * supported — the visual "press" effect (active:scale-95) is
 * the only feedback the user receives.
 *
 * Usage:
 *   import { haptic } from '@/utils/haptics';
 *   <button onClick={() => { haptic(); doStuff(); }}>
 */

export function haptic(duration = 10): void {
  try {
    navigator?.vibrate?.([duration]);
  } catch {
    // Silently ignore — vibrate is best-effort
  }
}
