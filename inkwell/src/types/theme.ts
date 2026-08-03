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

/**
 * Where the edge colour comes from.
 *
 * Naming a palette token rather than a colour is the default because the two
 * palettes already differ: an edge that reads well on a near-black background
 * is invisible on paper. Following `primary` means the edge is right in both
 * modes without the writer setting it twice. `custom` is there for when they
 * want a colour that is nowhere else in the app.
 */
export type PageEdgeSource = 'primary' | 'brand-2' | 'accent' | 'border' | 'custom'

/**
 * How the page you write and read on is edged.
 *
 * Deliberately one setting shared by the manuscript page and the reader's
 * book: they are the same object at two moments, and a writer who gives their
 * page a warm gold edge means the book, not one view of it.
 */
export interface PageEdge {
  enabled: boolean
  source: PageEdgeSource
  /** Used only when `source` is 'custom'. */
  color: string
  /** Border thickness in px. Zero leaves only the glow. */
  width: number
  /** 0–1. */
  borderOpacity: number
  /** Corner radius in px. */
  radius: number
  /** Glow spread in px. Zero leaves a sharp edge and nothing around it. */
  glow: number
  /** 0–1. */
  glowOpacity: number
}

export interface Theme extends BaseEntity {
  name: string
  description: string
  /** Overrides applied when the app is in light mode. */
  light: ThemePalette
  /** Overrides applied when the app is in dark mode. */
  dark: ThemePalette
  /**
   * Absent on every theme made before page edges existed, which is why it is
   * optional: no theme changes what it looks like by being loaded into a
   * newer version.
   */
  page?: PageEdge
}
