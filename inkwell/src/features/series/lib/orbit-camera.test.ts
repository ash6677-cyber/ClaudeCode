import { describe, expect, it } from 'vitest'

import {
  applyDrag,
  applyFlick,
  applyZoom,
  cameraPosition,
  clampPolar,
  createOrbitState,
  isOrbiting,
  stepOrbit,
  type OrbitState,
} from './orbit-camera'

const LIMITS = { minDistance: 20, maxDistance: 200 }

/** Runs a coast to a stop, returning how long it took and how far it turned. */
function coast(state: OrbitState, dt = 1 / 60, maxFrames = 2000) {
  const start = state.azimuth
  let current = state
  let frames = 0
  while (frames < maxFrames && isOrbiting(current)) {
    current = stepOrbit(current, dt)
    frames++
  }
  return { state: current, seconds: frames * dt, turned: current.azimuth - start }
}

describe('applyDrag', () => {
  it('turns the set the way the finger moves', () => {
    // Dragging right must bring the set's left side into view, which means
    // the camera goes the other way. Backwards here is the single most
    // common way an orbit control feels wrong.
    const start = createOrbitState(60)
    expect(applyDrag(start, 100, 0).azimuth).toBeLessThan(start.azimuth)
    expect(applyDrag(start, -100, 0).azimuth).toBeGreaterThan(start.azimuth)
  })

  it('drags up to look down on the set', () => {
    const start = createOrbitState(60)
    // Polar is measured from straight up, so looking down means a smaller angle.
    expect(applyDrag(start, 0, 100).polar).toBeLessThan(start.polar)
  })

  it('scales with the distance dragged', () => {
    const start = createOrbitState(60)
    const small = start.azimuth - applyDrag(start, 50, 0).azimuth
    const large = start.azimuth - applyDrag(start, 100, 0).azimuth
    expect(large).toBeCloseTo(small * 2, 6)
  })

  it('spins freely around, with no wall at the seam', () => {
    // Horizontal rotation is unbounded on purpose: "viewed from all sides"
    // means you can keep going, not that you hit a stop at 180°.
    let state = createOrbitState(60)
    for (let i = 0; i < 40; i++) state = applyDrag(state, 200, 0)
    expect(Math.abs(state.azimuth)).toBeGreaterThan(2 * Math.PI)
  })

  it('stops short of the poles by enough to keep the view upright', () => {
    // Near a pole the camera's roll stops being determined and the set tips
    // over sideways in the frame. A single degree of clearance was not
    // enough in practice — a flick that ran into the limit produced exactly
    // that, in the viewport and in exported renders alike.
    let up = createOrbitState(60)
    let down = createOrbitState(60)
    for (let i = 0; i < 50; i++) {
      up = applyDrag(up, 0, 500)
      down = applyDrag(down, 0, -500)
    }
    expect(up.polar).toBeGreaterThan(0.1)
    expect(down.polar).toBeLessThan(Math.PI - 0.1)
    // Still steep enough to look down on the lid and up at the base.
    expect(up.polar).toBeLessThan(0.25)
    expect(down.polar).toBeGreaterThan(Math.PI - 0.25)
  })

  it('grabbing a coasting set stops it dead', () => {
    const flicked = applyFlick(createOrbitState(60), 900, 0)
    expect(isOrbiting(flicked)).toBe(true)
    expect(isOrbiting(applyDrag(flicked, 1, 0))).toBe(false)
  })
})

describe('applyZoom', () => {
  it('covers the same proportion at any distance', () => {
    // Multiplicative rather than additive, so one notch of the wheel feels
    // the same up close as it does far out.
    const near = applyZoom({ ...createOrbitState(40) }, 1.1, LIMITS)
    const far = applyZoom({ ...createOrbitState(120) }, 1.1, LIMITS)
    expect(near.distance / 40).toBeCloseTo(far.distance / 120, 9)
  })

  it('will not let the camera inside the box or lose it entirely', () => {
    let state = createOrbitState(60)
    for (let i = 0; i < 60; i++) state = applyZoom(state, 0.8, LIMITS)
    expect(state.distance).toBe(LIMITS.minDistance)
    for (let i = 0; i < 60; i++) state = applyZoom(state, 1.25, LIMITS)
    expect(state.distance).toBe(LIMITS.maxDistance)
  })
})

describe('stepOrbit', () => {
  it('coasts after a flick and then stops', () => {
    const { seconds, turned, state } = coast(applyFlick(createOrbitState(60), -900, 0))
    expect(turned).toBeGreaterThan(0.3)
    expect(seconds).toBeGreaterThan(0.3)
    expect(seconds).toBeLessThan(3)
    expect(isOrbiting(state)).toBe(false)
  })

  it('a harder flick travels further', () => {
    const gentle = coast(applyFlick(createOrbitState(60), -300, 0))
    const hard = coast(applyFlick(createOrbitState(60), -1200, 0))
    expect(Math.abs(hard.turned)).toBeGreaterThan(Math.abs(gentle.turned))
  })

  it('coasts the same distance at 60Hz and 120Hz', () => {
    // Frame-rate independence: the set must not spin twice as far on a
    // high-refresh phone as it does on a laptop.
    const at60 = coast(applyFlick(createOrbitState(60), -900, 0), 1 / 60)
    const at120 = coast(applyFlick(createOrbitState(60), -900, 0), 1 / 120)
    expect(Math.abs(at60.turned - at120.turned)).toBeLessThan(0.001)
  })

  it('survives a long stall without flinging the camera', () => {
    const stalled = stepOrbit(applyFlick(createOrbitState(60), -2000, 0), 2.5)
    expect(Number.isFinite(stalled.azimuth)).toBe(true)
    expect(Math.abs(stalled.azimuth - createOrbitState(60).azimuth)).toBeLessThan(1)
  })

  it('is a no-op when nothing is moving', () => {
    const still = createOrbitState(60)
    expect(stepOrbit(still, 1 / 60)).toBe(still)
  })

  it('stops the vertical coast at a pole instead of pressing into it', () => {
    const state: OrbitState = {
      ...createOrbitState(60),
      polar: 0.02,
      azimuthVelocity: 0,
      polarVelocity: -4,
    }
    const stepped = stepOrbit(state, 1 / 60)
    expect(stepped.polar).toBe(clampPolar(stepped.polar))
    expect(stepped.polarVelocity).toBe(0)
  })
})

describe('cameraPosition', () => {
  it('sits at the requested distance whatever the angles', () => {
    for (const polar of [0.2, 1, 2, 3]) {
      for (const azimuth of [-3, 0, 1.5, 7]) {
        const p = cameraPosition({ ...createOrbitState(75), azimuth, polar })
        expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(75, 6)
      }
    }
  })

  it('starts in front of the set, slightly above and to one side', () => {
    // The catalogue three-quarter view: front cover and one side both
    // visible, so the set reads as an object rather than a flat image.
    const p = cameraPosition(createOrbitState(60))
    expect(p.z).toBeGreaterThan(0)
    expect(p.y).toBeGreaterThan(0)
    expect(Math.abs(p.x)).toBeGreaterThan(1)
  })

  it('reaches the back of the set after half a turn', () => {
    const front = cameraPosition(createOrbitState(60))
    const back = cameraPosition({ ...createOrbitState(60), azimuth: createOrbitState(60).azimuth + Math.PI })
    expect(Math.sign(back.z)).toBe(-Math.sign(front.z))
  })

  it('looks down from above and up from below', () => {
    expect(cameraPosition({ ...createOrbitState(60), polar: 0.1 }).y).toBeGreaterThan(0)
    expect(cameraPosition({ ...createOrbitState(60), polar: Math.PI - 0.1 }).y).toBeLessThan(0)
  })
})
