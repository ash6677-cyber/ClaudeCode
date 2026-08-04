import type { CharacterCard } from '@/types'

/**
 * Finding one character in a cast.
 *
 * A grid is a lovely way to show eight characters and a bad way to show
 * thirty: past a screenful, "which one was the innkeeper" becomes scanning by
 * eye. Tags were already on the record and did nothing at all, which is worse
 * than not having them — the writer had filed their cast and got nothing back
 * for it.
 */

export type CardSort = 'edited' | 'name'

export const SORT_LABEL: Record<CardSort, string> = {
  edited: 'Recently edited',
  name: 'Name',
}

export interface CardFilterState {
  query: string
  /** Every selected tag must be present — narrowing, not widening. */
  tags: string[]
  sort: CardSort
}

export const EMPTY_FILTER: CardFilterState = { query: '', tags: [], sort: 'edited' }

export function filterIsEmpty(filter: CardFilterState): boolean {
  return filter.query.trim() === '' && filter.tags.length === 0
}

/**
 * Every tag in the cast, most-used first, then alphabetically.
 *
 * Frequency first because the tags worth offering as chips are the ones that
 * actually divide the cast; a tag used once is a filter that hides everyone.
 */
export function allTags(cards: CharacterCard[]): string[] {
  const counts = new Map<string, number>()
  for (const card of cards) {
    for (const raw of card.tags) {
      const tag = raw.trim()
      if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag)
}

/**
 * Matching is on name, tags and the one-line description — the three things a
 * writer would say out loud to describe who they are looking for. Not the full
 * personality prose: searching "she" should not return the whole cast.
 */
function matchesQuery(card: CharacterCard, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (card.displayName.toLowerCase().includes(q)) return true
  if (card.description.toLowerCase().includes(q)) return true
  return card.tags.some((t) => t.toLowerCase().includes(q))
}

function matchesTags(card: CharacterCard, tags: string[]): boolean {
  if (tags.length === 0) return true
  const own = card.tags.map((t) => t.trim().toLowerCase())
  return tags.every((t) => own.includes(t.trim().toLowerCase()))
}

export function applyCardFilter(
  cards: CharacterCard[],
  filter: CardFilterState,
): CharacterCard[] {
  const kept = cards.filter((c) => matchesQuery(c, filter.query) && matchesTags(c, filter.tags))
  const sorted = [...kept]
  if (filter.sort === 'name') {
    sorted.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
    )
  } else {
    sorted.sort((a, b) => b.updatedAt - a.updatedAt)
  }
  return sorted
}

/** Toggling a tag chip on or off, without caring which it was. */
export function toggleTag(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]
}
