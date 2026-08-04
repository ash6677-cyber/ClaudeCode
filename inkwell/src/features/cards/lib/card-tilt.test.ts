import { describe, expect, it } from 'vitest'

import { frameVars, MAX_TILT_DEG, motionAllowed, REST_FRAME, tiltFrame } from './card-tilt'

describe('tiltFrame', () => {
  it('is perfectly still with the pointer dead centre', () => {
    const f = tiltFrame(0.5, 0.5)
    expect(f.tiltX).toBe(0)
    expect(f.tiltY).toBe(0)
  })

  it('leans toward the pointer, not away from it', () => {
    // The sign convention is the whole feature: a card that leans away reads
    // as flinching, not as being pressed. Pointer at the top presses the top
    // toward the viewer (positive rotateX); pointer at the right turns the
    // card positive about Y.
    expect(tiltFrame(0.5, 0).tiltX).toBeGreaterThan(0)
    expect(tiltFrame(0.5, 1).tiltX).toBeLessThan(0)
    expect(tiltFrame(1, 0.5).tiltY).toBeGreaterThan(0)
    expect(tiltFrame(0, 0.5).tiltY).toBeLessThan(0)
  })

  it('never exceeds the maximum, even for positions past the edge', () => {
    // Pointer capture reports coordinates outside the element mid-gesture.
    for (const [x, y] of [[-3, 0.5], [4, 0.5], [0.5, -1], [0.5, 9], [12, -12]]) {
      const f = tiltFrame(x, y)
      expect(Math.abs(f.tiltX)).toBeLessThanOrEqual(MAX_TILT_DEG)
      expect(Math.abs(f.tiltY)).toBeLessThanOrEqual(MAX_TILT_DEG)
      expect(f.shineX).toBeGreaterThanOrEqual(0)
      expect(f.shineX).toBeLessThanOrEqual(100)
    }
  })

  it('puts the shine under the pointer', () => {
    const f = tiltFrame(0.25, 0.8)
    expect(f.shineX).toBe(25)
    expect(f.shineY).toBe(80)
  })

  it('reaches full lean exactly at the edges', () => {
    expect(tiltFrame(1, 0.5).tiltY).toBe(MAX_TILT_DEG)
    expect(tiltFrame(0.5, 0).tiltX).toBe(MAX_TILT_DEG)
  })
})

describe('motionAllowed', () => {
  it('stops for the operating system', () => {
    expect(motionAllowed(true, '1')).toBe(false)
  })

  it('stops for a theme with motion at zero — a preference, not only a11y', () => {
    expect(motionAllowed(false, '0')).toBe(false)
    expect(motionAllowed(false, '-1')).toBe(false)
  })

  it('runs otherwise, including when the scale is missing or garbled', () => {
    // An unreadable motion scale means the stylesheet default of 1, and the
    // default is moving. Failing closed here would quietly kill the feature
    // for everyone whose theme never set the property.
    expect(motionAllowed(false, '1')).toBe(true)
    expect(motionAllowed(false, '0.6')).toBe(true)
    expect(motionAllowed(false, '')).toBe(true)
    expect(motionAllowed(false, 'garbage')).toBe(true)
  })
})

describe('frameVars', () => {
  it('writes tilt unitless and shine as a percentage', () => {
    // Unitless because the stylesheet spends the same number twice — once as
    // degrees on the card, once as pixels in the parallax — and calc() can
    // scale a number into a unit but never convert between two.
    const vars = frameVars(tiltFrame(1, 0))
    expect(vars['--card-tilt-y']).toMatch(/^-?[\d.]+$/)
    expect(vars['--card-shine-x']).toMatch(/%$/)
  })

  it('the rest frame really is at rest, with the shine parked where CSS parks it', () => {
    // The stylesheet's static default is 30%/18%; leaving via JS must land on
    // the same spot or every card shifts its highlight the first time it is
    // ever hovered.
    const vars = frameVars(REST_FRAME)
    expect(vars['--card-tilt-x']).toBe('0.00')
    expect(vars['--card-tilt-y']).toBe('0.00')
    expect(vars['--card-shine-x']).toBe('30.0%')
    expect(vars['--card-shine-y']).toBe('18.0%')
  })
})
