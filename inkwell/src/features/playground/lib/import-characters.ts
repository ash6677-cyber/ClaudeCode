import type { CharacterCard, CodexEntry } from '@/types'

/**
 * Bringing a cast that already exists into the Playground.
 *
 * A writer with thirty characters in the Almanac used to open the Playground
 * and find it empty, then type all thirty in again. The Almanac entry already
 * holds everything a card needs; nothing was missing but the wiring.
 *
 * Everything in this module is a pure function of its inputs. Deciding what a
 * bulk import will do is exactly the part that has to be shown to the writer
 * before it happens and tested without a database — so the plan is computed
 * here and merely carried out elsewhere.
 */

/** What to do when a character is already in the Playground. */
export type DuplicateStrategy = 'skip' | 'replace' | 'copy'

export const STRATEGY_LABEL: Record<DuplicateStrategy, string> = {
  skip: 'Skip them',
  replace: 'Update them',
  copy: 'Add a second card',
}

export const STRATEGY_HINT: Record<DuplicateStrategy, string> = {
  skip: 'Leave the card you already have exactly as it is.',
  replace: 'Refresh the written fields from the Almanac. Design and chats are kept.',
  copy: 'Keep both, the new one marked "(2)".',
}

/** Which fields a card takes from an entry, said once, in the writer's words. */
export interface FieldMapping {
  from: string
  to: string
  /** The value this entry actually supplies, for the preview. */
  value: string
}

/** The written half of a card — everything an import may set. */
export interface MappedCardFields {
  displayName: string
  description: string
  personality: string
  tags: string[]
  /** The Almanac image to copy. Copied, never shared: see `planImport`. */
  sourceImageId: string | null
}

const clean = (s: string | undefined | null) => (typeof s === 'string' ? s.trim() : '')

/**
 * An Almanac entry as the written half of a card.
 *
 * Aliases go into the description rather than a field of their own, because a
 * card has nowhere else to put them and losing "also called the Grey Fox"
 * silently would be worse than a slightly long first line.
 */
export function mapEntryToCard(entry: CodexEntry): MappedCardFields {
  const aliases = (entry.aliases ?? []).map(clean).filter(Boolean)
  const summary = clean(entry.summary)
  const description = [
    aliases.length > 0 ? `Also known as ${aliases.join(', ')}.` : '',
    summary,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    displayName: clean(entry.name),
    description,
    // The Almanac keeps prose as rich text plus a flattened copy; the card is
    // a plain-text field, so the flattened copy is the honest source.
    personality: clean(entry.plainText),
    tags: (entry.tags ?? []).map(clean).filter(Boolean),
    sourceImageId: entry.imageId ?? null,
  }
}

/** The same mapping, spelled out for the review screen. */
export function describeMapping(entry: CodexEntry): FieldMapping[] {
  const mapped = mapEntryToCard(entry)
  return [
    { from: 'Name', to: 'Card name', value: mapped.displayName },
    { from: 'Summary (and aliases)', to: 'Description', value: mapped.description },
    { from: 'Entry text', to: 'Personality', value: mapped.personality },
    { from: 'Portrait', to: 'Card portrait', value: mapped.sourceImageId ? 'Copied' : '' },
    { from: 'Tags', to: 'Tags', value: mapped.tags.join(', ') },
  ]
}

/**
 * Fields a card has that the Almanac has no opinion about, so an import must
 * never touch them — this is what "Update them" means and does not mean.
 */
export const UNTOUCHED_BY_IMPORT = [
  'Card design',
  'Conversations',
  'Scenario',
  'First message',
  'Example dialogue',
  'Voice notes',
] as const

export type ImportAction = 'create' | 'replace' | 'skip'

export interface PlannedImport {
  entry: CodexEntry
  action: ImportAction
  /** The card this would replace, or the existing card being skipped. */
  existing?: CharacterCard
  /** What the card will be called — a copy gets a suffix. */
  displayName: string
  /** Why, for the review screen. */
  reason: string
}

export interface ImportPlan {
  items: PlannedImport[]
  creates: number
  replaces: number
  skips: number
}

/**
 * The card an entry already has, if any.
 *
 * The link is authoritative when it exists: a card imported from this entry
 * and then renamed is still that entry's card. Name matching is the fallback
 * for cards typed in by hand, and is case-insensitive because "mira" and
 * "Mira" are one character and importing both would be nonsense.
 */
export function findExisting(
  entry: CodexEntry,
  cards: CharacterCard[],
): CharacterCard | undefined {
  const linked = cards.find((c) => c.codexEntryId === entry.id)
  if (linked) return linked
  const name = clean(entry.name).toLowerCase()
  if (!name) return undefined
  return cards.find((c) => c.displayName.trim().toLowerCase() === name)
}

/**
 * A name for a second card that does not collide with the first, or with the
 * "(2)" made last time this was done.
 */
export function copyName(base: string, cards: CharacterCard[]): string {
  const taken = new Set(cards.map((c) => c.displayName.trim().toLowerCase()))
  if (!taken.has(base.trim().toLowerCase())) return base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} (${n})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return base
}

/**
 * Exactly what an import would do, before it does any of it.
 *
 * Nameless entries are skipped rather than imported as a blank card: a card
 * with no name cannot be found again, which makes it litter rather than a
 * character.
 */
export function planImport(
  entries: CodexEntry[],
  existingCards: CharacterCard[],
  strategy: DuplicateStrategy,
): ImportPlan {
  // Grows as the plan is made, so two copies in one run become "(2)" and
  // "(3)" rather than both claiming "(2)".
  const projected: CharacterCard[] = [...existingCards]
  const items: PlannedImport[] = []

  for (const entry of entries) {
    const name = clean(entry.name)
    if (!name) {
      items.push({
        entry,
        action: 'skip',
        displayName: '',
        reason: 'This entry has no name.',
      })
      continue
    }

    const existing = findExisting(entry, projected)
    if (!existing) {
      items.push({ entry, action: 'create', displayName: name, reason: 'New character.' })
      projected.push({ displayName: name, codexEntryId: entry.id } as CharacterCard)
      continue
    }

    if (strategy === 'skip') {
      items.push({
        entry,
        action: 'skip',
        existing,
        displayName: existing.displayName,
        reason: 'Already in the Playground.',
      })
      continue
    }

    if (strategy === 'replace') {
      items.push({
        entry,
        action: 'replace',
        existing,
        displayName: name,
        reason: 'Written fields refreshed from the Almanac.',
      })
      continue
    }

    const copied = copyName(name, projected)
    items.push({ entry, action: 'create', displayName: copied, reason: 'Kept alongside the existing card.' })
    projected.push({ displayName: copied, codexEntryId: entry.id } as CharacterCard)
  }

  return {
    items,
    creates: items.filter((i) => i.action === 'create').length,
    replaces: items.filter((i) => i.action === 'replace').length,
    skips: items.filter((i) => i.action === 'skip').length,
  }
}

/** "14 imported · 3 skipped · 1 updated", with the zeroes left out. */
export function summarize(counts: { created: number; replaced: number; skipped: number }): string {
  const parts: string[] = []
  if (counts.created) parts.push(`${counts.created} imported`)
  if (counts.replaced) parts.push(`${counts.replaced} updated`)
  if (counts.skipped) parts.push(`${counts.skipped} skipped`)
  return parts.length > 0 ? parts.join(' · ') : 'Nothing to import'
}
