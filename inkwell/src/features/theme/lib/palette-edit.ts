/**
 * Editing a palette of overrides.
 *
 * All pure, and all built around one idea: a theme holds only what it
 * changes. So "what colour is this?" is a question about two things — the
 * override if there is one, the stylesheet's own value if there is not — and
 * "reset this" is deleting a key rather than writing the old value back.
 */

import { formatOklch, parseOklch, rotateHue, type Oklch } from './oklch'
import { THEME_TOKENS, type ThemeToken } from './tokens'
import type { ThemePalette } from '@/types'

/** The value in force for a token: the override, or the stylesheet's own. */
export function effectiveValue(
  palette: ThemePalette,
  base: ThemePalette,
  token: ThemeToken,
): string | undefined {
  return palette[token] ?? base[token]
}

export function effectiveColor(
  palette: ThemePalette,
  base: ThemePalette,
  token: ThemeToken,
): Oklch | null {
  const value = effectiveValue(palette, base, token)
  return value ? parseOklch(value) : null
}

export function isOverridden(palette: ThemePalette, token: ThemeToken): boolean {
  return Object.hasOwn(palette, token)
}

export function setColor(
  palette: ThemePalette,
  token: ThemeToken,
  color: Oklch,
): ThemePalette {
  return { ...palette, [token]: formatOklch(color) }
}

/** Drops an override so the token goes back to the app's own colour. */
export function clearColor(palette: ThemePalette, token: ThemeToken): ThemePalette {
  if (!isOverridden(palette, token)) return palette
  const next = { ...palette }
  delete next[token]
  return next
}

/**
 * Turns every hue in the palette by the same angle.
 *
 * Recolouring a theme one token at a time is twenty-seven decisions and a
 * palette that no longer agrees with itself. Rotating them together is the
 * single move that changes what the app *is* while keeping every
 * relationship inside it — which greys stay grey, which accents stay apart.
 *
 * Rotation is always computed from the palette the drag started on, never
 * from the last frame, or holding the slider still while it re-renders would
 * keep spinning the wheel.
 */
export function rotatePalette(
  from: ThemePalette,
  base: ThemePalette,
  degrees: number,
): ThemePalette {
  if (degrees === 0) return from
  const next: ThemePalette = { ...from }
  for (const token of THEME_TOKENS) {
    const color = effectiveColor(from, base, token)
    // A true neutral has no hue to turn, and rotating it would invent one.
    if (!color || color.c < 0.001) continue
    next[token] = formatOklch(rotateHue(color, degrees))
  }
  return next
}

/**
 * The overrides that actually differ from the app's own colours.
 *
 * A palette built by rotating everything, then rotated back, would otherwise
 * keep twenty-seven overrides that all say exactly what the stylesheet says —
 * carried around forever and, worse, frozen against any future change to the
 * design. Saving prunes them.
 */
export function pruneRedundant(palette: ThemePalette, base: ThemePalette): ThemePalette {
  const next: ThemePalette = {}
  for (const [token, value] of Object.entries(palette)) {
    if (base[token] !== value) next[token] = value
  }
  return next
}

export function overrideCount(palette: ThemePalette): number {
  return Object.keys(palette).length
}
