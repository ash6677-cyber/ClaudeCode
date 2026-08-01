import { describe, expect, it } from 'vitest'

import { comboKeys, matchesCombo, SHORTCUTS, shortcut } from './shortcuts'

/** A stand-in for the fields `matchesCombo` reads off a real KeyboardEvent. */
function press(
  key: string,
  mods: { mod?: boolean; shift?: boolean; alt?: boolean } = {},
): KeyboardEvent {
  return {
    key,
    ctrlKey: mods.mod ?? false,
    metaKey: false,
    shiftKey: mods.shift ?? false,
    altKey: mods.alt ?? false,
  } as KeyboardEvent
}

describe('matchesCombo', () => {
  it('matches Mod via either Ctrl or Cmd', () => {
    expect(matchesCombo(press('k', { mod: true }), 'Mod+K')).toBe(true)
    expect(
      matchesCombo({ key: 'k', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false } as KeyboardEvent, 'Mod+K'),
    ).toBe(true)
  })

  it('ignores the case of letter keys', () => {
    expect(matchesCombo(press('K', { mod: true }), 'Mod+K')).toBe(true)
    expect(matchesCombo(press('f', { mod: true, shift: true }), 'Mod+Shift+F')).toBe(true)
  })

  it('requires the modifier, not merely tolerates it', () => {
    expect(matchesCombo(press('k'), 'Mod+K')).toBe(false)
  })

  it('does not let a plain combo swallow its Shift variant', () => {
    // The bug this guards against: Mod+F firing on Mod+Shift+F, which would
    // open the scene find bar instead of manuscript-wide search.
    expect(matchesCombo(press('f', { mod: true, shift: true }), 'Mod+F')).toBe(false)
    expect(matchesCombo(press('f', { mod: true }), 'Mod+Shift+F')).toBe(false)
  })

  it('rejects an unwanted Alt', () => {
    expect(matchesCombo(press('k', { mod: true, alt: true }), 'Mod+K')).toBe(false)
  })

  it('handles bare keys and punctuation', () => {
    expect(matchesCombo(press('Escape'), 'Escape')).toBe(true)
    expect(matchesCombo(press('Enter', { shift: true }), 'Shift+Enter')).toBe(true)
    expect(matchesCombo(press('Enter'), 'Shift+Enter')).toBe(false)
    expect(matchesCombo(press('.', { mod: true }), 'Mod+.')).toBe(true)
    expect(matchesCombo(press(',', { mod: true }), 'Mod+,')).toBe(true)
    expect(matchesCombo(press('ArrowRight'), 'ArrowRight')).toBe(true)
  })
})

describe('the shortcut table', () => {
  it('has no duplicate ids', () => {
    const ids = SHORTCUTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has no two shortcuts claiming the same combo within one group', () => {
    const seen = new Set<string>()
    for (const s of SHORTCUTS) {
      const key = `${s.group}::${s.combo}`
      expect(seen.has(key), `${key} is claimed twice`).toBe(false)
      seen.add(key)
    }
  })

  it('resolves every id back to its definition', () => {
    for (const s of SHORTCUTS) expect(shortcut(s.id).combo).toBe(s.combo)
  })

  it('throws on an unknown id rather than returning undefined', () => {
    // @ts-expect-error deliberately outside the union
    expect(() => shortcut('nope')).toThrow()
  })
})

describe('comboKeys', () => {
  it('renders platform-appropriate modifiers', () => {
    expect(comboKeys('Mod+Shift+F', false)).toEqual(['Ctrl', 'Shift', 'F'])
    expect(comboKeys('Mod+Shift+F', true)).toEqual(['⌘', '⇧', 'F'])
  })

  it('renders named keys as symbols where there is one', () => {
    expect(comboKeys('ArrowRight', false)).toEqual(['→'])
    expect(comboKeys('Escape', false)).toEqual(['Esc'])
    expect(comboKeys('Shift+Enter', false)).toEqual(['Shift', '↵'])
    expect(comboKeys('Mod+,', false)).toEqual(['Ctrl', ','])
  })
})
