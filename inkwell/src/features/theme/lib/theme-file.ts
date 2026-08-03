/**
 * Themes as files, so a look can leave the app.
 *
 * A writer who has spent an evening getting a palette right should be able to
 * put it on another machine, send it to someone, or keep it somewhere that
 * outlives this install. Plain JSON, because the point is that it can be
 * read, and a format nobody can open is not really an export.
 */

import { usableEntries } from './apply-theme'
import type { ThemeDraft } from '@/stores/theme-store'
import type { ThemePalette } from '@/types'

const FILE_KIND = 'inkwell-theme'
const FILE_VERSION = 1

export function themeToFile(theme: ThemeDraft): string {
  return `${JSON.stringify(
    {
      kind: FILE_KIND,
      version: FILE_VERSION,
      name: theme.name,
      description: theme.description,
      light: theme.light,
      dark: theme.dark,
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
  }
}
