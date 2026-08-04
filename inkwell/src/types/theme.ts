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

/** How much the interface lifts off the page. */
export type ThemeDepth = 'flat' | 'soft' | 'lifted' | 'dramatic'

/**
 * The shape of the interface, as distinct from its colour.
 *
 * Rounding, depth, the wash behind everything, how fast things move and how
 * big it all is. Colour decides what an app looks like; these decide what it
 * feels like to use, and they are the settings people actually reach for —
 * "too bouncy", "too rounded", "too small" are all complaints about this and
 * none of them about the palette.
 */
export interface ThemeShape {
  /** Corner rounding in px. Zero is square; the app's own is about 11. */
  radius: number
  depth: ThemeDepth
  /** Strength of the ambient wash behind everything, 0–1 of the app's own. */
  wash: number
  /**
   * Animation speed, as a multiple. 1 is the app's own pace, 2 is half speed,
   * 0 is still — which is a real preference and not only an accessibility
   * setting, though the system one is still honoured on top of it.
   */
  motion: number
  /** Overall size of the interface, as a multiple. */
  scale: number
}

/**
 * The faces a theme chooses, and how big the prose sits.
 *
 * Three faces, because they are three genuinely different jobs: the interface
 * is read in glances, headings are read as shapes, and a book is read for
 * hours. A single "font" setting would have to be wrong for two of them.
 *
 * The writer's own manuscript typeface is deliberately *not* here. That one
 * lives in preferences, because it is a property of the hand rather than of
 * the book — it should follow a writer from project to project, and stay put
 * when they change how the app looks.
 *
 * Prose size is separate from `ThemeShape.scale` for the same reason: scale
 * grows the whole interface, and wanting larger prose in a normal-sized app
 * is the more common request by a distance.
 */
export interface ThemeType {
  /** Face id for the interface — buttons, labels, navigation. */
  ui: string
  /** Face id for headings and titles. */
  display: string
  /** Face id for the reader's pages. */
  reading: string
  /** Prose size in the editor and the book, as a multiple. */
  proseScale: number
  /** Line spacing for prose, as a multiple. */
  leading: number
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
  /**
   * Absent on themes made before shape existed. Optional for the same reason
   * as `page`: nothing changes what it looks like by being loaded into a
   * newer version of the app.
   */
  shape?: ThemeShape
  /** Absent on themes made before typography existed. Same reason again. */
  type?: ThemeType
}
