import { describe, expect, it } from 'vitest'

import { cssVar, diffPalettes, paletteFor, usableEntries } from './apply-theme'
import { BUILT_IN_THEMES } from './presets'
import { isThemeToken, THEME_TOKENS, TOKEN_GROUPS, TOKEN_SPECS } from './tokens'
import { parseOklch } from './oklch'

describe('paletteFor', () => {
  it('takes the half that matches the mode', () => {
    const theme = { light: { background: 'oklch(99% 0 0)' }, dark: { background: 'oklch(10% 0 0)' } }
    expect(paletteFor(theme, 'light')).toEqual({ background: 'oklch(99% 0 0)' })
    expect(paletteFor(theme, 'dark')).toEqual({ background: 'oklch(10% 0 0)' })
  })
})

describe('usableEntries', () => {
  it('keeps the real tokens', () => {
    expect(usableEntries({ background: 'oklch(50% 0 0)' })).toEqual([
      ['background', 'oklch(50% 0 0)'],
    ])
  })

  it('drops a name that is not a token', () => {
    // Palettes arrive from imported files and from devices running newer
    // versions, so an unknown name is expected input, not a bug to crash on.
    expect(usableEntries({ 'not-a-token': 'oklch(50% 0 0)' })).toEqual([])
  })

  it('drops an empty value rather than writing a broken declaration', () => {
    expect(usableEntries({ background: '', foreground: '   ' })).toEqual([])
  })
})

describe('diffPalettes', () => {
  it('sets what the new palette asks for', () => {
    const { set } = diffPalettes({}, { primary: 'oklch(60% 0.2 30)' })
    expect(set).toEqual([['primary', 'oklch(60% 0.2 30)']])
  })

  it('removes what the old palette had and the new one does not', () => {
    // The whole reason this function exists. Without the removal a theme
    // could never be turned off — the last colour would stay stuck on the
    // document with nothing in the app still claiming to have set it.
    const { remove } = diffPalettes({ primary: 'oklch(60% 0.2 30)' }, {})
    expect(remove).toEqual(['primary'])
  })

  it('does not remove something it is about to set again', () => {
    const { set, remove } = diffPalettes(
      { primary: 'oklch(60% 0.2 30)' },
      { primary: 'oklch(70% 0.2 30)' },
    )
    expect(remove).toEqual([])
    expect(set).toEqual([['primary', 'oklch(70% 0.2 30)']])
  })

  it('handles a switch to a completely different palette', () => {
    const { set, remove } = diffPalettes(
      { primary: 'oklch(60% 0.2 30)', background: 'oklch(99% 0 0)' },
      { sidebar: 'oklch(20% 0 0)' },
    )
    expect(remove.sort()).toEqual(['background', 'primary'])
    expect(set).toEqual([['sidebar', 'oklch(20% 0 0)']])
  })

  it('never asks to remove something that was never a token', () => {
    expect(diffPalettes({ nonsense: 'x' }, {}).remove).toEqual([])
  })
})

describe('cssVar', () => {
  it('names the property the stylesheet already uses', () => {
    expect(cssVar('sidebar-border')).toBe('--sidebar-border')
  })
})

describe('tokens', () => {
  it('describes every token it exposes', () => {
    // A token in the list with no group would be invisible in the editor —
    // settable by an imported theme but not by the person using the app.
    const grouped = TOKEN_GROUPS.flatMap((g) => g.tokens).map((t) => t.token)
    expect([...grouped].sort()).toEqual([...THEME_TOKENS].sort())
  })

  it('lists no token twice', () => {
    const grouped = TOKEN_GROUPS.flatMap((g) => g.tokens).map((t) => t.token)
    expect(new Set(grouped).size).toBe(grouped.length)
  })

  it('points every foreground at a background that exists', () => {
    for (const spec of Object.values(TOKEN_SPECS)) {
      if (spec.against) expect(isThemeToken(spec.against)).toBe(true)
    }
  })

  it('recognises its own tokens and nothing else', () => {
    expect(isThemeToken('background')).toBe(true)
    expect(isThemeToken('--background')).toBe(false)
    expect(isThemeToken('radius')).toBe(false)
  })
})

describe('BUILT_IN_THEMES', () => {
  it('leaves the default as pure inheritance', () => {
    // Inkwell is the built-in stylesheet, not a copy of it. Copying would
    // freeze today's values into a preset and quietly stop it tracking the
    // app's own look.
    const inkwell = BUILT_IN_THEMES.find((t) => t.id === 'builtin:inkwell')!
    expect(inkwell.light).toEqual({})
    expect(inkwell.dark).toEqual({})
  })

  it('only ever sets real tokens', () => {
    for (const preset of BUILT_IN_THEMES) {
      for (const palette of [preset.light, preset.dark]) {
        for (const token of Object.keys(palette)) {
          expect(isThemeToken(token), `${preset.id} sets ${token}`).toBe(true)
        }
      }
    }
  })

  it('writes every colour in a form the app can parse', () => {
    for (const preset of BUILT_IN_THEMES) {
      for (const palette of [preset.light, preset.dark]) {
        for (const [token, value] of Object.entries(palette)) {
          expect(parseOklch(value), `${preset.id} ${token} = ${value}`).not.toBeNull()
        }
      }
    }
  })

  it('gives both modes to every preset that touches either', () => {
    // A preset with a light palette and no dark one would look deliberate by
    // day and revert to the default look at night.
    for (const preset of BUILT_IN_THEMES) {
      if (Object.keys(preset.light).length === 0) continue
      expect(Object.keys(preset.dark).length, preset.id).toBeGreaterThan(0)
    }
  })

  it('has no two presets sharing an id', () => {
    const ids = BUILT_IN_THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
