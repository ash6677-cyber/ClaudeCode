import { describe, expect, it } from 'vitest'
import { contrastRatio, type Rgb } from '@/features/series/lib/palette'

/** OKLCH → sRGB, the standard OKLab pipeline, for probing the palette. */
function oklch(l: number, c: number, h: number): Rgb {
  const L = l / 100
  const rad = (h * Math.PI) / 180
  const a = c * Math.cos(rad)
  const b = c * Math.sin(rad)
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => {
    const clamped = Math.min(1, Math.max(0, v))
    return (clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055) * 255
  })
  return { r: lin[0], g: lin[1], b: lin[2] }
}

const pairs: [string, Rgb, Rgb, number][] = [
  ['foreground on background', oklch(21, 0.022, 290), oklch(98.3, 0.005, 290), 4.5],
  ['foreground on card', oklch(21, 0.022, 290), oklch(99.4, 0.003, 290), 4.5],
  ['muted-foreground on background', oklch(46, 0.024, 290), oklch(98.3, 0.005, 290), 4.5],
  ['muted-foreground on muted', oklch(46, 0.024, 290), oklch(95.8, 0.01, 290), 4.5],
  ['primary on background', oklch(45, 0.22, 290), oklch(98.3, 0.005, 290), 4.5],
  ['primary-foreground on primary', oklch(98.5, 0.01, 290), oklch(45, 0.22, 290), 4.5],
  ['sidebar-foreground on sidebar', oklch(30, 0.035, 290), oklch(96.6, 0.012, 290), 4.5],
  ['secondary-foreground on secondary', oklch(29, 0.03, 290), oklch(95, 0.01, 290), 4.5],
  ['accent-foreground on accent', oklch(30, 0.13, 290), oklch(93, 0.045, 290), 4.5],
]

describe('porcelain-violet light palette', () => {
  for (const [name, fg, bg, min] of pairs) {
    it(`${name} ≥ ${min}:1`, () => {
      const ratio = contrastRatio(fg, bg)
      expect(ratio, `${name} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min)
    })
  }
})
