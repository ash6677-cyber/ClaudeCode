import { describe, expect, it } from 'vitest'

import { buildStoryDigest, passageAround, type StoryScene } from './story-context'
import { buildMentionIndex } from '@/features/almanac/lib/mentions'

const charlotte = { id: 'c1', name: 'Charlotte', aliases: ['Lottie'] }

const scene = (over: Partial<StoryScene> & { plainText: string }): StoryScene => ({
  id: `s-${Math.random().toString(36).slice(2, 8)}`,
  chapterId: 'ch1',
  title: 'Scene 1',
  chapterTitle: 'Chapter One',
  chapterOrder: 0,
  order: 0,
  ...over,
})

describe('finding the passage around a name', () => {
  const index = buildMentionIndex([charlotte])

  it('keeps the sentence either side, because a name alone says nothing', () => {
    const text =
      'The market was loud. Mira called Charlotte a bitch and walked out. Nobody followed her. The rain started later.'
    expect(passageAround(text, index, 'c1')).toBe(
      'The market was loud. Mira called Charlotte a bitch and walked out. Nobody followed her.',
    )
  })

  it('merges mentions that sit next to each other instead of repeating them', () => {
    const text = 'Charlotte waited. Charlotte counted the carts. The bell rang.'
    expect(passageAround(text, index, 'c1')).toBe(
      'Charlotte waited. Charlotte counted the carts. The bell rang.',
    )
  })

  it('marks a gap rather than running two distant moments together', () => {
    const text =
      'Charlotte left at dawn. A B. C D. E F. G H. Charlotte came back at dusk.'
    expect(passageAround(text, index, 'c1')).toBe('Charlotte left at dawn. A B. … G H. Charlotte came back at dusk.')
  })

  it('finds a character by an alias the writer set up', () => {
    expect(passageAround('Nobody had seen Lottie for days.', index, 'c1')).toBe(
      'Nobody had seen Lottie for days.',
    )
  })

  it('says nothing when the character is not there', () => {
    expect(passageAround('Tomas locked the inn.', index, 'c1')).toBe('')
  })
})

describe('the story so far', () => {
  it('is empty for a character who has not been written into anything yet', () => {
    expect(buildStoryDigest(charlotte, []).text).toBe('')
    expect(buildStoryDigest(charlotte, [scene({ plainText: 'Tomas locked the inn.' })]).text).toBe('')
  })

  it('gathers what happened, in the order the book has it', () => {
    const digest = buildStoryDigest(charlotte, [
      scene({ chapterOrder: 1, plainText: 'Charlotte took the second cart.' }),
      scene({ chapterOrder: 0, plainText: 'Charlotte arrived in the rain.' }),
    ])
    expect(digest.moments.map((m) => m.passage)).toEqual([
      'Charlotte arrived in the rain.',
      'Charlotte took the second cart.',
    ])
    expect(digest.sceneCount).toBe(2)
  })

  it('prefers the most recent scenes when there are more than it can carry', () => {
    // What just happened matters more than chapter one — but the account
    // still reads forwards once the choosing is done.
    const scenes = Array.from({ length: 10 }, (_, i) =>
      scene({ chapterOrder: i, plainText: `Charlotte did thing number ${i}.` }),
    )
    const digest = buildStoryDigest(charlotte, scenes, { maxScenes: 3 })
    expect(digest.moments.map((m) => m.passage)).toEqual([
      'Charlotte did thing number 7.',
      'Charlotte did thing number 8.',
      'Charlotte did thing number 9.',
    ])
    expect(digest.sceneCount).toBe(10)
  })

  it('says how much it left out, so the character is not pretending to know everything', () => {
    const scenes = Array.from({ length: 8 }, (_, i) =>
      scene({ chapterOrder: i, plainText: `Charlotte did thing number ${i}.` }),
    )
    expect(buildStoryDigest(charlotte, scenes, { maxScenes: 2 }).text).toMatch(/most recent 2 of 8 scenes/)
  })

  it('tells the character these are memories, not a script to recite', () => {
    const digest = buildStoryDigest(charlotte, [scene({ plainText: 'Charlotte wept.' })])
    expect(digest.text).toMatch(/your memories/i)
    expect(digest.text).toMatch(/not quote them back|Do not quote/i)
  })

  it('stays inside the budget it was given', () => {
    const long = `Charlotte ${'walked and walked and walked '.repeat(200)}.`
    const digest = buildStoryDigest(charlotte, [scene({ plainText: long })], { tokenBudget: 50 })
    expect(digest.moments).toHaveLength(0)
    expect(digest.text).toBe('')
    expect(digest.sceneCount).toBe(1)
  })

  it('drops a whole passage rather than cutting one off mid-event', () => {
    const scenes = [
      scene({ chapterOrder: 0, plainText: 'Charlotte arrived.' }),
      scene({ chapterOrder: 1, plainText: `Charlotte ${'said something '.repeat(400)}.` }),
    ]
    const digest = buildStoryDigest(charlotte, scenes, { tokenBudget: 60 })
    expect(digest.moments.map((m) => m.passage)).toEqual(['Charlotte arrived.'])
  })

  it('names the chapter and scene each memory came from', () => {
    const digest = buildStoryDigest(charlotte, [
      scene({ chapterTitle: 'The Crossing', title: 'The bridge', plainText: 'Charlotte fell.' }),
    ])
    expect(digest.text).toContain('From "The Crossing — The bridge"')
  })

  it('is empty when asked for a character with no name', () => {
    expect(buildStoryDigest({ id: 'x', name: '  ', aliases: [] }, [scene({ plainText: 'x' })])).toEqual({
      moments: [],
      sceneCount: 0,
      text: '',
    })
  })
})
