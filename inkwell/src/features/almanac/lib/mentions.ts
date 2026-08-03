/**
 * Where the world actually turns up in the book.
 *
 * The editor already underlines a character's name wherever it appears in a
 * scene. The same matching, run over the whole manuscript, answers questions
 * a wiki cannot: which scenes is this person in, how often, and — the useful
 * one — which of the people and places you have carefully written down have
 * never once made it into the prose.
 *
 * Pure, and shared with the editor's highlighter, so the underlines in a
 * scene and the appearances listed here can never disagree about what counts
 * as a mention.
 */

export interface MentionSource {
  id: string
  name: string
  aliases: string[]
}

export interface MentionIndex {
  regex: RegExp | null
  termToEntryId: Map<string, string>
}

export const EMPTY_MENTION_INDEX: MentionIndex = { regex: null, termToEntryId: new Map() }

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Builds one expression matching every name and alias.
 *
 * Longest first, so "Mara Voss" wins over a shorter "Mara" alias starting at
 * the same place — otherwise the surname would be left dangling outside the
 * match and a two-word name would never highlight as one.
 */
export function buildMentionIndex(entries: MentionSource[]): MentionIndex {
  const terms: { term: string; entryId: string }[] = []
  for (const entry of entries) {
    const name = entry.name.trim()
    if (name) terms.push({ term: name, entryId: entry.id })
    for (const alias of entry.aliases) {
      const trimmed = alias.trim()
      if (trimmed) terms.push({ term: trimmed, entryId: entry.id })
    }
  }
  if (terms.length === 0) return EMPTY_MENTION_INDEX

  terms.sort((a, b) => b.term.length - a.term.length)

  // Word boundaries are asserted per term, and only on the ends that are
  // actually word characters. Wrapping the whole alternation in \b instead
  // silently broke every name that begins or ends with punctuation — "St.
  // Ives.", "Vance (the elder)" — because \b needs a word character on one
  // side, and after ")" followed by a space there is none. Such an entry
  // matched nowhere at all, in the editor's underlines as well as here.
  const pattern = terms
    .map((t) => {
      const escaped = escapeRegExp(t.term)
      const lead = /^\w/.test(t.term) ? '\\b' : ''
      const trail = /\w$/.test(t.term) ? '\\b' : ''
      return `${lead}${escaped}${trail}`
    })
    .join('|')

  return {
    regex: new RegExp(`(?:${pattern})`, 'gi'),
    termToEntryId: new Map(terms.map((t) => [t.term.toLowerCase(), t.entryId])),
  }
}

/** How many times each entry is named in one piece of text. */
export function countMentions(text: string, index: MentionIndex): Map<string, number> {
  const counts = new Map<string, number>()
  if (!index.regex || !text) return counts

  const regex = index.regex
  regex.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text))) {
    const entryId = index.termToEntryId.get(match[0].toLowerCase())
    if (entryId) counts.set(entryId, (counts.get(entryId) ?? 0) + 1)
    // A zero-length match would spin here forever; the index cannot produce
    // one today, but a future alias of "" would.
    if (match[0].length === 0) regex.lastIndex++
  }
  return counts
}

export interface SceneText {
  id: string
  chapterId: string
  title: string
  plainText: string
}

export interface Appearance {
  sceneId: string
  chapterId: string
  sceneTitle: string
  count: number
}

/** Every scene each entry is named in, in the order the scenes were given. */
export function findAppearances(
  scenes: SceneText[],
  index: MentionIndex,
): Map<string, Appearance[]> {
  const byEntry = new Map<string, Appearance[]>()
  for (const scene of scenes) {
    for (const [entryId, count] of countMentions(scene.plainText, index)) {
      const list = byEntry.get(entryId) ?? []
      list.push({
        sceneId: scene.id,
        chapterId: scene.chapterId,
        sceneTitle: scene.title,
        count,
      })
      byEntry.set(entryId, list)
    }
  }
  return byEntry
}

export function totalMentions(appearances: Appearance[] | undefined): number {
  return (appearances ?? []).reduce((sum, a) => sum + a.count, 0)
}
