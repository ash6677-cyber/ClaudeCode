import { describe, expect, it } from 'vitest'

import {
  appendToEntry,
  appendToSummary,
  cardMatchesEntry,
  cardToEntryFields,
  quoteFrom,
} from './writeback'
import type { CharacterCard, CodexEntry } from '@/types'

const doc = (...texts: string[]) => ({
  type: 'doc',
  content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
})

describe('appending to an Almanac entry', () => {
  it('adds to the end and leaves what was there alone', () => {
    // A chat is where you discover things; the Almanac is where you keep
    // them. Nothing here may overwrite.
    const result = appendToEntry(doc('She grew up inland.'), 'She grew up inland.', ['Mira: “I hate the sea.”'])
    expect(result.body).toEqual(doc('She grew up inland.', 'Mira: “I hate the sea.”'))
    expect(result.plainText).toBe('She grew up inland.\n\nMira: “I hate the sea.”')
  })

  it('turns an entry that was never opened into a real document', () => {
    // Entries start with body: '' — appending must not produce something the
    // editor then refuses to load.
    const result = appendToEntry('', '', ['A line.'])
    expect(result.body).toEqual(doc('A line.'))
    expect(result.plainText).toBe('A line.')
  })

  it('rescues text that was not in a document it understands', () => {
    const result = appendToEntry(null, 'Older notes.', ['A line.'])
    expect(result.body).toEqual(doc('Older notes.', 'A line.'))
    expect(result.plainText).toBe('Older notes.\n\nA line.')
  })

  it('changes nothing when there is nothing to add', () => {
    const body = doc('Kept.')
    expect(appendToEntry(body, 'Kept.', [])).toEqual({ body, plainText: 'Kept.' })
    expect(appendToEntry(body, 'Kept.', ['   ', ''])).toEqual({ body, plainText: 'Kept.' })
  })

  it('adds several lines as separate paragraphs', () => {
    const result = appendToEntry(doc(), '', ['One.', 'Two.'])
    expect(result.body).toEqual(doc('One.', 'Two.'))
  })
})

describe('appending to a scene summary', () => {
  it('keeps the existing note and separates the new one', () => {
    expect(appendToSummary('They argue.', 'Mira refuses.')).toBe('They argue.\n\nMira refuses.')
  })

  it('does not open with blank lines when there was nothing there', () => {
    expect(appendToSummary('', 'Mira refuses.')).toBe('Mira refuses.')
    expect(appendToSummary('   ', 'Mira refuses.')).toBe('Mira refuses.')
  })

  it('leaves the summary alone when the note is empty', () => {
    expect(appendToSummary('They argue.', '  ')).toBe('They argue.')
  })
})

describe('quoteFrom', () => {
  it('attributes the line, so it still makes sense in a month', () => {
    expect(quoteFrom('Mira', 'I hate the sea.')).toBe('Mira: “I hate the sea.”')
  })

  it('flattens the whitespace a streamed reply arrives with', () => {
    expect(quoteFrom('Mira', '  I hate\n  the sea.  ')).toBe('Mira: “I hate the sea.”')
  })

  it('produces nothing from nothing rather than an empty quotation', () => {
    expect(quoteFrom('Mira', '   ')).toBe('')
  })
})

describe('sending a card back to the Almanac', () => {
  const card = {
    displayName: '  Mira  ',
    description: 'A salt trader.',
    personality: 'Blunt.',
    tags: ['lead'],
  } as CharacterCard

  it('maps only the fields an entry actually has', () => {
    // An entry has nowhere to put a scenario or a first message, and
    // inventing somewhere would make the round trip lossy.
    expect(cardToEntryFields(card)).toEqual({
      name: 'Mira',
      summary: 'A salt trader.',
      tags: ['lead'],
    })
  })
})

describe('cardMatchesEntry', () => {
  const entry = {
    id: 'e1',
    name: 'Mira',
    aliases: [],
    summary: 'A salt trader.',
    plainText: 'Blunt.',
    tags: ['lead'],
  } as unknown as CodexEntry

  it('is true when a pull would change nothing', () => {
    // A refresh button that does nothing still feels like it did something,
    // so the card has to be able to say "already up to date".
    const card = {
      displayName: 'Mira',
      description: 'A salt trader.',
      personality: 'Blunt.',
      tags: ['lead'],
    } as CharacterCard
    expect(cardMatchesEntry(card, entry)).toBe(true)
  })

  it('is false the moment any mapped field differs', () => {
    const base = {
      displayName: 'Mira',
      description: 'A salt trader.',
      personality: 'Blunt.',
      tags: ['lead'],
    } as CharacterCard
    expect(cardMatchesEntry({ ...base, description: 'changed' } as CharacterCard, entry)).toBe(false)
    expect(cardMatchesEntry({ ...base, personality: 'changed' } as CharacterCard, entry)).toBe(false)
    expect(cardMatchesEntry({ ...base, tags: [] } as CharacterCard, entry)).toBe(false)
  })
})
