import { db } from '@/lib/db/schema'

/**
 * Checking that the library still holds together.
 *
 * Everything lives on one device, and the only proof it is intact has been
 * whether the app happens to render. A scene whose chapter was removed, a
 * card pointing at a portrait that no longer exists, a snapshot of a deleted
 * scene — none of those break anything visibly. They just sit there, taking
 * up room and quietly meaning nothing, and a writer has no way to ask.
 *
 * This is that question, answered in one pass and in plain language. It reads
 * and reports; it never repairs. Deciding what to do about an orphan is the
 * writer's, and a self-healing routine that silently deleted the wrong thing
 * would be a far worse bug than the one it fixed.
 */

export interface IntegrityCount {
  table: string
  records: number
}

export interface IntegrityProblem {
  /** What is broken, in the writer's terms. */
  what: string
  /** How many records are affected. */
  count: number
  /** A couple of names, so it is recognisable rather than statistical. */
  examples: string[]
}

export interface IntegrityReport {
  checkedAt: number
  counts: IntegrityCount[]
  problems: IntegrityProblem[]
  /** Records in the bin, which are intentional and not problems. */
  inBin: number
}

const alive = <T extends { deletedAt?: number | null }>(rows: T[]) =>
  rows.filter((r) => typeof r.deletedAt !== 'number')

function sample(names: (string | undefined)[]): string[] {
  return names.filter((n): n is string => Boolean(n?.trim())).slice(0, 3)
}

export async function runIntegrityCheck(): Promise<IntegrityReport> {
  const [projects, chapters, scenes, snapshots, codexEntries, cards, chats, covers, images] =
    await Promise.all([
      db.projects.toArray(),
      db.chapters.toArray(),
      db.scenes.toArray(),
      db.snapshots.toArray(),
      db.codexEntries.toArray(),
      db.characterCards.toArray(),
      db.cardChats.toArray(),
      db.covers.toArray(),
      db.imageAssets.toArray(),
    ])

  const liveProjects = alive(projects)
  const liveChapters = alive(chapters)
  const liveScenes = alive(scenes)
  const liveCards = alive(cards)

  const projectIds = new Set(liveProjects.map((p) => p.id))
  const chapterIds = new Set(liveChapters.map((c) => c.id))
  const sceneIds = new Set(liveScenes.map((s) => s.id))
  const entryIds = new Set(alive(codexEntries).map((e) => e.id))
  const cardIds = new Set(liveCards.map((c) => c.id))
  const imageIds = new Set(images.map((i) => i.id))

  const problems: IntegrityProblem[] = []
  const note = (what: string, rows: { name?: string }[]) => {
    if (rows.length > 0) {
      problems.push({ what, count: rows.length, examples: sample(rows.map((r) => r.name)) })
    }
  }

  note(
    'Chapters whose book is gone',
    liveChapters.filter((c) => !projectIds.has(c.projectId)).map((c) => ({ name: c.title })),
  )
  note(
    'Scenes whose chapter is gone',
    liveScenes.filter((s) => !chapterIds.has(s.chapterId)).map((s) => ({ name: s.title })),
  )
  note(
    'Saved versions of a scene that no longer exists',
    alive(snapshots)
      .filter((s) => !sceneIds.has(s.sceneId))
      .map((s) => ({ name: s.label })),
  )
  note(
    'Character cards whose book is gone',
    liveCards.filter((c) => !projectIds.has(c.projectId)).map((c) => ({ name: c.displayName })),
  )
  note(
    'Cards linked to an Almanac entry that is gone',
    liveCards
      .filter((c) => c.codexEntryId !== null && !entryIds.has(c.codexEntryId))
      .map((c) => ({ name: c.displayName })),
  )
  note(
    'Conversations whose character is gone',
    alive(chats)
      .filter((c) => !cardIds.has(c.cardId))
      .map((c) => ({ name: c.title })),
  )
  note(
    'Cards pointing at a missing portrait',
    liveCards
      .filter((c) => c.avatarImageId !== null && !imageIds.has(c.avatarImageId))
      .map((c) => ({ name: c.displayName })),
  )
  note(
    'Covers whose book is gone',
    alive(covers).filter((c) => !projectIds.has(c.projectId)).map(() => ({ name: undefined })),
  )

  const counts: IntegrityCount[] = [
    { table: 'Books', records: liveProjects.length },
    { table: 'Chapters', records: liveChapters.length },
    { table: 'Scenes', records: liveScenes.length },
    { table: 'Saved versions', records: alive(snapshots).length },
    { table: 'Almanac entries', records: alive(codexEntries).length },
    { table: 'Character cards', records: liveCards.length },
    { table: 'Conversations', records: alive(chats).length },
    { table: 'Covers', records: alive(covers).length },
    { table: 'Images', records: images.length },
  ]

  const inBin =
    projects.length -
    liveProjects.length +
    (chapters.length - liveChapters.length) +
    (scenes.length - liveScenes.length) +
    (cards.length - liveCards.length)

  return { checkedAt: Date.now(), counts, problems, inBin }
}

/** The report as text, for the copy button — a person can paste this at me. */
export function formatIntegrityReport(report: IntegrityReport): string {
  const lines = [
    `Inkwell library check — ${new Date(report.checkedAt).toLocaleString()}`,
    '',
    ...report.counts.map((c) => `${c.table}: ${c.records}`),
    `In the bin: ${report.inBin}`,
    '',
  ]
  if (report.problems.length === 0) {
    lines.push('No problems found.')
  } else {
    lines.push('Problems:')
    for (const p of report.problems) {
      const examples = p.examples.length > 0 ? ` (e.g. ${p.examples.join(', ')})` : ''
      lines.push(`- ${p.what}: ${p.count}${examples}`)
    }
  }
  return lines.join('\n')
}
