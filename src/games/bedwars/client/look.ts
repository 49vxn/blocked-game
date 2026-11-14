/**
 * Mouse-look delta safety.
 *
 * A browser can emit one enormous `movementX/Y` when pointer lock is acquired
 * or when a high-DPI driver coalesces a fast flick. Applying that raw snaps the
 * camera (the reported 180). The earlier fix dropped every event above a
 * threshold, which froze the camera on mice that always report large deltas.
 * This clamps instead: every event keeps its direction and still turns the
 * view, just never by more than one bounded step.
 */

/** Largest turn one event may contribute. At default sensitivity this is about 36 degrees. */
export const MAX_LOOK_DELTA = 180

/** Clamp one event. Non-finite values are the only ones ignored. */
export function clampLookDelta(x: number, y: number): { x: number; y: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return {
    x: Math.max(-MAX_LOOK_DELTA, Math.min(MAX_LOOK_DELTA, x)),
    y: Math.max(-MAX_LOOK_DELTA, Math.min(MAX_LOOK_DELTA, y)),
  }
}
