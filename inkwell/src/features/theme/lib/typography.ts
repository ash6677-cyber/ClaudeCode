/**
 * The faces a theme chooses, and how big the prose sits.
 *
 * Three faces for three genuinely different jobs. The interface is read in
 * glances and wants something that stays legible at eleven pixels. Headings
 * are read as shapes and can afford personality. A book is read for hours and
 * wants a face designed for exactly that. One "font" setting would be wrong
 * for two of them.
 *
 * The catalogue is the one the manuscript editor already offers, so every face
 * on the list is already loaded by the time the app has painted — choosing one
 * costs nothing and cannot leave a writer staring at fallback Georgia while a
 * stylesheet arrives. Adding a face here means adding it in one place.
 *
 * Like shape and page edges, this writes custom properties the stylesheet
 * already derives from rather than a pile of overrides: `--ui-font` is what
 * every `font-sans` utility in the app resolves through, `--display-font` is
 * what every heading uses, and `--prose-scale` multiplies a size the editor
 * and the reader both state once.
 *
 * Note the names. Tailwind's own `--font-sans` cannot be turned at runtime —
 * `@theme inline` bakes its value into every utility it generates — so the
 * stylesheet declares these three and points the theme at them.
 */

import { EDITOR_FONTS } from '@/lib/editor/fonts'
import type { ThemeType } from '@/types'

/** The face id meaning "leave the app's own alone". */
export const FACE_DEFAULT = 'default'

/** The app's own typography — what the stylesheet does with no theme at all. */
export const DEFAULT_TYPE: ThemeType = {
  ui: FACE_DEFAULT,
  display: FACE_DEFAULT,
  reading: FACE_DEFAULT,
  proseScale: 1,
  leading: 1,
}

export interface FaceOption {
  id: string
  label: string
  /** Null on the default, which is an instruction not to write anything. */
  family: string | null
  category: 'default' | 'serif' | 'sans' | 'mono'
}

export const FACE_OPTIONS: FaceOption[] = [
  { id: FACE_DEFAULT, label: 'App’s own', family: null, category: 'default' },
  ...EDITOR_FONTS.map((font) => ({
    id: font.id,
    label: font.label,
    family: font.cssFamily,
    category: font.category,
  })),
]

/**
 * The CSS family for a face id, or null to leave the app's own in place.
 *
 * Null rather than a fallback to the first face, deliberately. An id this
 * version does not know came from a newer one or from an edited file, and the
 * honest answer to "I have never heard of this face" is to change nothing —
 * not to silently pick Source Serif and claim that was the intent.
 */
export function faceFamily(id: string): string | null {
  if (id === FACE_DEFAULT) return null
  return EDITOR_FONTS.find((font) => font.id === id)?.cssFamily ?? null
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, Number.isFinite(value) ? value : low))

export const PROSE_SCALE_RANGE = { min: 0.8, max: 1.6 } as const
export const LEADING_RANGE = { min: 0.85, max: 1.45 } as const

/**
 * The custom properties for a set of faces, ready to put on the root element.
 *
 * Only what is actually chosen. A theme that picks a heading face and nothing
 * else writes one property, so the interface font keeps following the design
 * and keeps changing with it. Returns null when there is nothing to write, so
 * the stylesheet's own values stand rather than being overwritten with a copy
 * of themselves.
 */
export function typeStyle(type: ThemeType | undefined): Record<string, string> | null {
  if (!type) return null

  const out: Record<string, string> = {}

  const ui = faceFamily(type.ui)
  if (ui) out['--ui-font'] = ui

  const display = faceFamily(type.display)
  if (display) out['--display-font'] = display

  const reading = faceFamily(type.reading)
  if (reading) out['--reading-font'] = reading

  const scale = clamp(type.proseScale, PROSE_SCALE_RANGE.min, PROSE_SCALE_RANGE.max)
  if (scale !== 1) out['--prose-scale'] = String(scale)

  const leading = clamp(type.leading, LEADING_RANGE.min, LEADING_RANGE.max)
  if (leading !== 1) out['--prose-leading'] = String(leading)

  return Object.keys(out).length > 0 ? out : null
}

/** True when the typography is the app's own, so nothing needs storing. */
export function typeIsDefault(type: ThemeType | undefined): boolean {
  return typeStyle(type) === null
}
