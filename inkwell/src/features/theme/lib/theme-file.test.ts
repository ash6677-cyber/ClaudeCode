import { describe, expect, it } from 'vitest'

import { readThemeFile, themeToFile } from './theme-file'

const theme = {
  name: 'Sepia mine',
  description: 'Warmer',
  light: { background: 'oklch(96% 0.02 82)' },
  dark: { background: 'oklch(17% 0.018 58)' },
}

describe('themeToFile', () => {
  it('round-trips a theme unchanged', () => {
    expect(readThemeFile(themeToFile(theme))).toEqual(theme)
  })

  it('writes something a person can read and a newline at the end', () => {
    const text = themeToFile(theme)
    expect(text).toContain('\n  "name": "Sepia mine"')
    expect(text.endsWith('\n')).toBe(true)
  })
})

describe('readThemeFile', () => {
  it('refuses text that is not JSON', () => {
    expect(readThemeFile('not json at all')).toBeNull()
    expect(readThemeFile('')).toBeNull()
  })

  it('refuses JSON that is not a theme', () => {
    // Picking the wrong file is an ordinary thing to do, so this has to be a
    // plain answer rather than a thrown error.
    expect(readThemeFile('{"hello":"world"}')).toBeNull()
    expect(readThemeFile('[1,2,3]')).toBeNull()
    expect(readThemeFile('null')).toBeNull()
  })

  it('drops keys that are not real tokens', () => {
    // A file can say anything; unfiltered, its junk would be handed to the
    // DOM on every apply.
    const parsed = readThemeFile(
      JSON.stringify({
        kind: 'inkwell-theme',
        name: 'Odd',
        light: { background: 'oklch(96% 0.02 82)', 'not-a-token': 'red' },
        dark: {},
      }),
    )
    expect(parsed!.light).toEqual({ background: 'oklch(96% 0.02 82)' })
  })

  it('survives palettes that are the wrong shape entirely', () => {
    const parsed = readThemeFile(
      JSON.stringify({ kind: 'inkwell-theme', name: 'Odd', light: 'nope', dark: 42 }),
    )
    expect(parsed).toEqual({ name: 'Odd', description: '', light: {}, dark: {} })
  })

  it('names an unnamed theme rather than importing a blank', () => {
    const parsed = readThemeFile(JSON.stringify({ kind: 'inkwell-theme', name: '   ' }))
    expect(parsed!.name).toBe('Imported theme')
  })
})
