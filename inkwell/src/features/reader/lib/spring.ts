/**
 * A damped spring, integrated at a fixed timestep.
 *
 * The page turn used to finish with a fixed-duration ease, which is why it
 * felt mechanical: flick the sheet hard or barely nudge it and you got the
 * same animation, always starting from a dead stop. Paper doesn't do that —
 * it keeps the speed you gave it and slows under its own weight. A spring
 * seeded with the release velocity does exactly that, and it also means an
 * interrupted turn resumes from wherever it actually is, at whatever speed
 * it actually had, rather than restarting a tween.
 *
 * Integration is sub-stepped at a fixed interval rather than using the raw
 * frame delta. A stiff spring stepped with a 50ms frame — a dropped frame,
 * a background tab, a slow phone — goes unstable and explodes; fixed steps
 * stay well-behaved and make the motion identical at 60Hz and 120Hz.
 */

/** Seconds. 240Hz is comfortably stable for the stiffnesses used here. */
const STEP = 1 / 240
/** Never simulate more than this per frame, so a long stall can't lock up. */
const MAX_FRAME = 0.064

export interface SpringConfig {
  stiffness: number
  damping: number
}

/**
 * Critically damped: reaches rest as fast as possible without overshooting.
 * A page settling closed must not bounce back open, so overshoot is a bug
 * here rather than a flourish.
 */
export function criticalDamping(stiffness: number): number {
  return 2 * Math.sqrt(stiffness)
}

export interface SpringState {
  value: number
  velocity: number
}

/**
 * Advances a spring toward `target` by `dt` seconds.
 *
 * Velocity is in value-units per second, which is what makes the handoff
 * from a drag exact: convert the pointer's speed into progress per second
 * and the sheet leaves your finger at precisely the speed it was moving.
 */
export function stepSpring(
  state: SpringState,
  target: number,
  dt: number,
  { stiffness, damping }: SpringConfig,
): SpringState {
  let { value, velocity } = state
  let remaining = Math.min(dt, MAX_FRAME)

  while (remaining > 0) {
    const h = Math.min(STEP, remaining)
    const acceleration = -stiffness * (value - target) - damping * velocity
    velocity += acceleration * h
    value += velocity * h
    remaining -= h
  }

  return { value, velocity }
}

/** Close enough to rest that another frame would not be visible. */
export function isSpringAtRest(
  state: SpringState,
  target: number,
  epsilon = 0.0015,
  velocityEpsilon = 0.02,
): boolean {
  return Math.abs(state.value - target) < epsilon && Math.abs(state.velocity) < velocityEpsilon
}
