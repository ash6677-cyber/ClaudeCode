import { describe, expect, it } from 'vitest'

import { criticalDamping, isSpringAtRest, stepSpring, type SpringState } from './spring'

/** Runs a spring to rest, returning the frames it took and the path taken. */
function simulate(
  from: number,
  velocity: number,
  target: number,
  stiffness = 130,
  dt = 1 / 60,
  maxFrames = 600,
) {
  const config = { stiffness, damping: criticalDamping(stiffness) }
  let state: SpringState = { value: from, velocity }
  const path = [state.value]
  let frames = 0
  while (frames < maxFrames && !isSpringAtRest(state, target)) {
    state = stepSpring(state, target, dt, config)
    path.push(state.value)
    frames++
  }
  return { state, frames, path }
}

describe('stepSpring', () => {
  it('comes to rest at the target', () => {
    const { state, frames } = simulate(0, 0, 1)
    expect(frames).toBeLessThan(600)
    expect(state.value).toBeCloseTo(1, 2)
    expect(Math.abs(state.velocity)).toBeLessThan(0.02)
  })

  it('does not overshoot when critically damped', () => {
    // A page settling closed must not bounce back open, so this is a
    // correctness property rather than a matter of taste.
    const { path } = simulate(0, 0, 1)
    expect(Math.max(...path)).toBeLessThanOrEqual(1.0001)
  })

  it('carries release velocity — a flick arrives sooner than a nudge', () => {
    const thrown = simulate(0.5, 4, 1).frames
    const released = simulate(0.5, 0, 1).frames
    expect(thrown).toBeLessThan(released)
  })

  it('can be thrown to a target it was moving away from', () => {
    // Dragged backwards then flicked forwards: the spring has to reverse.
    const { state } = simulate(0.6, -3, 1)
    expect(state.value).toBeCloseTo(1, 2)
  })

  it('produces the same motion at 60Hz and 120Hz', () => {
    // Fixed sub-stepping exists for exactly this: the turn must not be
    // faster on a high-refresh phone than on a laptop.
    const at60 = simulate(0, 2, 1, 130, 1 / 60)
    const at120 = simulate(0, 2, 1, 130, 1 / 120)
    const seconds60 = at60.frames / 60
    const seconds120 = at120.frames / 120
    expect(Math.abs(seconds60 - seconds120)).toBeLessThan(0.05)
  })

  it('stays stable across a dropped frame', () => {
    // A 250ms stall used to be enough to make a stiff spring explode.
    const config = { stiffness: 210, damping: criticalDamping(210) }
    let state: SpringState = { value: 0, velocity: 0 }
    state = stepSpring(state, 1, 0.25, config)
    expect(Number.isFinite(state.value)).toBe(true)
    expect(Math.abs(state.value)).toBeLessThan(2)
  })

  it('a stiffer spring settles faster', () => {
    expect(simulate(0, 0, 1, 210).frames).toBeLessThan(simulate(0, 0, 1, 130).frames)
  })
})

describe('isSpringAtRest', () => {
  it('is false while still travelling, even if momentarily at the target', () => {
    expect(isSpringAtRest({ value: 1, velocity: 3 }, 1)).toBe(false)
  })

  it('is false while near the target but still moving perceptibly', () => {
    expect(isSpringAtRest({ value: 0.999, velocity: 0.5 }, 1)).toBe(false)
  })

  it('is true once both position and speed have settled', () => {
    expect(isSpringAtRest({ value: 0.9999, velocity: 0.001 }, 1)).toBe(true)
  })
})
