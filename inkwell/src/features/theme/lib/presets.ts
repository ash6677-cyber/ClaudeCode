/**
 * The themes that ship with the app.
 *
 * Constants rather than rows: they cannot be edited or deleted, they are the
 * same on every device without syncing, and "duplicate this and change it"
 * gives a writer a real starting point instead of a blank palette.
 *
 * Each one sets only what it needs. A preset that recolours the accent says
 * so in six lines and inherits the other twenty-one, which is both easier to
 * read here and the reason a preset keeps working when tokens are added.
 */

import type { Theme } from '@/types'

export type ThemePreset = Pick<
  Theme,
  'name' | 'description' | 'light' | 'dark' | 'page' | 'shape'
> & {
  id: string
}

export const BUILT_IN_THEMES: ThemePreset[] = [
  {
    id: 'builtin:inkwell',
    name: 'Inkwell',
    description: 'The default. Warm paper by day, deep blue-black by night.',
    light: {},
    dark: {},
  },
  {
    // Everything pulled toward amber, and the accent moved off violet onto a
    // burnt orange that sits with it rather than fighting it.
    id: 'builtin:sepia',
    name: 'Sepia',
    description: 'Old paper and ink. Warm through, with a burnt-orange accent.',
    light: {
      background: 'oklch(96.5% 0.018 82)',
      card: 'oklch(98% 0.014 82)',
      popover: 'oklch(98.5% 0.012 82)',
      foreground: 'oklch(24% 0.03 48)',
      'card-foreground': 'oklch(24% 0.03 48)',
      primary: 'oklch(52% 0.13 52)',
      'primary-foreground': 'oklch(98% 0.015 82)',
      'brand-2': 'oklch(58% 0.12 28)',
      accent: 'oklch(92% 0.035 68)',
      'accent-foreground': 'oklch(32% 0.08 52)',
      ring: 'oklch(52% 0.13 52)',
      muted: 'oklch(93.5% 0.018 82)',
      'muted-foreground': 'oklch(47% 0.022 55)',
      secondary: 'oklch(92.5% 0.02 82)',
      border: 'oklch(87% 0.024 78)',
      input: 'oklch(86.5% 0.024 78)',
      sidebar: 'oklch(94% 0.024 78)',
      'sidebar-border': 'oklch(87% 0.024 78)',
    },
    dark: {
      background: 'oklch(17% 0.018 58)',
      card: 'oklch(22% 0.02 58)',
      popover: 'oklch(23.5% 0.021 58)',
      foreground: 'oklch(92% 0.014 82)',
      'card-foreground': 'oklch(92% 0.014 82)',
      primary: 'oklch(76% 0.12 62)',
      'primary-foreground': 'oklch(19% 0.03 58)',
      'brand-2': 'oklch(72% 0.13 32)',
      accent: 'oklch(32% 0.05 58)',
      'accent-foreground': 'oklch(90% 0.05 68)',
      ring: 'oklch(76% 0.12 62)',
      muted: 'oklch(26% 0.02 58)',
      'muted-foreground': 'oklch(68% 0.018 62)',
      secondary: 'oklch(26% 0.02 58)',
      border: 'oklch(30% 0.022 58)',
      input: 'oklch(30% 0.022 58)',
      sidebar: 'oklch(13% 0.016 58)',
      'sidebar-border': 'oklch(24% 0.02 58)',
    },
  },
  {
    id: 'builtin:forest',
    name: 'Forest',
    description: 'Cool greens, low chroma. Quiet enough to work in all day.',
    light: {
      background: 'oklch(97.5% 0.008 150)',
      card: 'oklch(99% 0.005 150)',
      foreground: 'oklch(21% 0.02 165)',
      primary: 'oklch(46% 0.11 158)',
      'primary-foreground': 'oklch(98% 0.01 150)',
      'brand-2': 'oklch(58% 0.11 195)',
      accent: 'oklch(93% 0.03 158)',
      'accent-foreground': 'oklch(30% 0.07 158)',
      ring: 'oklch(46% 0.11 158)',
      muted: 'oklch(95% 0.012 150)',
      'muted-foreground': 'oklch(47% 0.016 165)',
      border: 'oklch(89.5% 0.016 150)',
      input: 'oklch(89% 0.016 150)',
      sidebar: 'oklch(95.5% 0.014 155)',
      'sidebar-border': 'oklch(89.5% 0.016 150)',
    },
    dark: {
      background: 'oklch(15% 0.016 165)',
      card: 'oklch(20.5% 0.018 165)',
      popover: 'oklch(22% 0.019 165)',
      foreground: 'oklch(92% 0.01 150)',
      primary: 'oklch(74% 0.13 158)',
      'primary-foreground': 'oklch(16% 0.03 165)',
      'brand-2': 'oklch(74% 0.11 195)',
      accent: 'oklch(30% 0.045 165)',
      'accent-foreground': 'oklch(88% 0.05 158)',
      ring: 'oklch(74% 0.13 158)',
      muted: 'oklch(24% 0.018 165)',
      'muted-foreground': 'oklch(68% 0.015 165)',
      secondary: 'oklch(24% 0.018 165)',
      border: 'oklch(28.5% 0.02 165)',
      input: 'oklch(28.5% 0.02 165)',
      sidebar: 'oklch(11% 0.014 165)',
      'sidebar-border': 'oklch(22% 0.018 165)',
    },
  },
  {
    // Chroma right down and lightness right out to the ends. Not a look so
    // much as an answer to a screen in daylight or eyes that want the edges
    // to be unambiguous.
    id: 'builtin:high-contrast',
    name: 'High contrast',
    description: 'Maximum separation, minimum colour. Square, flat, and still.',
    shape: { radius: 2, depth: 'flat', wash: 0, motion: 0.6, scale: 1 },
    light: {
      background: 'oklch(100% 0 0)',
      card: 'oklch(100% 0 0)',
      popover: 'oklch(100% 0 0)',
      foreground: 'oklch(12% 0 0)',
      'card-foreground': 'oklch(12% 0 0)',
      'popover-foreground': 'oklch(12% 0 0)',
      primary: 'oklch(32% 0.16 264)',
      'primary-foreground': 'oklch(100% 0 0)',
      'brand-2': 'oklch(32% 0.16 264)',
      accent: 'oklch(90% 0.04 264)',
      'accent-foreground': 'oklch(18% 0.08 264)',
      ring: 'oklch(32% 0.16 264)',
      muted: 'oklch(95% 0 0)',
      'muted-foreground': 'oklch(35% 0 0)',
      secondary: 'oklch(93% 0 0)',
      'secondary-foreground': 'oklch(14% 0 0)',
      border: 'oklch(58% 0 0)',
      input: 'oklch(45% 0 0)',
      sidebar: 'oklch(97% 0 0)',
      'sidebar-foreground': 'oklch(12% 0 0)',
      'sidebar-border': 'oklch(58% 0 0)',
    },
    dark: {
      background: 'oklch(6% 0 0)',
      card: 'oklch(12% 0 0)',
      popover: 'oklch(14% 0 0)',
      foreground: 'oklch(99% 0 0)',
      'card-foreground': 'oklch(99% 0 0)',
      'popover-foreground': 'oklch(99% 0 0)',
      primary: 'oklch(85% 0.14 264)',
      'primary-foreground': 'oklch(8% 0.02 264)',
      'brand-2': 'oklch(85% 0.14 264)',
      accent: 'oklch(28% 0.07 264)',
      'accent-foreground': 'oklch(96% 0.04 264)',
      ring: 'oklch(85% 0.14 264)',
      muted: 'oklch(18% 0 0)',
      'muted-foreground': 'oklch(80% 0 0)',
      secondary: 'oklch(20% 0 0)',
      'secondary-foreground': 'oklch(99% 0 0)',
      border: 'oklch(55% 0 0)',
      input: 'oklch(62% 0 0)',
      sidebar: 'oklch(3% 0 0)',
      'sidebar-foreground': 'oklch(99% 0 0)',
      'sidebar-border': 'oklch(55% 0 0)',
    },
  },
  {
    id: 'builtin:midnight',
    name: 'Midnight',
    description: 'Near-black with a cold cyan accent, and a lit edge to the page.',
    page: {
      enabled: true,
      source: 'primary',
      color: 'oklch(80% 0.13 210)',
      width: 1,
      borderOpacity: 0.5,
      radius: 14,
      glow: 34,
      glowOpacity: 0.28,
    },
    light: {
      background: 'oklch(97% 0.006 240)',
      card: 'oklch(99% 0.004 240)',
      foreground: 'oklch(20% 0.02 250)',
      primary: 'oklch(48% 0.13 232)',
      'primary-foreground': 'oklch(98% 0.01 240)',
      'brand-2': 'oklch(56% 0.13 196)',
      accent: 'oklch(92.5% 0.03 232)',
      'accent-foreground': 'oklch(30% 0.08 232)',
      ring: 'oklch(48% 0.13 232)',
      border: 'oklch(89% 0.012 240)',
      input: 'oklch(88.5% 0.012 240)',
      sidebar: 'oklch(95.5% 0.01 240)',
      'sidebar-border': 'oklch(89% 0.012 240)',
    },
    dark: {
      background: 'oklch(9% 0.012 250)',
      card: 'oklch(14% 0.016 250)',
      popover: 'oklch(16% 0.017 250)',
      foreground: 'oklch(93% 0.008 240)',
      primary: 'oklch(80% 0.13 210)',
      'primary-foreground': 'oklch(10% 0.03 250)',
      'brand-2': 'oklch(82% 0.12 186)',
      accent: 'oklch(24% 0.05 220)',
      'accent-foreground': 'oklch(90% 0.06 210)',
      ring: 'oklch(80% 0.13 210)',
      muted: 'oklch(18% 0.016 250)',
      'muted-foreground': 'oklch(66% 0.015 240)',
      secondary: 'oklch(18% 0.016 250)',
      border: 'oklch(22% 0.018 250)',
      input: 'oklch(22% 0.018 250)',
      sidebar: 'oklch(5.5% 0.01 250)',
      'sidebar-border': 'oklch(16% 0.016 250)',
    },
  },
]

export const DEFAULT_THEME_ID = 'builtin:inkwell'

export function findPreset(id: string): ThemePreset | undefined {
  return BUILT_IN_THEMES.find((preset) => preset.id === id)
}
