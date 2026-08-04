/**
 * The geometry of a card responding to a pointer.
 *
 * Pure arithmetic, separated from the DOM so the interesting decisions — how
 * far a card leans, which way, where the light goes — are testable without a
 * browser. The component's job is only to feed pointer positions in and write
 * the answers onto the element.
 *
 * The card leans *toward* the pointer, like a physical card pressed at that
 * corner, and the shine sits *under* it, like a light source it is being
 * turned against. Getting either backwards is the difference between an
 * object and a screen effect, and it is exactly the kind of sign error a
 * unit test is for.
 */

export interface TiltFrame {
  /** Rotation about the X axis in degrees. Positive leans the top away. */
  tiltX: number
  /** Rotation about the Y axis in degrees. Positive turns the right edge away. */
  tiltY: number
  /** Where the shine sits, as percentages of the card. */
  shineX: number
  shineY: number
}

/**
 * Shallow on purpose. A playing card in a hand tips a few degrees; 20° is a
 * door swinging. Past ~8° the foreshortening also starts cropping the
 * portrait against the frame.
 */
export const MAX_TILT_DEG = 6

/** The frame for a pointer at (px, py), both 0–1 across the card. */
export function tiltFrame(px: number, py: number): TiltFrame {
  // Clamped rather than trusted: pointer capture can report positions past
  // the edges mid-gesture, and 1.4 of a card is 8.4 degrees of nonsense.
  const x = Math.min(1, Math.max(0, px))
  const y = Math.min(1, Math.max(0, py))
  return {
    // Pointer at the top (y=0) presses the top toward the viewer: positive
    // rotateX. Pointer at the right (x=1) presses the right side down:
    // negative rotateY... which on screen *is* rotateY(+) — the right edge
    // recedes when rotateY is negative, so leaning toward a right-side
    // pointer means turning positive. Hence (x - 0.5), not (0.5 - x).
    tiltX: (0.5 - y) * 2 * MAX_TILT_DEG,
    tiltY: (x - 0.5) * 2 * MAX_TILT_DEG,
    // The shine tracks the pointer directly: it reads as the reflection of a
    // light the pointer is holding.
    shineX: x * 100,
    shineY: y * 100,
  }
}

/** Where everything goes when the pointer leaves. */
export const REST_FRAME: TiltFrame = { tiltX: 0, tiltY: 0, shineX: 30, shineY: 18 }

/**
 * Whether motion should run at all.
 *
 * Two separate switches, both honoured: the operating system's reduced-motion
 * setting, and the theme's own motion dial at zero (a real preference, not
 * only an accessibility one). `--motion-scale` arrives as a string straight
 * off computed style.
 */
export function motionAllowed(prefersReduced: boolean, motionScale: string): boolean {
  if (prefersReduced) return false
  const scale = Number.parseFloat(motionScale)
  return !(Number.isFinite(scale) && scale <= 0)
}

/**
 * The custom properties a frame writes onto the card element.
 *
 * Tilt is written unitless on purpose: the stylesheet multiplies the same
 * number by `1deg` to lean the card and by pixels to slide the parallax
 * layer, and `calc()` can scale a bare number into any unit but cannot
 * convert between two. Shine is a background position, so it stays `%`.
 */
export function frameVars(frame: TiltFrame): Record<string, string> {
  return {
    '--card-tilt-x': frame.tiltX.toFixed(2),
    '--card-tilt-y': frame.tiltY.toFixed(2),
    '--card-shine-x': `${frame.shineX.toFixed(1)}%`,
    '--card-shine-y': `${frame.shineY.toFixed(1)}%`,
  }
}
