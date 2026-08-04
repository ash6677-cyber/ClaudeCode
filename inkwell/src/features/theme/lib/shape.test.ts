import { describe, expect, it } from 'vitest'

import { DEFAULT_SHAPE, DEPTH_HINT, DEPTH_LABEL, shapeIsDefault, shapeStyle } from './shape'
import type { ThemeDepth, ThemeShape } from '@/types'

const shape = (over: Partial<ThemeShape> = {}): ThemeShape => ({ ...DEFAULT_SHAPE, ...over })
const DEPTHS: ThemeDepth[] = ['flat', 'soft', 'lifted', 'dramatic']

describe('shapeStyle', () => {
  it('writes nothing when a theme sets no shape', () => {
    // The stylesheet's own values should stand, not be overwritten with a
    // copy of themselves that then stops tracking the design.
    expect(shapeStyle(undefined, 'dark')).toBeNull()
  })

  it('turns one number into the rounding the whole design derives from', () => {
    expect(shapeStyle(shape({ radius: 0 }), 'dark')!['--radius']).toBe('0px')
    expect(shapeStyle(shape({ radius: 20 }), 'dark')!['--radius']).toBe('20px')
  })

  it('clamps a rounding that would swallow a button', () => {
    expect(shapeStyle(shape({ radius: 999 }), 'dark')!['--radius']).toBe('28px')
    expect(shapeStyle(shape({ radius: -5 }), 'dark')!['--radius']).toBe('0px')
  })

  it('makes flat mean no shadows at all, not faint ones', () => {
    const flat = shapeStyle(shape({ depth: 'flat' }), 'dark')!
    for (const name of ['--elevation-xs', '--elevation-sm', '--elevation-md', '--elevation-lg'] as const) {
      expect(flat[name]).toBe('none')
    }
  })

  it('leaves soft as the values the stylesheet already ships', () => {
    // Choosing the app's own depth should write what was there anyway.
    const soft = shapeStyle(shape({ depth: 'soft' }), 'dark')!
    expect(soft['--elevation-sm']).toContain('0 2px 4px')
    expect(soft['--elevation-sm']).toContain('0.36')
  })

  it('lifts further at each step', () => {
    const blur = (depth: ThemeDepth) =>
      Number(shapeStyle(shape({ depth }), 'dark')!['--elevation-lg'].match(/0 \d+px (\d+)px/)![1])
    expect(blur('soft')).toBeLessThan(blur('lifted'))
    expect(blur('lifted')).toBeLessThan(blur('dramatic'))
  })

  it('uses a warm grey on paper and near-black in the dark', () => {
    // A shadow on paper is not a dark-room shadow made weaker; they are
    // different colours, and interpolating gives a muddy halo.
    expect(shapeStyle(shape({ depth: 'lifted' }), 'light')!['--elevation-md']).toContain('22%')
    expect(shapeStyle(shape({ depth: 'lifted' }), 'dark')!['--elevation-md']).toContain('oklch(0% 0 0')
  })

  it('never drives a shadow past fully opaque', () => {
    const dramatic = shapeStyle(shape({ depth: 'dramatic' }), 'dark')!
    for (const value of Object.values(dramatic)) {
      for (const alpha of value.match(/\/ ([\d.]+)\)/g) ?? []) {
        expect(Number(alpha.replace(/[/)]/g, '').trim())).toBeLessThanOrEqual(0.9)
      }
    }
  })

  it('lets motion be stopped outright rather than only slowed', () => {
    // calc(220ms * 0) is 0ms, which is still — the honest meaning of a
    // motion slider pulled to the end.
    expect(shapeStyle(shape({ motion: 0 }), 'dark')!['--motion-scale']).toBe('0')
    expect(shapeStyle(shape({ motion: 2 }), 'dark')!['--motion-scale']).toBe('2')
  })

  it('keeps the interface within a size somebody can still use', () => {
    expect(shapeStyle(shape({ scale: 5 }), 'dark')!['--ui-scale']).toBe('1.25')
    expect(shapeStyle(shape({ scale: 0.1 }), 'dark')!['--ui-scale']).toBe('0.85')
  })

  it('lets the wash be turned off entirely', () => {
    expect(shapeStyle(shape({ wash: 0 }), 'dark')!['--wash-strength']).toBe('0')
  })

  it('survives numbers that are not numbers', () => {
    const broken = shapeStyle(
      shape({ radius: Number.NaN, wash: Number.NaN, motion: Number.NaN, scale: Number.NaN }),
      'dark',
    )!
    expect(broken['--radius']).toBe('0px')
    expect(broken['--motion-scale']).toBe('0')
    expect(broken['--ui-scale']).toBe('0.85')
  })
})

describe('shapeIsDefault', () => {
  it('treats no shape and the app’s own shape alike', () => {
    expect(shapeIsDefault(undefined)).toBe(true)
    expect(shapeIsDefault(DEFAULT_SHAPE)).toBe(true)
  })

  it('spots any one thing being different', () => {
    expect(shapeIsDefault(shape({ radius: 0 }))).toBe(false)
    expect(shapeIsDefault(shape({ depth: 'flat' }))).toBe(false)
    expect(shapeIsDefault(shape({ motion: 0 }))).toBe(false)
    expect(shapeIsDefault(shape({ scale: 1.1 }))).toBe(false)
    expect(shapeIsDefault(shape({ wash: 0 }))).toBe(false)
  })
})

describe('depth vocabulary', () => {
  it('names and explains every depth it offers', () => {
    for (const depth of DEPTHS) {
      expect(DEPTH_LABEL[depth]).toBeTruthy()
      expect(DEPTH_HINT[depth]).toBeTruthy()
    }
  })
})
