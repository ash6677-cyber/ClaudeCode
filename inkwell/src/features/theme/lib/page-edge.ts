/**
 * The edge around the page you write on and the book you read.
 *
 * A glow and a coloured rule are the two things that make an app feel like
 * somebody's rather than a default, and they are also exactly the sort of
 * thing that should get out of the way the moment you are actually trying to
 * write. So this produces custom properties rather than styles, and the two
 * surfaces that consume them decide when to: the manuscript page drops them
 * in focus mode, the reader keeps them, because focus mode is about writing.
 *
 * Pure. Everything here is string arithmetic over numbers, which is the part
 * worth testing — whether a shadow reaches the screen is a job for the eye.
 */

import type { PageEdge, PageEdgeSource } from '@/types'

/** No edge, and the app's own quiet border instead. */
export const NO_PAGE_EDGE: PageEdge = {
  enabled: false,
  source: 'primary',
  color: 'oklch(70% 0.17 290)',
  width: 1,
  borderOpacity: 0.7,
  radius: 12,
  glow: 0,
  glowOpacity: 0.35,
}

/** A sensible thing to see the moment the switch is turned on. */
export const DEFAULT_PAGE_EDGE: PageEdge = {
  enabled: true,
  source: 'primary',
  color: 'oklch(70% 0.17 290)',
  width: 1,
  borderOpacity: 0.55,
  radius: 12,
  glow: 26,
  glowOpacity: 0.3,
}

export const EDGE_SOURCE_LABEL: Record<PageEdgeSource, string> = {
  primary: 'Accent',
  'brand-2': 'Second accent',
  accent: 'Highlight',
  border: 'Border',
  custom: 'A colour of my own',
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, Number.isFinite(value) ? value : low))

/** The raw colour the edge is drawn from, before any opacity is applied. */
export function edgeBaseColor(edge: PageEdge): string {
  return edge.source === 'custom' ? edge.color : `var(--${edge.source})`
}

/**
 * The colour at a given strength.
 *
 * `color-mix` rather than an alpha channel because the colour is usually
 * `var(--primary)` — a value this code never sees and cannot take apart. Mixed
 * in oklab so fading toward transparent stays the same hue instead of drifting
 * through grey, which is what makes a soft glow look like light rather than
 * like smoke.
 */
export function edgeColorAt(edge: PageEdge, opacity: number): string {
  const percent = Math.round(clamp(opacity, 0, 1) * 100)
  if (percent >= 100) return edgeBaseColor(edge)
  return `color-mix(in oklab, ${edgeBaseColor(edge)} ${percent}%, transparent)`
}

export interface EdgeStyle {
  '--page-edge-color': string
  '--page-edge-width': string
  '--page-edge-radius': string
  /** Glow plus whatever sits under it. What the manuscript page wears. */
  '--page-edge-shadow': string
  /**
   * The glow alone. The reader's book already casts its own drop shadow and
   * composes this on top of it, rather than having it replaced.
   */
  '--page-edge-glow': string
  /**
   * The book's border width, which is zero unless a theme asks for one. The
   * manuscript page has a quiet border by default and the book does not —
   * paper against a dark room needs no drawn line.
   */
  '--page-edge-book-width': string
}

/**
 * The custom properties for an edge, ready to put on an element.
 *
 * The glow is two shadows: a tight one that reads as the light coming off the
 * rule itself, and a wide faint one that reads as the room it falls into. One
 * shadow alone looks like a blurred border; two look like something is lit.
 */
export function edgeStyle(
  edge: PageEdge | undefined,
  fallbackShadow = 'var(--elevation-sm)',
): EdgeStyle {
  if (!edge || !edge.enabled) {
    return {
      '--page-edge-color': 'var(--border)',
      '--page-edge-width': '1px',
      '--page-edge-radius': '0.75rem',
      '--page-edge-shadow': fallbackShadow,
      '--page-edge-glow': '0 0 0 transparent',
      '--page-edge-book-width': '0px',
    }
  }

  const width = clamp(edge.width, 0, 12)
  const glow = clamp(edge.glow, 0, 120)
  const shadows: string[] = []
  if (glow > 0) {
    shadows.push(`0 0 ${Math.round(glow * 0.45)}px ${edgeColorAt(edge, edge.glowOpacity)}`)
    shadows.push(
      `0 0 ${Math.round(glow)}px ${Math.round(glow * 0.12)}px ${edgeColorAt(
        edge,
        edge.glowOpacity * 0.55,
      )}`,
    )
  }
  shadows.push(fallbackShadow)

  const glowOnly = shadows.slice(0, -1)
  return {
    '--page-edge-color': width > 0 ? edgeColorAt(edge, edge.borderOpacity) : 'transparent',
    '--page-edge-width': `${width}px`,
    '--page-edge-radius': `${clamp(edge.radius, 0, 48)}px`,
    '--page-edge-shadow': shadows.join(', '),
    '--page-edge-glow': glowOnly.length > 0 ? glowOnly.join(', ') : '0 0 0 transparent',
    '--page-edge-book-width': `${width}px`,
  }
}

/** True when the settings would draw nothing at all, however they are set. */
export function edgeIsInvisible(edge: PageEdge | undefined): boolean {
  if (!edge || !edge.enabled) return true
  const drawsBorder = edge.width > 0 && edge.borderOpacity > 0
  const drawsGlow = edge.glow > 0 && edge.glowOpacity > 0
  return !drawsBorder && !drawsGlow
}
