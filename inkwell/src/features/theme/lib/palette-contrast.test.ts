/**
 * Every built-in theme, both modes, every readable pair — machine-checked to
 * WCAG AA. This is the railing that makes the presets safe to retune: change
 * any of the several hundred shades and this fails before a writer squints.
 *
 * Inkwell ships an empty palette (the stylesheet IS its palette), so the
 * base values from index.css are mirrored here and every other theme is
 * resolved against them, exactly as apply-theme does with CSS variables.
 */

import { describe, expect, it } from 'vitest'
import { contrastRatio, type Rgb } from '@/features/series/lib/palette'
import { BUILT_IN_THEMES } from './presets'
import type { ThemeToken } from './tokens'

/** OKLCH → sRGB, the standard OKLab pipeline, for probing the palette. */
function oklchToRgb(l: number, c: number, h: number): Rgb {
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

function parseOklch(value: string): Rgb {
  const m = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/.exec(value)
  if (!m) throw new Error(`unparseable colour: ${value}`)
  return oklchToRgb(Number(m[1]), Number(m[2]), Number(m[3]))
}

/** The stylesheet's own palette — index.css :root and .dark, mirrored. */
const BASE: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    background: 'oklch(98.3% 0.005 290)',
    foreground: 'oklch(21% 0.022 290)',
    card: 'oklch(99.4% 0.003 290)',
    'card-foreground': 'oklch(21% 0.022 290)',
    popover: 'oklch(99.5% 0.0025 290)',
    'popover-foreground': 'oklch(21% 0.022 290)',
    primary: 'oklch(45% 0.22 290)',
    'primary-foreground': 'oklch(98.5% 0.01 290)',
    'brand-2': 'oklch(62% 0.19 320)',
    secondary: 'oklch(95% 0.01 290)',
    'secondary-foreground': 'oklch(29% 0.03 290)',
    muted: 'oklch(95.8% 0.01 290)',
    'muted-foreground': 'oklch(46% 0.024 290)',
    accent: 'oklch(93% 0.045 290)',
    'accent-foreground': 'oklch(30% 0.13 290)',
    destructive: 'oklch(56% 0.21 25)',
    'destructive-foreground': 'oklch(98% 0.01 25)',
    success: 'oklch(52.5% 0.125 152)',
    'success-foreground': 'oklch(98% 0.02 152)',
    warning: 'oklch(72% 0.15 78)',
    'warning-foreground': 'oklch(24% 0.05 78)',
    border: 'oklch(90.5% 0.014 290)',
    input: 'oklch(90% 0.014 290)',
    ring: 'oklch(45% 0.22 290)',
    sidebar: 'oklch(96.6% 0.012 290)',
    'sidebar-foreground': 'oklch(30% 0.035 290)',
    'sidebar-border': 'oklch(90% 0.016 290)',
  },
  dark: {
    background: 'oklch(13.5% 0.02 290)',
    foreground: 'oklch(93.5% 0.006 290)',
    card: 'oklch(19.5% 0.024 290)',
    'card-foreground': 'oklch(93.5% 0.006 290)',
    popover: 'oklch(21% 0.025 290)',
    'popover-foreground': 'oklch(93.5% 0.006 290)',
    primary: 'oklch(72% 0.19 290)',
    'primary-foreground': 'oklch(14% 0.04 290)',
    'brand-2': 'oklch(78% 0.15 320)',
    secondary: 'oklch(23.5% 0.022 290)',
    'secondary-foreground': 'oklch(90% 0.008 290)',
    muted: 'oklch(23.5% 0.022 290)',
    'muted-foreground': 'oklch(68% 0.02 290)',
    accent: 'oklch(32% 0.07 290)',
    'accent-foreground': 'oklch(90% 0.06 290)',
    destructive: 'oklch(66% 0.2 25)',
    'destructive-foreground': 'oklch(13% 0.04 25)',
    success: 'oklch(68% 0.14 152)',
    'success-foreground': 'oklch(13% 0.02 152)',
    warning: 'oklch(77% 0.15 80)',
    'warning-foreground': 'oklch(18% 0.04 80)',
    border: 'oklch(28% 0.025 290)',
    input: 'oklch(28% 0.025 290)',
    ring: 'oklch(72% 0.19 290)',
    sidebar: 'oklch(9.5% 0.02 290)',
    'sidebar-foreground': 'oklch(87.5% 0.01 290)',
    'sidebar-border': 'oklch(21% 0.024 290)',
  },
}

/** Text on its surface: AA for normal text, no exceptions. */
const TEXT_PAIRS: [ThemeToken, ThemeToken][] = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'background'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['primary-foreground', 'primary'],
  ['sidebar-foreground', 'sidebar'],
  ['destructive-foreground', 'destructive'],
  ['success-foreground', 'success'],
  ['warning-foreground', 'warning'],
]

/** The primary doubles as link text, so it must read as text too. */
const LINK_PAIRS: [ThemeToken, ThemeToken][] = [
  ['primary', 'background'],
  ['primary', 'card'],
]

for (const preset of BUILT_IN_THEMES) {
  for (const mode of ['light', 'dark'] as const) {
    const resolve = (token: ThemeToken): Rgb => {
      const value = preset[mode][token] ?? BASE[mode][token]
      return parseOklch(value)
    }
    describe(`${preset.name} (${mode})`, () => {
      for (const [fg, bg] of [...TEXT_PAIRS, ...LINK_PAIRS]) {
        it(`${fg} on ${bg} ≥ 4.5:1`, () => {
          const ratio = contrastRatio(resolve(fg), resolve(bg))
          expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
        })
      }
    })
  }
}
