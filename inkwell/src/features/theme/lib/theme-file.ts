/**
 * Themes as files, so a look can leave the app.
 *
 * A writer who has spent an evening getting a palette right should be able to
 * put it on another machine, send it to someone, or keep it somewhere that
 * outlives this install. Plain JSON, because the point is that it can be
 * read, and a format nobody can open is not really an export.
 */

import { usableEntries } from './apply-theme'
import { edgeIsInvisible } from './page-edge'
import { shapeIsDefault } from './shape'
import { typeIsDefault } from './typography'
import type { ThemeDraft } from '@/stores/theme-store'
import type { PageEdge, ThemePalette, ThemeShape, ThemeType } from '@/types'

const FILE_KIND = 'inkwell-theme'
/**
 * Bumped from 1 when a theme became more than its colours.
 *
 * A version-1 file still reads: every section beyond the palettes is
 * optional going in as well as coming out, so an older export is a theme
 * that simply did not decide about edges, shape or type — which is exactly
 * what it was.
 */
const FILE_VERSION = 2

export function themeToFile(theme: ThemeDraft): string {
  return `${JSON.stringify(
    {
      kind: FILE_KIND,
      version: FILE_VERSION,
      name: theme.name,
      description: theme.description,
      light: theme.light,
      dark: theme.dark,
      // Everything a theme decides, not only its colours. Exporting the
      // palettes alone meant a writer who sent someone their look sent half
      // of it: the lit page edge, the square corners and the faces all
      // silently stayed behind.
      page: theme.page,
      shape: theme.shape,
      type: theme.type,
    },
    null,
    2,
  )}\n`
}

function readPalette(value: unknown): ThemePalette {
  if (!value || typeof value !== 'object') return {}
  // Filtered on the way in, not trusted. A file can say anything, and a theme
  // carrying junk keys would hand it straight to the DOM on every apply.
  return Object.fromEntries(usableEntries(value as ThemePalette))
}

/**
 * A section of the file, kept only when it is well-formed and says something.
 *
 * Every field is checked against the shape it is meant to have rather than
 * cast into it. A file is not trustworthy input, and one bad number reaching
 * `edgeStyle` would be written straight into a CSS declaration.
 */
function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readEdge(value: unknown): PageEdge | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const sources = ['primary', 'brand-2', 'accent', 'border', 'custom']
  const edge: PageEdge = {
    enabled: raw.enabled === true,
    source: (sources.includes(raw.source as string) ? raw.source : 'primary') as PageEdge['source'],
    color: typeof raw.color === 'string' ? raw.color : 'oklch(70% 0.12 250)',
    width: readNumber(raw.width, 1),
    borderOpacity: readNumber(raw.borderOpacity, 0.5),
    radius: readNumber(raw.radius, 14),
    glow: readNumber(raw.glow, 30),
    glowOpacity: readNumber(raw.glowOpacity, 0.28),
  }
  return edge.enabled && !edgeIsInvisible(edge) ? edge : undefined
}

function readShape(value: unknown): ThemeShape | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const depths = ['flat', 'soft', 'lifted', 'dramatic']
  const shape: ThemeShape = {
    radius: readNumber(raw.radius, 11),
    depth: (depths.includes(raw.depth as string) ? raw.depth : 'soft') as ThemeShape['depth'],
    wash: readNumber(raw.wash, 1),
    motion: readNumber(raw.motion, 1),
    scale: readNumber(raw.scale, 1),
  }
  return shapeIsDefault(shape) ? undefined : shape
}

function readType(value: unknown): ThemeType | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const face = (v: unknown) => (typeof v === 'string' ? v : 'default')
  const type: ThemeType = {
    ui: face(raw.ui),
    display: face(raw.display),
    reading: face(raw.reading),
    proseScale: readNumber(raw.proseScale, 1),
    leading: readNumber(raw.leading, 1),
  }
  // An unknown face id resolves to nothing, so a file naming faces this
  // version has never heard of is a theme that chose no faces — not a crash.
  return typeIsDefault(type) ? undefined : type
}

/**
 * Reads a theme file, or returns null if it is not one.
 *
 * Null rather than an exception because the only caller is a file picker, and
 * "that file is not a theme" is an ordinary thing for a person to do — not an
 * error the app should treat as exceptional.
 */
export function readThemeFile(text: string): ThemeDraft | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const file = parsed as Record<string, unknown>
  if (file.kind !== FILE_KIND) return null

  const name = typeof file.name === 'string' ? file.name.trim() : ''
  return {
    name: name || 'Imported theme',
    description: typeof file.description === 'string' ? file.description : '',
    light: readPalette(file.light),
    dark: readPalette(file.dark),
    page: readEdge(file.page),
    shape: readShape(file.shape),
    type: readType(file.type),
  }
}
