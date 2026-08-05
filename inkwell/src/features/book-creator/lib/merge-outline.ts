/**
 * Fitting a generated outline into the shape the writer chose.
 *
 * Two things in the app both claimed to know how a book starts. Templates lay
 * out divisions a novel actually has — a prologue, chapters, an epilogue — and
 * the Book Creator produced a flat run of chapters that ignored them entirely.
 * A writer who picked "Standard novel" in the wizard got no prologue; a writer
 * who picked "Screenplay" got chapters.
 *
 * This is the join, and it is pure so that the awkward cases — an outline
 * longer than the format, shorter than it, or a format with nowhere obvious to
 * put prose — can be settled by tests rather than discovered in a real book.
 *
 * The rule the whole thing turns on: a template says where prose *goes*, an
 * outline says what the prose *is*. So the outline fills the format's writable
 * divisions in order, and the format keeps everything else exactly as it
 * promised — an epilogue stays last even when the outline overruns.
 */

import {
  CHAPTER_KIND_LABEL,
  formatNumber,
  isNumbered,
  type PlannedChapter,
} from '@/features/templates/lib/templates'
import type { ChapterKind, ChapterNumbering } from '@/types'

/** One chapter of the wizard's outline step. */
export interface OutlineEntry {
  title: string
  summary: string
}

export interface MergedChapter extends PlannedChapter {
  /** Goes on the chapter's first scene, which is where the editor shows it. */
  summary: string
}

/**
 * The kind of division this format writes prose into.
 *
 * A novel's is `chapter`; a screenplay's is `act`, because that is the thing
 * holding the scenes. Taking the commonest numbered kind finds both without
 * either being hard-coded, and a format made of nothing but parts and
 * prologues has no answer — so `chapter` stands, and the outline is appended
 * as chapters rather than dropped.
 */
export function fillKindFor(plan: PlannedChapter[]): ChapterKind {
  const counts = new Map<ChapterKind, number>()
  for (const chapter of plan) {
    if (!isNumbered(chapter.kind)) continue
    counts.set(chapter.kind, (counts.get(chapter.kind) ?? 0) + 1)
  }
  let best: ChapterKind = 'chapter'
  let bestCount = 0
  // Insertion order breaks ties, so a format that opens with acts fills acts.
  for (const [kind, count] of counts) {
    if (count > bestCount) {
      best = kind
      bestCount = count
    }
  }
  return best
}

interface MergeOptions {
  numbering: ChapterNumbering
  /** One scene per chapter where the project cannot open a second one. */
  scenesPerChapter?: 'template' | 'one'
}

export function mergeOutline(
  plan: PlannedChapter[],
  outline: OutlineEntry[],
  options: MergeOptions,
): MergedChapter[] {
  const kind = fillKindFor(plan)
  const scenesFor = (planned: PlannedChapter) =>
    options.scenesPerChapter === 'one' ? ['Scene 1'] : planned.scenes

  // A format with no writable divisions at all — Blank, or one made only of
  // parts — has nothing to fill, so the outline becomes the manuscript.
  const slots = plan.filter((c) => c.kind === kind)
  if (slots.length === 0) {
    return outline.map((entry, index) => ({
      kind,
      title: entry.title.trim() || defaultTitle(kind, index + 1, options.numbering),
      scenes: ['Scene 1'],
      summary: entry.summary.trim(),
    }))
  }

  const out: MergedChapter[] = []
  let taken = 0
  let filledSoFar = 0

  for (const planned of plan) {
    if (planned.kind !== kind) {
      // A prologue is not chapter one. It keeps its name and stays empty.
      out.push({ ...planned, scenes: scenesFor(planned), summary: '' })
      continue
    }

    filledSoFar += 1
    const entry = outline[taken]
    if (entry) taken += 1
    out.push({
      ...planned,
      // The format numbered this division; the outline named what happens in
      // it. The name wins when there is one, because "The bridge at dusk" is
      // what the writer will look for in the tree.
      title: entry?.title.trim() || planned.title,
      scenes: scenesFor(planned),
      summary: entry?.summary.trim() ?? '',
    })

    // An outline longer than the format spills here rather than at the end,
    // so an epilogue is still the last thing in the book.
    const lastSlot = filledSoFar === slots.length
    if (lastSlot) {
      let extra = slots.length
      while (taken < outline.length) {
        const spill = outline[taken]
        taken += 1
        extra += 1
        out.push({
          kind,
          title: spill.title.trim() || defaultTitle(kind, extra, options.numbering),
          scenes: ['Scene 1'],
          summary: spill.summary.trim(),
        })
      }
    }
  }

  return out
}

function defaultTitle(kind: ChapterKind, n: number, numbering: ChapterNumbering): string {
  return `${CHAPTER_KIND_LABEL[kind]} ${formatNumber(n, numbering)}`
}
