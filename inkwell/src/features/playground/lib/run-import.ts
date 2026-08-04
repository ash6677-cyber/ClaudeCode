import {
  mapEntryToCard,
  type ImportPlan,
  type PlannedImport,
} from '@/features/playground/lib/import-characters'
import { cardRepo, imageAssetRepo } from '@/lib/db/repositories'
import type { CharacterCard, ImageAsset } from '@/types'

/**
 * Carrying out an import, and being able to take it back.
 *
 * `import-characters.ts` decides what will happen; this does it. The split is
 * the point — every judgement is testable without a database, and this file
 * is small enough to read in one go, which matters because it is the part
 * that writes.
 *
 * Undo is not "delete what we made". Replacing a card overwrites fields that
 * were someone's work, so the journal keeps the exact previous values and
 * puts them back. Anything less would make Undo a second destructive act.
 */

/** What a card looked like before an import touched it. */
export interface CardPreImage {
  id: string
  displayName: string
  description: string
  personality: string
  tags: string[]
  avatarImageId: string | null
  cropSettings: CharacterCard['cropSettings']
  codexEntryId: string | null
}

export interface ImportJournal {
  /** Cards this run brought into existence. */
  createdCardIds: string[]
  /**
   * Portraits copied while *replacing* a card. Undo restores the card's
   * previous portrait, which leaves these referenced by nothing at all, so
   * they are safe to remove. Portraits copied for newly created cards are
   * deliberately not listed: those cards go to the bin rather than
   * disappearing, and a card restored without its face would be worse than
   * an unused image nobody can see.
   */
  replacementImageIds: string[]
  /** Exactly what each replaced card held before. */
  replaced: CardPreImage[]
}

export interface ImportOutcome {
  created: number
  replaced: number
  skipped: number
  /** Entries that threw. The run continues; these are reported, not swallowed. */
  failed: { name: string; message: string }[]
  journal: ImportJournal
}

export interface ImportOptions {
  projectId: string
  /** Keep `codexEntryId`, so the card can be refreshed from the Almanac later. */
  linked: boolean
  onProgress?: (done: number, total: number) => void
}

/**
 * The two tables this writes to, named rather than imported at the point of
 * use. Undo has to be provably exact, and "provably" means a test that can
 * hold the before and after in its hands without standing up a database.
 */
export interface ImportDeps {
  cards: {
    create(data: Omit<CharacterCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<CharacterCard>
    update(id: string, changes: Partial<CharacterCard>): Promise<void>
    bulkRemove(ids: string[]): Promise<void>
  }
  images: {
    get(id: string): Promise<ImageAsset | undefined>
    create(data: Omit<ImageAsset, 'id' | 'createdAt' | 'updatedAt'>): Promise<ImageAsset>
    remove(id: string): Promise<void>
  }
}

const LIVE: ImportDeps = { cards: cardRepo, images: imageAssetRepo }

function preImage(card: CharacterCard): CardPreImage {
  return {
    id: card.id,
    displayName: card.displayName,
    description: card.description,
    personality: card.personality,
    tags: [...card.tags],
    avatarImageId: card.avatarImageId,
    cropSettings: card.cropSettings,
    codexEntryId: card.codexEntryId,
  }
}

/**
 * Copies an Almanac portrait so the card owns its own bytes.
 *
 * Sharing the id would be cheaper and wrong: deleting the Almanac entry would
 * blank the card's face, and cropping one would crop the other. The writer
 * owns their device; a duplicated portrait is the correct trade.
 */
async function copyPortrait(
  sourceImageId: string | null,
  deps: ImportDeps,
): Promise<string | null> {
  if (!sourceImageId) return null
  const source = await deps.images.get(sourceImageId)
  if (!source) return null
  const copy = await deps.images.create({
    blob: source.blob,
    mimeType: source.mimeType,
    width: source.width,
    height: source.height,
    fileName: source.fileName,
  })
  return copy.id
}

async function applyOne(
  item: PlannedImport,
  options: ImportOptions,
  journal: ImportJournal,
  deps: ImportDeps,
): Promise<'created' | 'replaced' | 'skipped'> {
  if (item.action === 'skip') return 'skipped'

  const mapped = mapEntryToCard(item.entry)
  const codexEntryId = options.linked ? item.entry.id : null

  if (item.action === 'create') {
    const avatarImageId = await copyPortrait(mapped.sourceImageId, deps)
    const card = await deps.cards.create({
      projectId: options.projectId,
      codexEntryId,
      displayName: item.displayName,
      avatarImageId,
      cropSettings: null,
      description: mapped.description,
      personality: mapped.personality,
      scenario: '',
      firstMessage: '',
      exampleDialogue: [],
      systemPromptOverride: null,
      voiceNotes: '',
      tags: mapped.tags,
    })
    journal.createdCardIds.push(card.id)
    return 'created'
  }

  const existing = item.existing
  if (!existing) return 'skipped'
  journal.replaced.push(preImage(existing))

  // Only ever the written fields, plus a portrait when the Almanac has one.
  // Design, conversations, scenario, first message, example dialogue and
  // voice notes are the writer's, not the Almanac's, and stay untouched — a
  // card that lost its look on a refresh would make "Update" unusable.
  const changes: Partial<CharacterCard> = {
    displayName: item.displayName,
    description: mapped.description,
    personality: mapped.personality,
    tags: mapped.tags,
    codexEntryId,
  }
  if (mapped.sourceImageId) {
    const avatarImageId = await copyPortrait(mapped.sourceImageId, deps)
    if (avatarImageId) {
      journal.replacementImageIds.push(avatarImageId)
      changes.avatarImageId = avatarImageId
      // The crop belonged to the previous portrait and means nothing on this
      // one; keeping it would frame the new face by the old one's geometry.
      changes.cropSettings = null
    }
  }
  await deps.cards.update(existing.id, changes)
  return 'replaced'
}

export async function runImport(
  plan: ImportPlan,
  options: ImportOptions,
  deps: ImportDeps = LIVE,
): Promise<ImportOutcome> {
  const journal: ImportJournal = { createdCardIds: [], replacementImageIds: [], replaced: [] }
  const outcome: ImportOutcome = {
    created: 0,
    replaced: 0,
    skipped: 0,
    failed: [],
    journal,
  }

  let done = 0
  for (const item of plan.items) {
    try {
      const result = await applyOne(item, options, journal, deps)
      outcome[result] += 1
    } catch (error) {
      // One bad entry should not cost the writer the other twenty-nine.
      outcome.failed.push({
        name: item.displayName || 'Unnamed entry',
        message: error instanceof Error ? error.message : 'Could not import this entry.',
      })
    }
    done += 1
    options.onProgress?.(done, plan.items.length)
  }

  return outcome
}

/**
 * Puts the Playground back as it was.
 *
 * Replaced cards get their previous values restored field by field from the
 * journal — undo cannot itself be a destructive act, and "delete what we
 * made" would leave overwritten work overwritten.
 *
 * Created cards go to the bin, which is what a delete means everywhere else
 * in this app. An undo pressed by mistake is then still recoverable, and the
 * grid reads exactly as it did before either way, since binned records are
 * filtered out of every list.
 */
export async function undoImport(
  journal: ImportJournal,
  deps: ImportDeps = LIVE,
): Promise<void> {
  for (const before of journal.replaced) {
    await deps.cards.update(before.id, {
      displayName: before.displayName,
      description: before.description,
      personality: before.personality,
      tags: before.tags,
      avatarImageId: before.avatarImageId,
      cropSettings: before.cropSettings,
      codexEntryId: before.codexEntryId,
    })
  }
  if (journal.createdCardIds.length > 0) await deps.cards.bulkRemove(journal.createdCardIds)
  for (const imageId of journal.replacementImageIds) {
    await deps.images.remove(imageId).catch(() => {
      // An unreferenced image is invisible and harmless; failing the undo
      // over one would not be.
    })
  }
}
