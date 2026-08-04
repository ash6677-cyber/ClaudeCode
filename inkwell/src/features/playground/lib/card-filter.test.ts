import { describe, expect, it } from 'vitest'

import {
  EMPTY_FILTER,
  allTags,
  applyCardFilter,
  filterIsEmpty,
  toggleTag,
  type CardFilterState,
} from './card-filter'
import type { CharacterCard } from '@/types'

function card(changes: Partial<CharacterCard> & { displayName: string }): CharacterCard {
  return {
    id: changes.displayName.toLowerCase(),
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

const cast = [
  card({ displayName: 'Mira', description: 'The salt trader', tags: ['lead', 'caravan'], updatedAt: 30 }),
  card({ displayName: 'elenya', description: 'A border guard', tags: ['caravan'], updatedAt: 20 }),
  card({ displayName: 'Tomas', description: 'Innkeeper at the pass', tags: ['minor'], updatedAt: 10 }),
]

const filter = (changes: Partial<CardFilterState> = {}): CardFilterState => ({
  ...EMPTY_FILTER,
  ...changes,
})

describe('applyCardFilter', () => {
  it('returns everyone when nothing is asked for', () => {
    expect(applyCardFilter(cast, EMPTY_FILTER).map((c) => c.displayName)).toEqual([
      'Mira',
      'elenya',
      'Tomas',
    ])
  })

  it('matches a name, a description or a tag — the three ways you would say it', () => {
    expect(applyCardFilter(cast, filter({ query: 'mira' })).map((c) => c.displayName)).toEqual(['Mira'])
    expect(applyCardFilter(cast, filter({ query: 'innkeep' })).map((c) => c.displayName)).toEqual([
      'Tomas',
    ])
    expect(applyCardFilter(cast, filter({ query: 'caravan' })).map((c) => c.displayName)).toEqual([
      'Mira',
      'elenya',
    ])
  })

  it('ignores case and surrounding space', () => {
    expect(applyCardFilter(cast, filter({ query: '  ELENYA ' })).map((c) => c.displayName)).toEqual([
      'elenya',
    ])
  })

  it('narrows with each tag rather than widening', () => {
    // Two chips means "both", which is the only reading that makes a second
    // chip useful.
    expect(applyCardFilter(cast, filter({ tags: ['caravan'] })).length).toBe(2)
    expect(applyCardFilter(cast, filter({ tags: ['caravan', 'lead'] })).map((c) => c.displayName)).toEqual([
      'Mira',
    ])
    expect(applyCardFilter(cast, filter({ tags: ['caravan', 'minor'] }))).toEqual([])
  })

  it('combines text and tags', () => {
    expect(
      applyCardFilter(cast, filter({ query: 'border', tags: ['caravan'] })).map((c) => c.displayName),
    ).toEqual(['elenya'])
  })

  it('sorts by name without case deciding the order', () => {
    // A cast sorted with capitals first is not sorted as far as a reader is
    // concerned.
    expect(applyCardFilter(cast, filter({ sort: 'name' })).map((c) => c.displayName)).toEqual([
      'elenya',
      'Mira',
      'Tomas',
    ])
  })

  it('sorts by most recently edited', () => {
    expect(applyCardFilter(cast, filter({ sort: 'edited' })).map((c) => c.displayName)).toEqual([
      'Mira',
      'elenya',
      'Tomas',
    ])
  })

  it('does not reorder the caller’s array', () => {
    const original = [...cast]
    applyCardFilter(cast, filter({ sort: 'name' }))
    expect(cast).toEqual(original)
  })
})

describe('allTags', () => {
  it('offers the tags that actually divide the cast first', () => {
    expect(allTags(cast)).toEqual(['caravan', 'lead', 'minor'])
  })

  it('drops blanks and does not repeat itself', () => {
    const messy = [card({ displayName: 'A', tags: ['  ', 'x', 'x'] }), card({ displayName: 'B', tags: ['x'] })]
    expect(allTags(messy)).toEqual(['x'])
  })
})

describe('filter state', () => {
  it('knows when nothing is being asked of it', () => {
    expect(filterIsEmpty(EMPTY_FILTER)).toBe(true)
    expect(filterIsEmpty(filter({ sort: 'name' }))).toBe(true) // a sort is not a filter
    expect(filterIsEmpty(filter({ query: '  ' }))).toBe(true)
    expect(filterIsEmpty(filter({ query: 'a' }))).toBe(false)
    expect(filterIsEmpty(filter({ tags: ['x'] }))).toBe(false)
  })

  it('toggles a chip both ways', () => {
    expect(toggleTag([], 'x')).toEqual(['x'])
    expect(toggleTag(['x'], 'x')).toEqual([])
    expect(toggleTag(['x'], 'y')).toEqual(['x', 'y'])
  })
})
