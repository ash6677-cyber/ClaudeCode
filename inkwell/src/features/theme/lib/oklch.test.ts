import { describe, expect, it } from 'vitest'

import {
  contrastRatio,
  contrastVerdict,
  formatOklch,
  lighten,
  oklchToRgb,
  parseOklch,
  readableOn,
  relativeLuminance,
  rotateHue,
  toHex,
} from './oklch'

describe('parseOklch', () => {
  it('reads the form the stylesheet is written in', () => {
    expect(parseOklch('oklch(47% 0.17 271)')).toEqual({ l: 0.47, c: 0.17, h: 271 })
  })

  it('reads lightness given as a fraction too', () => {
    expect(parseOklch('oklch(0.47 0.17 271)')).toEqual({ l: 0.47, c: 0.17, h: 271 })
  })

  it('reads the alpha the elevation tokens carry', () => {
    expect(parseOklch('oklch(22% 0.03 55 / 0.05)')).toEqual({
      l: 0.22,
      c: 0.03,
      h: 55,
      alpha: 0.05,
    })
  })

  it('wraps a hue past the circle instead of holding it', () => {
    expect(parseOklch('oklch(50% 0.1 400)')?.h).toBe(40)
  })

  it('returns nothing for something that is not a colour', () => {
    expect(parseOklch('rebeccapurple')).toBeNull()
    expect(parseOklch('#ff0000')).toBeNull()
    expect(parseOklch('')).toBeNull()
  })
})

describe('formatOklch', () => {
  it('round-trips a stylesheet value unchanged', () => {
    const value = 'oklch(47% 0.17 271)'
    expect(formatOklch(parseOklch(value)!)).toBe(value)
  })

  it('keeps alpha only when it does something', () => {
    expect(formatOklch({ l: 0.5, c: 0.1, h: 200, alpha: 1 })).toBe('oklch(50% 0.1 200)')
    expect(formatOklch({ l: 0.5, c: 0.1, h: 200, alpha: 0.4 })).toBe('oklch(50% 0.1 200 / 0.4)')
  })
})

describe('oklchToRgb', () => {
  it('puts white and black where they belong', () => {
    expect(oklchToRgb({ l: 1, c: 0, h: 0 })).toEqual({ r: 255, g: 255, b: 255 })
    expect(oklchToRgb({ l: 0, c: 0, h: 0 })).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('lands on sRGB red closely enough to judge contrast by', () => {
    // oklch(62.8% 0.2577 29.23) is sRGB red. A channel or two of drift from
    // the cube roots is fine; being in the wrong part of the cube is not.
    const { r, g, b } = oklchToRgb({ l: 0.628, c: 0.2577, h: 29.23 })
    expect(r).toBeGreaterThan(250)
    expect(g).toBeLessThan(8)
    expect(b).toBeLessThan(8)
  })

  it('clips rather than wrapping when asked for a colour no screen has', () => {
    // Chroma far outside the gamut used to wrap round to a wrong hue.
    const rgb = oklchToRgb({ l: 0.5, c: 0.9, h: 140 })
    for (const channel of [rgb.r, rgb.g, rgb.b]) {
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(255)
    }
  })
})

describe('toHex', () => {
  it('writes six digits, always', () => {
    expect(toHex({ l: 0, c: 0, h: 0 })).toBe('#000000')
    expect(toHex({ l: 1, c: 0, h: 0 })).toBe('#ffffff')
  })
})

describe('contrastRatio', () => {
  it('gives black on white the full 21', () => {
    const ratio = contrastRatio({ l: 0, c: 0, h: 0 }, { l: 1, c: 0, h: 0 })
    expect(ratio).toBeGreaterThan(20.5)
    expect(ratio).toBeLessThanOrEqual(21)
  })

  it('gives a colour against itself exactly 1', () => {
    const color = { l: 0.5, c: 0.1, h: 200 }
    expect(contrastRatio(color, color)).toBeCloseTo(1, 5)
  })

  it('does not care which way round the two are given', () => {
    const a = { l: 0.2, c: 0.05, h: 30 }
    const b = { l: 0.9, c: 0.02, h: 30 }
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10)
  })

  it('rates the app’s own dark text on its own light background as readable', () => {
    const background = parseOklch('oklch(98.2% 0.006 85)')!
    const foreground = parseOklch('oklch(20% 0.022 55)')!
    expect(contrastRatio(background, foreground)).toBeGreaterThan(7)
  })

  it('rates the app’s own dark mode as readable too', () => {
    const background = parseOklch('oklch(13.5% 0.014 262)')!
    const foreground = parseOklch('oklch(93% 0.007 85)')!
    expect(contrastRatio(background, foreground)).toBeGreaterThan(7)
  })
})

describe('contrastVerdict', () => {
  it('uses the thresholds that mean something for reading', () => {
    expect(contrastVerdict(1.4)).toBe('fails')
    expect(contrastVerdict(2.99)).toBe('fails')
    expect(contrastVerdict(3)).toBe('large-only')
    expect(contrastVerdict(4.5)).toBe('good')
    expect(contrastVerdict(7)).toBe('excellent')
  })
})

describe('relativeLuminance', () => {
  it('runs from nothing to one', () => {
    expect(relativeLuminance({ l: 0, c: 0, h: 0 })).toBeCloseTo(0, 3)
    expect(relativeLuminance({ l: 1, c: 0, h: 0 })).toBeCloseTo(1, 2)
  })
})

describe('readableOn', () => {
  it('puts dark ink on a pale ground and pale ink on a dark one', () => {
    expect(readableOn({ l: 0.95, c: 0.01, h: 85 }).l).toBeLessThan(0.3)
    expect(readableOn({ l: 0.15, c: 0.01, h: 262 }).l).toBeGreaterThan(0.8)
  })

  it('always produces something actually readable', () => {
    for (let l = 0; l <= 1.0001; l += 0.05) {
      const background = { l, c: 0.08, h: 271 }
      expect(contrastRatio(background, readableOn(background))).toBeGreaterThan(4.5)
    }
  })

  it('keeps the ground’s hue rather than falling back to grey', () => {
    expect(readableOn({ l: 0.95, c: 0.1, h: 271 }).h).toBe(271)
  })

  it('gives up the hue rather than readability on a middling ground', () => {
    // Around the midpoint neither tinted ink clears the body-text bar, and
    // being readable matters more than being tinted.
    const middling = { l: 0.55, c: 0.08, h: 271 }
    const ink = readableOn(middling)
    expect(ink.c).toBe(0)
    expect(contrastRatio(middling, ink)).toBeGreaterThan(4.5)
  })
})

describe('lighten', () => {
  it('moves lightness and leaves hue and chroma alone', () => {
    expect(lighten({ l: 0.5, c: 0.1, h: 200 }, 0.2)).toEqual({ l: 0.7, c: 0.1, h: 200 })
  })

  it('stops at the ends instead of running past them', () => {
    expect(lighten({ l: 0.9, c: 0.1, h: 200 }, 0.5).l).toBe(1)
    expect(lighten({ l: 0.1, c: 0.1, h: 200 }, -0.5).l).toBe(0)
  })
})

describe('rotateHue', () => {
  it('turns the wheel and comes back round', () => {
    expect(rotateHue({ l: 0.5, c: 0.1, h: 350 }, 20).h).toBe(10)
    expect(rotateHue({ l: 0.5, c: 0.1, h: 10 }, -20).h).toBe(350)
  })

  it('leaves lightness and chroma exactly where they were', () => {
    const rotated = rotateHue({ l: 0.5, c: 0.1, h: 200 }, 90)
    expect(rotated.l).toBe(0.5)
    expect(rotated.c).toBe(0.1)
  })
})
