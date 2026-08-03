import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PAGE_EDGE,
  edgeBaseColor,
  edgeColorAt,
  edgeIsInvisible,
  edgeStyle,
  NO_PAGE_EDGE,
} from './page-edge'
import type { PageEdge } from '@/types'

const edge = (over: Partial<PageEdge> = {}): PageEdge => ({ ...DEFAULT_PAGE_EDGE, ...over })

describe('edgeBaseColor', () => {
  it('follows a palette token, so the edge is right in both modes at once', () => {
    expect(edgeBaseColor(edge({ source: 'primary' }))).toBe('var(--primary)')
    expect(edgeBaseColor(edge({ source: 'brand-2' }))).toBe('var(--brand-2)')
  })

  it('uses the writer’s own colour when they set one', () => {
    expect(edgeBaseColor(edge({ source: 'custom', color: 'oklch(70% 0.2 30)' }))).toBe(
      'oklch(70% 0.2 30)',
    )
  })
})

describe('edgeColorAt', () => {
  it('mixes toward transparent rather than assuming an alpha channel', () => {
    // The colour is usually var(--primary), which this code never sees and
    // cannot take apart to add an alpha to.
    expect(edgeColorAt(edge(), 0.5)).toBe('color-mix(in oklab, var(--primary) 50%, transparent)')
  })

  it('leaves a fully opaque colour alone', () => {
    expect(edgeColorAt(edge(), 1)).toBe('var(--primary)')
  })

  it('clamps rather than emitting a nonsense percentage', () => {
    expect(edgeColorAt(edge(), 4)).toBe('var(--primary)')
    expect(edgeColorAt(edge(), -2)).toBe('color-mix(in oklab, var(--primary) 0%, transparent)')
  })
})

describe('edgeStyle', () => {
  it('falls back to the app’s own border when there is no edge', () => {
    const style = edgeStyle(undefined)
    expect(style['--page-edge-color']).toBe('var(--border)')
    expect(style['--page-edge-width']).toBe('1px')
    expect(style['--page-edge-shadow']).toBe('var(--elevation-sm)')
  })

  it('does the same for an edge that is switched off', () => {
    expect(edgeStyle(NO_PAGE_EDGE)['--page-edge-color']).toBe('var(--border)')
  })

  it('draws two shadows for a glow, not one', () => {
    // One blurred shadow reads as a fuzzy border; two read as something lit.
    const shadow = edgeStyle(edge({ glow: 30 }))['--page-edge-shadow']
    expect(shadow.split('), ').length).toBeGreaterThanOrEqual(2)
    expect(shadow).toContain('var(--elevation-sm)')
  })

  it('draws no glow shadows when the glow is zero', () => {
    const shadow = edgeStyle(edge({ glow: 0 }))['--page-edge-shadow']
    expect(shadow).toBe('var(--elevation-sm)')
  })

  it('keeps a sharp edge sharp — a border with no glow at all', () => {
    const style = edgeStyle(edge({ glow: 0, width: 2, borderOpacity: 1, radius: 0 }))
    expect(style['--page-edge-width']).toBe('2px')
    expect(style['--page-edge-radius']).toBe('0px')
    expect(style['--page-edge-color']).toBe('var(--primary)')
  })

  it('makes the border transparent rather than hairline when width is zero', () => {
    // Glow-only is a real look, and a 0px border that still had a colour
    // would render as nothing anyway — but saying so keeps it honest.
    expect(edgeStyle(edge({ width: 0 }))['--page-edge-color']).toBe('transparent')
  })

  it('clamps values that would swamp the page', () => {
    const style = edgeStyle(edge({ width: 999, radius: 999, glow: 9999 }))
    expect(style['--page-edge-width']).toBe('12px')
    expect(style['--page-edge-radius']).toBe('48px')
    expect(style['--page-edge-shadow']).toContain('120px')
  })

  it('survives numbers that are not numbers', () => {
    const style = edgeStyle(edge({ width: Number.NaN, glow: Number.NaN }))
    expect(style['--page-edge-width']).toBe('0px')
    expect(style['--page-edge-shadow']).toBe('var(--elevation-sm)')
  })

  it('lets the surface choose what sits under the glow', () => {
    // The reader's book already casts its own drop shadow, and it must not be
    // replaced by the editor page's elevation.
    expect(edgeStyle(edge({ glow: 0 }), 'none')['--page-edge-shadow']).toBe('none')
  })
})

describe('edgeIsInvisible', () => {
  it('knows when nothing would be drawn', () => {
    expect(edgeIsInvisible(undefined)).toBe(true)
    expect(edgeIsInvisible(NO_PAGE_EDGE)).toBe(true)
    expect(edgeIsInvisible(edge({ width: 0, glow: 0 }))).toBe(true)
    expect(edgeIsInvisible(edge({ width: 2, borderOpacity: 0, glow: 10, glowOpacity: 0 }))).toBe(
      true,
    )
  })

  it('knows when something would', () => {
    expect(edgeIsInvisible(edge({ width: 0, glow: 20 }))).toBe(false)
    expect(edgeIsInvisible(edge({ width: 2, glow: 0 }))).toBe(false)
  })
})
