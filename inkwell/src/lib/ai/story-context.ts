/**
 * What has actually happened to this character, in their own book.
 *
 * A character card holds who someone *is* — their description, their voice,
 * the way they talk. It holds nothing about what they have been through,
 * because that lives in the manuscript and changes every time the writer
 * touches it. So a character asked "how are you holding up?" answered from a
 * blank slate, as if the eighty thousand words they appear in had not been
 * written.
 *
 * This pulls the passages where they are named out of the prose and turns
 * them into a short account of their story so far. It is deliberately made of
 * the writer's own sentences rather than a summary: a paraphrase would put
 * words in the book's mouth, and the whole point is that when Henry mentions
 * the heart attack he is remembering the scene as it was written.
 *
 * Pure, and shares its name-matching with the editor's underlines, so a
 * character knows about exactly the passages the app already shows as theirs.
 */

import {
  buildMentionIndex,
  countMentions,
  type MentionSource,
  type SceneText,
} from '@/features/almanac/lib/mentions'

import { estimateTokens } from './token-estimate'

export interface StoryScene extends SceneText {
  /** Where the scene sits in the book, so "most recent" means something. */
  chapterOrder: number
  order: number
  chapterTitle: string
}

export interface StoryMoment {
  sceneId: string
  chapterTitle: string
  sceneTitle: string
  /** The writer's own sentences, around where the character is named. */
  passage: string
}

export interface StoryDigest {
  moments: StoryMoment[]
  /** How many scenes they appear in altogether, including ones left out. */
  sceneCount: number
  text: string
}

export const EMPTY_DIGEST: StoryDigest = { moments: [], sceneCount: 0, text: '' }

/** Sentences, roughly — enough for prose, without a grammar. */
function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…]["'”’]?)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * The sentences around each mention, stitched together.
 *
 * One sentence either side, because a name on its own carries nothing — "She
 * called Charlotte a bitch" needs what came before it to be about anything.
 * Runs that overlap are merged rather than repeated, so a paragraph naming
 * someone four times does not arrive four times over.
 */
export function passageAround(
  text: string,
  index: ReturnType<typeof buildMentionIndex>,
  entryId: string,
  context = 1,
): string {
  const sentences = sentencesOf(text)
  const wanted = new Set<number>()
  sentences.forEach((sentence, i) => {
    if (!countMentions(sentence, index).has(entryId)) return
    for (let j = Math.max(0, i - context); j <= Math.min(sentences.length - 1, i + context); j++) {
      wanted.add(j)
    }
  })
  if (wanted.size === 0) return ''

  const ordered = [...wanted].sort((a, b) => a - b)
  const runs: string[] = []
  let run: string[] = []
  let previous = -2
  for (const i of ordered) {
    // A gap means skipped prose, and running two distant passages together
    // would invent a connection the book does not make.
    if (i !== previous + 1 && run.length > 0) {
      runs.push(run.join(' '))
      run = []
    }
    run.push(sentences[i])
    previous = i
  }
  if (run.length > 0) runs.push(run.join(' '))
  return runs.join(' … ')
}

export interface DigestOptions {
  /** Roughly how much of the prompt this may take. */
  tokenBudget?: number
  /** How many scenes to draw from at most, newest first. */
  maxScenes?: number
}

/**
 * The character's story so far, newest last.
 *
 * Newest scenes are chosen first, because what just happened matters more
 * than chapter one — but they are then put back into reading order, so the
 * account runs forwards the way the book does.
 */
export function buildStoryDigest(
  character: MentionSource,
  scenes: StoryScene[],
  options: DigestOptions = {},
): StoryDigest {
  const budget = options.tokenBudget ?? 900
  const maxScenes = options.maxScenes ?? 6
  if (!character.name.trim() || scenes.length === 0 || budget <= 0) return EMPTY_DIGEST

  const index = buildMentionIndex([character])
  if (!index.regex) return EMPTY_DIGEST

  const inReadingOrder = [...scenes].sort(
    (a, b) => a.chapterOrder - b.chapterOrder || a.order - b.order,
  )

  const appearing = inReadingOrder
    .map((scene, position) => ({ scene, position }))
    .filter(({ scene }) => countMentions(scene.plainText, index).has(character.id))

  if (appearing.length === 0) return EMPTY_DIGEST

  const newestFirst = [...appearing].reverse().slice(0, maxScenes)

  const chosen: { position: number; moment: StoryMoment }[] = []
  let used = 0
  for (const { scene, position } of newestFirst) {
    const passage = passageAround(scene.plainText, index, character.id)
    if (!passage) continue
    const cost = estimateTokens(passage)
    if (used + cost > budget) {
      // Half a passage is worse than none: it would end mid-event and read as
      // a thing that did not finish happening.
      if (chosen.length > 0) break
      continue
    }
    used += cost
    chosen.push({
      position,
      moment: {
        sceneId: scene.id,
        chapterTitle: scene.chapterTitle,
        sceneTitle: scene.title,
        passage,
      },
    })
  }

  chosen.sort((a, b) => a.position - b.position)
  const moments = chosen.map((c) => c.moment)
  if (moments.length === 0) return { moments: [], sceneCount: appearing.length, text: '' }

  const body = moments
    .map((m) => `From "${m.chapterTitle} — ${m.sceneTitle}":\n${m.passage}`)
    .join('\n\n')

  const omitted = appearing.length - moments.length
  const preface =
    omitted > 0
      ? `These are passages from the manuscript in which you appear — the most recent ${moments.length} of ${appearing.length} scenes.`
      : `These are the passages from the manuscript in which you appear.`

  return {
    moments,
    sceneCount: appearing.length,
    text: `${preface} They are what has happened to you, in the author's own words. Treat them as your memories: you may refer to these events, be affected by them, and bring them up unprompted when they are relevant. Do not quote them back verbatim.\n\n${body}`,
  }
}
