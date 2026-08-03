import type { BaseEntity } from './base'

/**
 * Colour overrides for one mode, as `oklch()` strings.
 *
 * Partial on purpose, and this is the load-bearing decision in the whole
 * theme system. A theme that only wants a different accent says only that;
 * everything it does not mention keeps the built-in value. So a theme made
 * today does not break when a token is added tomorrow, a half-finished theme
 * is still a usable app rather than a black screen, and "reset this one
 * colour" is deleting a key rather than knowing what it used to be.
 */
export type ThemePalette = Record<string, string>

export interface Theme extends BaseEntity {
  name: string
  description: string
  /** Overrides applied when the app is in light mode. */
  light: ThemePalette
  /** Overrides applied when the app is in dark mode. */
  dark: ThemePalette
}
