/**
 * Orbit camera state, as arithmetic.
 *
 * The camera lives on a sphere around the box set: `azimuth` runs around it,
 * `polar` from directly overhead to directly underneath, `distance` in and
 * out. Drag changes the first two, wheel or pinch the third.
 *
 * Kept free of three.js so the feel of the thing — how far a drag turns it,
 * how it coasts, where it refuses to go — can be tested without a GPU. The
 * renderer's only job is to read `cameraPosition` each frame.
 */

export interface OrbitState {
  /** Radians around the vertical axis. Unbounded: the set spins freely. */
  azimuth: number
  /** Radians from straight up. Clamped short of the poles. */
  polar: number
  /** Camera distance from the centre, in scene units (cm). */
  distance: number
  /** Radians per second, carried after a flick. */
  azimuthVelocity: number
  polarVelocity: number
}

export interface OrbitLimits {
  minDistance: number
  maxDistance: number
}

/**
 * How close to the poles the camera may get, in radians (~7°).
 *
 * Approaching a pole the view direction becomes parallel to the up vector and
 * the camera's roll stops being defined: `lookAt` still returns an
 * orientation, but which one depends on floating-point noise, so the set
 * appears to spin in the plane of the screen for no reason. One degree of
 * clearance was not enough — a flick that ran into the limit left the camera
 * hard against it and the whole box tipped over sideways in the frame,
 * which also came out in exported renders. Seven degrees still looks
 * essentially straight down at the top of the case while keeping the
 * orientation firmly determined.
 */
const POLAR_EPSILON = 0.12

/** Radians of rotation per pixel dragged. */
const DRAG_SENSITIVITY = 0.0075

/**
 * How quickly a flick decays, as the fraction of its speed surviving each
 * second. Tuned by hand: a coast that stops dead feels mechanical and one
 * that drifts for five seconds feels like the app is ignoring you.
 */
const FRICTION_PER_SECOND = 0.0016

/** Below this the coast is over; keeping it alive only burns frames. */
const MIN_VELOCITY = 0.002

/** Longest step the integrator will take, so a stall can't fling the camera. */
const MAX_FRAME = 0.064

export function createOrbitState(distance: number): OrbitState {
  return {
    // Three-quarter view: the front cover and one side of the case both
    // visible, which is how a box set is photographed for a catalogue and
    // reads as solid immediately. Straight on, it could be a flat image.
    azimuth: -Math.PI / 5,
    polar: Math.PI / 2 - 0.18,
    distance,
    azimuthVelocity: 0,
    polarVelocity: 0,
  }
}

export function clampPolar(polar: number): number {
  return Math.min(Math.PI - POLAR_EPSILON, Math.max(POLAR_EPSILON, polar))
}

export function clampDistance(distance: number, limits: OrbitLimits): number {
  return Math.min(limits.maxDistance, Math.max(limits.minDistance, distance))
}

/**
 * Applies a drag of `dx`/`dy` pixels.
 *
 * Dragging right turns the set to the right, which means the *camera* goes
 * left — the object follows the finger, not the viewpoint. Getting this
 * backwards is the single most common way an orbit control feels wrong.
 */
export function applyDrag(state: OrbitState, dx: number, dy: number): OrbitState {
  return {
    ...state,
    azimuth: state.azimuth - dx * DRAG_SENSITIVITY,
    polar: clampPolar(state.polar - dy * DRAG_SENSITIVITY),
    azimuthVelocity: 0,
    polarVelocity: 0,
  }
}

/** Converts a release gesture in pixels/second into a coasting spin. */
export function applyFlick(state: OrbitState, dxPerSecond: number, dyPerSecond: number): OrbitState {
  return {
    ...state,
    azimuthVelocity: -dxPerSecond * DRAG_SENSITIVITY,
    polarVelocity: -dyPerSecond * DRAG_SENSITIVITY,
  }
}

/**
 * Zooms by a multiplicative factor.
 *
 * Multiplicative, not additive: a notch of the wheel should cover the same
 * proportion of the remaining distance whether you are up close or far out,
 * which is what makes zoom feel even across its whole range.
 */
export function applyZoom(state: OrbitState, factor: number, limits: OrbitLimits): OrbitState {
  return { ...state, distance: clampDistance(state.distance * factor, limits) }
}

/** Advances a coasting camera by `dt` seconds. Idle when not coasting. */
export function stepOrbit(state: OrbitState, dt: number): OrbitState {
  if (!isOrbiting(state)) {
    return state.azimuthVelocity === 0 && state.polarVelocity === 0
      ? state
      : { ...state, azimuthVelocity: 0, polarVelocity: 0 }
  }

  const step = Math.min(Math.max(dt, 0), MAX_FRAME)
  const decay = Math.pow(FRICTION_PER_SECOND, step)

  // Distance travelled while decaying, integrated exactly rather than
  // stepped: with v(t) = v₀·kᵗ, ∫₀ᵈᵗ v = v₀·(k^dt − 1)/ln k. Taking the
  // Euler shortcut and multiplying the frame's starting velocity by its
  // length overshoots by about 3% at 60Hz and half that at 120Hz, so the
  // same flick travelled visibly further on the slower display. Closed form
  // is both cheaper than sub-stepping and exact at any frame length.
  const travel = (decay - 1) / Math.log(FRICTION_PER_SECOND)

  const unclampedPolar = state.polar + state.polarVelocity * travel
  const polar = clampPolar(unclampedPolar)

  return {
    ...state,
    azimuth: state.azimuth + state.azimuthVelocity * travel,
    polar,
    azimuthVelocity: state.azimuthVelocity * decay,
    // Running into a pole ends the vertical coast rather than letting it
    // press silently against the limit for another second.
    polarVelocity: polar !== unclampedPolar ? 0 : state.polarVelocity * decay,
  }
}

export function isOrbiting(state: OrbitState): boolean {
  return (
    Math.abs(state.azimuthVelocity) > MIN_VELOCITY || Math.abs(state.polarVelocity) > MIN_VELOCITY
  )
}

/** Cartesian position of the camera, with Y up and the set at the origin. */
export function cameraPosition(state: OrbitState): { x: number; y: number; z: number } {
  const sinPolar = Math.sin(state.polar)
  return {
    x: state.distance * sinPolar * Math.sin(state.azimuth),
    y: state.distance * Math.cos(state.polar),
    z: state.distance * sinPolar * Math.cos(state.azimuth),
  }
}
