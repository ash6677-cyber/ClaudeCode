/**
 * What the Book Creator made, told to the writer once.
 *
 * The wizard could create a prologue, twelve chapters, thirty scenes and four
 * characters, and then drop the writer into an editor showing none of it —
 * the cast in particular lives in the Playground, which is a different page
 * they have no reason to look at. Everything was there; nothing said so.
 *
 * A one-time note on arrival closes that gap. It is kept in localStorage
 * rather than the database on purpose: it is a fact about one moment on one
 * device, not a property of the book, and it should not sync, back up, or
 * outlive being read.
 */

const KEY = 'inkwell-book-handoff'

export interface Handoff {
  projectId: string
  chapters: number
  scenes: number
  characters: number
  /** Whether any of the cast reached the Playground, which is the surprise. */
  cards: boolean
  /** The format the manuscript was laid out in, when one was chosen. */
  templateName: string
}

export function rememberHandoff(handoff: Handoff, storage: Storage = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(handoff))
  } catch {
    // Quota, or private mode. A missing note is a missing sentence, not a
    // missing book — there is nothing here worth failing a creation over.
  }
}

/**
 * Reads the note for one project and forgets it in the same breath.
 *
 * Taking it rather than reading it is what makes "appears once, never again"
 * true across reloads without a second flag to keep in step. A note for some
 * other project is left alone: two books created in one session must not
 * cancel each other out.
 */
export function takeHandoff(projectId: string, storage: Storage = localStorage): Handoff | null {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Handoff
    if (!parsed || typeof parsed !== 'object' || parsed.projectId !== projectId) return null
    storage.removeItem(KEY)
    return parsed
  } catch {
    return null
  }
}

/** What the banner says, in words rather than a row of counts. */
export function handoffSummary(handoff: Pick<Handoff, 'chapters' | 'scenes' | 'characters'>): string {
  const parts: string[] = []
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  if (handoff.chapters > 0) parts.push(plural(handoff.chapters, 'chapter', 'chapters'))
  // Scenes are only worth saying when there is more than one to a chapter;
  // otherwise "12 chapters, 12 scenes" is the same fact twice.
  if (handoff.scenes > handoff.chapters) parts.push(plural(handoff.scenes, 'scene', 'scenes'))
  if (handoff.characters > 0) parts.push(plural(handoff.characters, 'character', 'characters'))
  if (parts.length === 0) return 'Your book is ready to start.'
  if (parts.length === 1) return `${parts[0]} created.`
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]} created.`
}
