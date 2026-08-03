/**
 * Putting a theme on the screen.
 *
 * The stylesheet defines every token twice — once in `:root` for light, once
 * in `.dark`. A theme sets the same names as inline properties on the root
 * element, which win over both, so a theme is a layer over the built-in look
 * rather than a replacement for it. Anything the theme leaves alone still
 * comes from the stylesheet, and still switches with light and dark on its
 * own.
 *
 * That layering is why applying has to be able to *unset*. The properties are
 * tracked so that turning a theme off, or clearing one colour, removes the
 * declaration instead of leaving the last value stuck there with nothing in
 * the app still claiming to have set it.
 */

import { isThemeToken, THEME_TOKENS } from './tokens'
import type { Theme, ThemePalette } from '@/types'

export type ColorMode = 'light' | 'dark'

/** Which half of a theme is in force. */
export function paletteFor(theme: Pick<Theme, 'light' | 'dark'>, mode: ColorMode): ThemePalette {
  return mode === 'dark' ? theme.dark : theme.light
}

/**
 * Only the entries that name a real token and carry a real value.
 *
 * A palette can arrive from an imported file or from a device running a newer
 * version, so it is not trustworthy input. Unknown names are dropped rather
 * than written: setting `--not-a-token` would be harmless but permanent, and
 * a typo that silently does nothing forever is worse than one that is ignored.
 */
export function usableEntries(palette: ThemePalette): [string, string][] {
  return Object.entries(palette).filter(
    ([token, value]) =>
      isThemeToken(token) && typeof value === 'string' && value.trim().length > 0,
  )
}

/** Custom-property name for a token, as the stylesheet writes it. */
export const cssVar = (token: string) => `--${token}`

/**
 * Works out the writes and the removals to get from one palette to another.
 *
 * Returned rather than performed so the decision is testable without a DOM,
 * which is the only interesting part: the removals. Forgetting them is how a
 * theme editor ends up unable to undo itself.
 */
export function diffPalettes(
  previous: ThemePalette,
  next: ThemePalette,
): { set: [string, string][]; remove: string[] } {
  const set = usableEntries(next)
  const keeping = new Set(set.map(([token]) => token))
  const remove = usableEntries(previous)
    .map(([token]) => token)
    .filter((token) => !keeping.has(token))
  return { set, remove }
}

/** Tracks what this module last wrote, so it can take it back again. */
let applied: ThemePalette = {}

/**
 * Applies a theme's colours for the given mode.
 *
 * Pass null to go back to the built-in look. Safe to call on every render —
 * it only touches the properties that actually changed.
 */
export function applyTheme(
  theme: Pick<Theme, 'light' | 'dark'> | null,
  mode: ColorMode,
  root: HTMLElement = document.documentElement,
): void {
  const next = theme ? paletteFor(theme, mode) : {}
  const { set, remove } = diffPalettes(applied, next)

  for (const token of remove) root.style.removeProperty(cssVar(token))
  for (const [token, value] of set) root.style.setProperty(cssVar(token), value)

  applied = Object.fromEntries(set)
}

/** Forgets what is applied without touching the DOM. Tests only. */
export function resetAppliedForTests(): void {
  applied = {}
}

const baseCache = new Map<ColorMode, ThemePalette>()

/**
 * What each token is before any theme touches it.
 *
 * The editor has to show a colour for tokens the writer has not overridden,
 * and the honest source for that is the stylesheet itself rather than a
 * duplicated copy of its values that would drift the moment the design
 * changed. Reading it means getting the overrides out of the way first: the
 * whole point of them is that they win.
 *
 * Everything here happens inside one task, so the browser never paints the
 * stripped state — the class and the inline properties are back before
 * anything can be rendered. Cached because the stylesheet cannot change while
 * the app is running.
 */
export function readBaseTokens(
  mode: ColorMode,
  root: HTMLElement = document.documentElement,
): ThemePalette {
  const cached = baseCache.get(mode)
  if (cached) return cached

  const savedStyle = root.getAttribute('style')
  const wasDark = root.classList.contains('dark')

  for (const token of Object.keys(applied)) root.style.removeProperty(cssVar(token))
  root.classList.toggle('dark', mode === 'dark')

  const computed = getComputedStyle(root)
  const base: ThemePalette = {}
  for (const [token] of usableEntries(Object.fromEntries(THEME_TOKENS.map((t) => [t, 'x'])))) {
    const value = computed.getPropertyValue(cssVar(token)).trim()
    if (value) base[token] = value
  }

  root.classList.toggle('dark', wasDark)
  if (savedStyle === null) root.removeAttribute('style')
  else root.setAttribute('style', savedStyle)

  baseCache.set(mode, base)
  return base
}
