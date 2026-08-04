import { describe, expect, it } from 'vitest'

import { SUBSECTIONS, activeSubsection, playgroundPath } from './playground-nav'

describe('playgroundPath', () => {
  it('keeps the open book on every link', () => {
    // Losing ?project= is silent: the screen renders, it is just empty, and
    // the writer concludes their characters are gone.
    expect(playgroundPath('cards', 'p1')).toBe('/playground/cards?project=p1')
    expect(playgroundPath('chats', 'p1', '/c9')).toBe('/playground/chats/c9?project=p1')
    expect(playgroundPath('lorebooks', 'p1')).toBe('/playground/lorebooks?project=p1')
  })

  it('omits the parameter rather than writing an empty one', () => {
    expect(playgroundPath('cards')).toBe('/playground/cards')
    expect(playgroundPath('cards', null)).toBe('/playground/cards')
  })
})

describe('activeSubsection', () => {
  it('lights the tab for each index', () => {
    for (const section of SUBSECTIONS) {
      expect(activeSubsection(`/playground/${section.slug}`)).toBe(section.slug)
    }
  })

  it('keeps a detail page inside its own section', () => {
    // A card's page is still Cards and a conversation is still Chats. Without
    // this, opening either leaves every tab unlit.
    expect(activeSubsection('/playground/cards/abc')).toBe('cards')
    expect(activeSubsection('/playground/chats/xyz')).toBe('chats')
  })

  it('claims nothing outside the Playground, or inside it but unknown', () => {
    expect(activeSubsection('/playground')).toBeNull()
    expect(activeSubsection('/playground/nonsense')).toBeNull()
    expect(activeSubsection('/almanac')).toBeNull()
    expect(activeSubsection('/playgrounds/cards')).toBeNull()
  })
})
