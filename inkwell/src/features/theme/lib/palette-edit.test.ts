import { describe, expect, it } from 'vitest'

import {
  clearColor,
  effectiveColor,
  effectiveValue,
  isOverridden,
  overrideCount,
  pruneRedundant,
  rotatePalette,
  setColor,
} from './palette-edit'
import { parseOklch } from './oklch'

const base = {
  background: 'oklch(98.2% 0.006 85)',
  foreground: 'oklch(20% 0.022 55)',
  primary: 'oklch(47% 0.17 271)',
  border: 'oklch(90% 0.012 85)',
}

describe('effectiveValue', () => {
  it('prefers the override', () => {
    expect(effectiveValue({ primary: 'oklch(60% 0.2 30)' }, base, 'primary')).toBe(
      'oklch(60% 0.2 30)',
    )
  })

  it('falls through to the app’s own colour when there is none', () => {
    expect(effectiveValue({}, base, 'primary')).toBe('oklch(47% 0.17 271)')
  })

  it('has no answer for a token the stylesheet does not define', () => {
    expect(effectiveValue({}, {}, 'primary')).toBeUndefined()
    expect(effectiveColor({}, {}, 'primary')).toBeNull()
  })
})

describe('setColor and clearColor', () => {
  it('writes the value in the form the stylesheet uses', () => {
    const next = setColor({}, 'primary', { l: 0.6, c: 0.2, h: 30 })
    expect(next.primary).toBe('oklch(60% 0.2 30)')
  })

  it('clearing goes back to the app’s colour rather than writing the old one', () => {
    // The distinction that matters: a cleared token has no entry at all, so
    // it keeps tracking the design instead of being pinned to today's value.
    const withOverride = setColor({}, 'primary', { l: 0.6, c: 0.2, h: 30 })
    const cleared = clearColor(withOverride, 'primary')
    expect(Object.hasOwn(cleared, 'primary')).toBe(false)
    expect(effectiveValue(cleared, base, 'primary')).toBe(base.primary)
  })

  it('clearing something that was never set changes nothing', () => {
    const palette = { primary: 'oklch(60% 0.2 30)' }
    expect(clearColor(palette, 'border')).toBe(palette)
  })

  it('does not mutate the palette it was given', () => {
    const palette = { primary: 'oklch(60% 0.2 30)' }
    setColor(palette, 'border', { l: 0.5, c: 0, h: 0 })
    clearColor(palette, 'primary')
    expect(palette).toEqual({ primary: 'oklch(60% 0.2 30)' })
  })
})

describe('isOverridden / overrideCount', () => {
  it('knows what the theme has actually claimed', () => {
    expect(isOverridden({ primary: 'x' }, 'primary')).toBe(true)
    expect(isOverridden({ primary: 'x' }, 'border')).toBe(false)
    expect(overrideCount({ primary: 'x', border: 'y' })).toBe(2)
  })
})

describe('rotatePalette', () => {
  it('turns every hue by the same angle', () => {
    const rotated = rotatePalette({}, base, 90)
    expect(parseOklch(rotated.primary)!.h).toBeCloseTo(1, 0) // 271 + 90 = 361 → 1
    expect(parseOklch(rotated.background)!.h).toBe(175)
  })

  it('keeps lightness and chroma exactly, so the palette still agrees', () => {
    const rotated = rotatePalette({}, base, 137)
    const before = parseOklch(base.primary)!
    const after = parseOklch(rotated.primary)!
    expect(after.l).toBeCloseTo(before.l, 6)
    expect(after.c).toBeCloseTo(before.c, 6)
  })

  it('leaves a true neutral alone rather than inventing a hue for it', () => {
    const rotated = rotatePalette({}, { grey: 'oklch(50% 0 0)', ...base }, 90)
    expect(rotated.grey).toBeUndefined()
  })

  it('rotates from what it was given, not from the previous frame', () => {
    // Every step is measured against the palette the drag started on, so
    // holding the slider still cannot keep spinning the wheel.
    const once = rotatePalette(base, base, 30)
    const twice = rotatePalette(base, base, 30)
    expect(once).toEqual(twice)
  })

  it('changes nothing at zero', () => {
    const palette = { primary: 'oklch(60% 0.2 30)' }
    expect(rotatePalette(palette, base, 0)).toBe(palette)
  })

  it('goes there and back again', () => {
    const there = rotatePalette(base, base, 120)
    const back = rotatePalette(there, base, -120)
    expect(parseOklch(back.primary)!.h).toBeCloseTo(parseOklch(base.primary)!.h, 4)
  })
})

describe('pruneRedundant', () => {
  it('drops overrides that only repeat the app’s own colour', () => {
    // Rotate a palette right round and every token would otherwise be saved
    // as an override saying exactly what the stylesheet already says —
    // permanently frozen against any future change to the design.
    const palette = { primary: base.primary, border: 'oklch(50% 0.1 200)' }
    expect(pruneRedundant(palette, base)).toEqual({ border: 'oklch(50% 0.1 200)' })
  })

  it('keeps everything that genuinely differs', () => {
    const palette = { primary: 'oklch(60% 0.2 30)' }
    expect(pruneRedundant(palette, base)).toEqual(palette)
  })

  it('survives a base that says nothing', () => {
    const palette = { primary: 'oklch(60% 0.2 30)' }
    expect(pruneRedundant(palette, {})).toEqual(palette)
  })
})
