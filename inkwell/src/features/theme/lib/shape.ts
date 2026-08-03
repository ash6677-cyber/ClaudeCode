/**
 * The shape of the interface: rounding, depth, wash, motion, size.
 *
 * Colour decides what an app looks like. These decide what it feels like to
 * use, and they are the settings people actually reach for — "too rounded",
 * "too bouncy", "too small" are all complaints about this and none of them
 * about the palette.
 *
 * Everything is expressed as one number the stylesheet already derives from,
 * rather than as a pile of overrides. Rounding is `--radius`, which every
 * `--radius-*` in the design system is computed from; motion is a multiplier
 * the keyframe durations are multiplied by; size is the root font size, which
 * every rem in the app is measured against. Turning one knob moves everything
 * that was already agreeing with it.
 */

import type { ThemeDepth, ThemeShape } from '@/types'
import type { ColorMode } from './apply-theme'

/** The app's own shape — what the stylesheet does with no theme at all. */
export const DEFAULT_SHAPE: ThemeShape = {
  radius: 11,
  depth: 'soft',
  wash: 1,
  motion: 1,
  scale: 1,
}

export const DEPTH_LABEL: Record<ThemeDepth, string> = {
  flat: 'Flat',
  soft: 'Soft',
  lifted: 'Lifted',
  dramatic: 'Dramatic',
}

export const DEPTH_HINT: Record<ThemeDepth, string> = {
  flat: 'No shadows. Everything sits on the same plane.',
  soft: 'The app’s own. Just enough to separate a panel from the page.',
  lifted: 'Panels sit clearly above the page.',
  dramatic: 'Deep and theatrical. Best in the dark.',
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, Number.isFinite(value) ? value : low))

/**
 * The four elevations at a given depth.
 *
 * Written out per mode rather than scaled from one set, because a shadow on
 * paper and a shadow in a dark room are not the same shadow made stronger:
 * one is a soft warm grey and the other is very nearly black, and
 * interpolating between them gives a muddy halo that looks like neither.
 */
function elevations(depth: ThemeDepth, mode: ColorMode): Record<string, string> {
  const ink = mode === 'dark' ? 'oklch(0% 0 0' : 'oklch(22% 0.03 55'
  if (depth === 'flat') {
    return {
      '--elevation-xs': 'none',
      '--elevation-sm': 'none',
      '--elevation-md': 'none',
      '--elevation-lg': 'none',
    }
  }
  // Multipliers on offset and alpha. Soft is 1 — the values the stylesheet
  // already ships — so choosing it writes what was there anyway.
  const lift = depth === 'lifted' ? 1.7 : depth === 'dramatic' ? 2.8 : 1
  const alpha = depth === 'lifted' ? 1.25 : depth === 'dramatic' ? 1.6 : 1
  const base = mode === 'dark'
    ? [
        [[1, 2, 0, 0.24]],
        [[2, 4, -1, 0.36], [1, 3, 0, 0.3]],
        [[6, 10, -3, 0.34], [12, 24, -6, 0.46]],
        [[12, 20, -5, 0.38], [28, 48, -12, 0.56]],
      ]
    : [
        [[1, 2, 0, 0.05]],
        [[1, 2, -1, 0.07], [1, 3, 0, 0.06]],
        [[4, 6, -2, 0.05], [8, 16, -4, 0.09]],
        [[8, 12, -4, 0.06], [20, 32, -8, 0.14]],
      ]

  const names = ['--elevation-xs', '--elevation-sm', '--elevation-md', '--elevation-lg']
  const out: Record<string, string> = {}
  base.forEach((layers, index) => {
    out[names[index]] = layers
      .map(([y, blur, spread, a]) =>
        [
          `0 ${round(y * lift)}px ${round(blur * lift)}px`,
          spread === 0 ? '' : `${round(spread * lift)}px `,
          `${ink} / ${round(Math.min(0.9, a * alpha), 3)})`,
        ].join(spread === 0 ? ' ' : ' '),
      )
      .join(', ')
  })
  return out
}

function round(value: number, places = 0): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

export interface ShapeStyle {
  '--radius': string
  '--wash-strength': string
  '--motion-scale': string
  '--ui-scale': string
  '--elevation-xs': string
  '--elevation-sm': string
  '--elevation-md': string
  '--elevation-lg': string
}

/**
 * The custom properties for a shape, ready to put on the root element.
 *
 * Returns nothing when there is no shape, so the stylesheet's own values
 * stand rather than being overwritten with a copy of themselves.
 */
export function shapeStyle(
  shape: ThemeShape | undefined,
  mode: ColorMode,
): ShapeStyle | null {
  if (!shape) return null
  return {
    '--radius': `${clamp(shape.radius, 0, 28)}px`,
    '--wash-strength': String(clamp(shape.wash, 0, 2)),
    // Zero would collapse `calc(220ms * 0)` to 0ms, which is exactly right:
    // still, rather than fast.
    '--motion-scale': String(clamp(shape.motion, 0, 3)),
    '--ui-scale': String(clamp(shape.scale, 0.85, 1.25)),
    ...elevations(shape.depth, mode),
  } as ShapeStyle
}

/** True when the shape is the app's own, so nothing needs writing. */
export function shapeIsDefault(shape: ThemeShape | undefined): boolean {
  if (!shape) return true
  return (
    shape.radius === DEFAULT_SHAPE.radius &&
    shape.depth === DEFAULT_SHAPE.depth &&
    shape.wash === DEFAULT_SHAPE.wash &&
    shape.motion === DEFAULT_SHAPE.motion &&
    shape.scale === DEFAULT_SHAPE.scale
  )
}
