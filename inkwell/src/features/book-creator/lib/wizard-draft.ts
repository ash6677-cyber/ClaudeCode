/**
 * The Book Creator's memory.
 *
 * The wizard used to hold everything in component state, which meant one
 * accidental back-press — and on a phone, back is a reflex — threw away up
 * to four steps of typed work with no warning and no way back. Two rules
 * fix that, and this module is the second of them:
 *
 *  1. every step lives in the URL, so back means "previous step";
 *  2. the draft lives here, so even leaving the wizard loses nothing.
 *
 * localStorage rather than the database on purpose: a half-formed idea is
 * not a book yet. It should not sync to other devices, appear in backups,
 * or survive as clutter — it is one device's scratchpad, replaced by real
 * records the moment Create is pressed.
 */

import type { CastItem } from '@/features/book-creator/components/cast-step'
import type { ConceptDraft } from '@/features/book-creator/components/concept-step'
import type { OutlineItem } from '@/features/book-creator/components/outline-step'

const KEY = 'inkwell-book-draft'

export interface WizardDraft {
  concept: ConceptDraft
  chapterCount: number
  chapters: OutlineItem[]
  castCount: number
  cast: CastItem[]
  /** The step the writer was on, as a step id, so resume lands them there. */
  step: string
  furthestIndex: number
  savedAt: number
}

/**
 * Whether there is anything in the draft worth keeping.
 *
 * A pristine wizard writes nothing: an empty draft in storage would make
 * every future visit open with a "resume?" banner for nothing.
 */
export function draftHasContent(draft: Pick<WizardDraft, 'concept' | 'chapters' | 'cast'>): boolean {
  const { concept, chapters, cast } = draft
  return (
    concept.title.trim() !== '' ||
    concept.author.trim() !== '' ||
    concept.genre.trim() !== '' ||
    concept.synopsis.trim() !== '' ||
    chapters.length > 0 ||
    cast.length > 0
  )
}

export function readDraft(storage: Storage = localStorage): WizardDraft | null {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WizardDraft
    // Enough shape-checking to trust it: a hand-edited or future-version
    // draft that does not look like a draft is treated as no draft, not as
    // a crash on the wizard's first render.
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.concept || typeof parsed.concept.title !== 'string') return null
    if (!Array.isArray(parsed.chapters) || !Array.isArray(parsed.cast)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeDraft(draft: WizardDraft, storage: Storage = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(draft))
  } catch {
    // Quota or private mode. The wizard still works; it just cannot promise
    // resume — and promising quietly less is better than crashing loudly.
  }
}

export function clearDraft(storage: Storage = localStorage): void {
  try {
    storage.removeItem(KEY)
  } catch {
    // Nothing to do; worst case the resume banner reappears once.
  }
}

/**
 * Which step a URL may actually open.
 *
 * The step lives in the URL so history works, and a URL is writable by
 * hand — so `?step=review` on a blank wizard has to clamp back to the
 * furthest step actually reached, exactly like the stepper's own buttons.
 */
export function resolveStepIndex(
  stepIds: readonly string[],
  param: string | null,
  furthestIndex: number,
): number {
  const wanted = param === null ? 0 : stepIds.indexOf(param)
  if (wanted < 0) return 0
  return Math.min(wanted, Math.max(0, Math.min(furthestIndex, stepIds.length - 1)))
}
