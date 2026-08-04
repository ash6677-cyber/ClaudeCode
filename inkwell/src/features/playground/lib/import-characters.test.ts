import { describe, expect, it } from 'vitest'

import {
  copyName,
  describeMapping,
  findExisting,
  mapEntryToCard,
  planImport,
  summarize,
} from './import-characters'
import type { CharacterCard, CodexEntry } from '@/types'

function entry(changes: Partial<CodexEntry> & { name: string }): CodexEntry {
  return {
    id: `e-${changes.name.toLowerCase()}`,
    createdAt: 0,
    updatedAt: 0,
    projectId: 'p1',
    seriesId: null,
    type: 'character',
    aliases: [],
    summary: '',
    body: null,
    plainText: '',
    attributes: [],
    relationships: [],
    imageId: null,
    tags: [],
    aiContext: 'when-relevant',
    aiContextTokenBudget: null,
    ...changes,
  } as CodexEntry
}

function card(changes: Partial<CharacterCard> & { displayName: string }): CharacterCard {
  return {
    id: `c-${changes.displayName.toLowerCase()}`,
    createdAt: 0,
    updatedAt: 0,
    projectId: 'p1',
    codexEntryId: null,
    avatarImageId: null,
    cropSettings: null,
    description: '',
    personality: '',
    scenario: '',
    firstMessage: '',
    exampleDialogue: [],
    systemPromptOverride: null,
    voiceNotes: '',
    tags: [],
    ...changes,
  } as CharacterCard
}

describe('mapEntryToCard', () => {
  it('takes each field to the one that means the same thing', () => {
    const mapped = mapEntryToCard(
      entry({
        name: 'Mira',
        summary: 'A salt trader from the low country.',
        plainText: 'Blunt, watchful, laughs late.',
        tags: ['lead', 'caravan'],
        imageId: 'img-1',
      }),
    )
    expect(mapped).toEqual({
      displayName: 'Mira',
      description: 'A salt trader from the low country.',
      personality: 'Blunt, watchful, laughs late.',
      tags: ['lead', 'caravan'],
      sourceImageId: 'img-1',
    })
  })

  it('keeps aliases rather than dropping them silently', () => {
    // A card has nowhere else to put them, and losing "also called the Grey
    // Fox" without saying so is worse than a slightly long first line.
    const mapped = mapEntryToCard(
      entry({ name: 'Renn', aliases: ['the Grey Fox', 'Ren'], summary: 'A thief.' }),
    )
    expect(mapped.description).toBe('Also known as the Grey Fox, Ren. A thief.')
  })

  it('survives an entry with nothing filled in', () => {
    expect(mapEntryToCard(entry({ name: '  Bare  ' }))).toEqual({
      displayName: 'Bare',
      description: '',
      personality: '',
      tags: [],
      sourceImageId: null,
    })
  })

  it('describes every pair for the review screen, blanks included', () => {
    const rows = describeMapping(entry({ name: 'Bare' }))
    expect(rows.map((r) => r.to)).toEqual([
      'Card name',
      'Description',
      'Personality',
      'Card portrait',
      'Tags',
    ])
    // A field with no source has to appear and be visibly empty; hiding the
    // row would let a writer think it came across.
    expect(rows.filter((r) => r.value === '').length).toBe(4)
  })
})

describe('findExisting', () => {
  it('trusts the link over the name', () => {
    // A card imported from this entry and then renamed is still this entry's
    // card.
    const renamed = card({ displayName: 'Mira Vale', codexEntryId: 'e-mira' })
    expect(findExisting(entry({ name: 'Mira' }), [renamed])?.id).toBe(renamed.id)
  })

  it('falls back to the name, ignoring case, for hand-made cards', () => {
    const typed = card({ displayName: '  mira ' })
    expect(findExisting(entry({ name: 'Mira' }), [typed])?.id).toBe(typed.id)
  })

  it('finds nothing for a genuinely new character', () => {
    expect(findExisting(entry({ name: 'Tomas' }), [card({ displayName: 'Mira' })])).toBeUndefined()
  })
})

describe('planImport', () => {
  const entries = [entry({ name: 'Mira' }), entry({ name: 'Tomas' })]
  const existing = [card({ displayName: 'Mira' })]

  it('creates what is new whatever the strategy', () => {
    for (const strategy of ['skip', 'replace', 'copy'] as const) {
      const plan = planImport([entry({ name: 'Tomas' })], existing, strategy)
      expect(plan.creates).toBe(1)
      expect(plan.items[0].action).toBe('create')
    }
  })

  it('skip leaves the existing card alone', () => {
    const plan = planImport(entries, existing, 'skip')
    expect([plan.creates, plan.replaces, plan.skips]).toEqual([1, 0, 1])
    expect(plan.items[0]).toMatchObject({ action: 'skip', displayName: 'Mira' })
  })

  it('replace updates it in place', () => {
    const plan = planImport(entries, existing, 'replace')
    expect([plan.creates, plan.replaces, plan.skips]).toEqual([1, 1, 0])
    expect(plan.items[0].existing?.id).toBe('c-mira')
  })

  it('copy keeps both, numbered so they can be told apart', () => {
    const plan = planImport(entries, existing, 'copy')
    expect([plan.creates, plan.replaces, plan.skips]).toEqual([2, 0, 0])
    expect(plan.items[0].displayName).toBe('Mira (2)')
  })

  it('numbers a second copy in the same run rather than colliding with the first', () => {
    // Both entries are called Mira; without projecting the run's own results
    // they would both claim "(2)".
    const plan = planImport(
      [entry({ id: 'a', name: 'Mira' }), entry({ id: 'b', name: 'Mira' })],
      existing,
      'copy',
    )
    expect(plan.items.map((i) => i.displayName)).toEqual(['Mira (2)', 'Mira (3)'])
  })

  it('does not import a character with no name', () => {
    // A card with no name cannot be found again, which makes it litter.
    const plan = planImport([entry({ name: '   ' })], [], 'replace')
    expect(plan.skips).toBe(1)
    expect(plan.items[0].reason).toMatch(/no name/i)
  })

  it('never mutates the card list it was given', () => {
    const cards = [card({ displayName: 'Mira' })]
    const before = JSON.stringify(cards)
    planImport(entries, cards, 'copy')
    expect(JSON.stringify(cards)).toBe(before)
  })

  it('counts add up to the number of entries, always', () => {
    for (const strategy of ['skip', 'replace', 'copy'] as const) {
      const plan = planImport(entries, existing, strategy)
      expect(plan.creates + plan.replaces + plan.skips).toBe(entries.length)
    }
  })
})

describe('copyName', () => {
  it('leaves a free name alone', () => {
    expect(copyName('Mira', [])).toBe('Mira')
  })

  it('steps past every number already taken', () => {
    const taken = [card({ displayName: 'Mira' }), card({ displayName: 'Mira (2)' })]
    expect(copyName('Mira', taken)).toBe('Mira (3)')
  })
})

describe('summarize', () => {
  it('says only what happened', () => {
    expect(summarize({ created: 14, replaced: 1, skipped: 3 })).toBe(
      '14 imported · 1 updated · 3 skipped',
    )
    expect(summarize({ created: 2, replaced: 0, skipped: 0 })).toBe('2 imported')
    expect(summarize({ created: 0, replaced: 0, skipped: 0 })).toBe('Nothing to import')
  })
})
