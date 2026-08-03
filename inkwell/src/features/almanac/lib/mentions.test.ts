import { describe, expect, it } from 'vitest'

import {
  buildMentionIndex,
  countMentions,
  findAppearances,
  totalMentions,
  type SceneText,
} from './mentions'

const entries = [
  { id: 'mira', name: 'Mira Vance', aliases: ['Mira', 'the cartographer'] },
  { id: 'road', name: 'The Salt Road', aliases: [] },
  { id: 'aldren', name: 'Aldren', aliases: [] },
]

const index = buildMentionIndex(entries)

function scene(id: string, plainText: string): SceneText {
  return { id, chapterId: `c-${id}`, title: `Scene ${id}`, plainText }
}

describe('buildMentionIndex', () => {
  it('has nothing to match when there are no entries', () => {
    expect(buildMentionIndex([]).regex).toBeNull()
  })

  it('ignores an entry with a blank name and no aliases', () => {
    expect(buildMentionIndex([{ id: 'x', name: '   ', aliases: ['  '] }]).regex).toBeNull()
  })
})

describe('countMentions', () => {
  it('counts a name and its aliases as the same entry', () => {
    const counts = countMentions('Mira went out. Mira Vance did not look back.', index)
    expect(counts.get('mira')).toBe(2)
  })

  it('prefers the longest name at a position', () => {
    // "Mira Vance" must win over the "Mira" alias, or the surname is left
    // dangling outside the match and the full name never reads as one thing.
    expect(countMentions('Mira Vance walked.', index).get('mira')).toBe(1)
  })

  it('does not match inside a longer word', () => {
    expect(countMentions('Aldrenian pottery.', index).get('aldren')).toBeUndefined()
  })

  it('ignores case', () => {
    expect(countMentions('aldren and ALDREN', index).get('aldren')).toBe(2)
  })

  it('matches a multi-word name', () => {
    expect(countMentions('They walked The Salt Road for days.', index).get('road')).toBe(1)
  })

  it('finds nothing in text that names nobody', () => {
    expect(countMentions('The wind came off the flats.', index).size).toBe(0)
  })

  it('survives an empty index and empty text', () => {
    expect(countMentions('anything', buildMentionIndex([])).size).toBe(0)
    expect(countMentions('', index).size).toBe(0)
  })

  it('treats a regex metacharacter in a name as literal text', () => {
    // A name like "Vance (the elder)" must not be compiled as a pattern.
    const odd = buildMentionIndex([{ id: 'v', name: 'Vance (the elder)', aliases: [] }])
    expect(countMentions('Vance (the elder) arrived.', odd).get('v')).toBe(1)
    expect(countMentions('Vance the elder arrived.', odd).get('v')).toBeUndefined()
  })

  it('matches a name that ends in punctuation', () => {
    // A single \b around the whole alternation could never match these: \b
    // needs a word character beside it, and "." followed by a space has none.
    // Every such entry was invisible, here and in the editor's underlines.
    const abbreviated = buildMentionIndex([
      { id: 's', name: 'St. Ives.', aliases: [] },
      { id: 'm', name: 'Mr. Bell', aliases: [] },
    ])
    expect(countMentions('They reached St. Ives. It was raining.', abbreviated).get('s')).toBe(1)
    expect(countMentions('Mr. Bell said nothing.', abbreviated).get('m')).toBe(1)
  })

  it('still refuses a partial word when the name ends in a letter', () => {
    expect(countMentions('Aldrenian pottery.', index).get('aldren')).toBeUndefined()
  })
})

describe('findAppearances', () => {
  const scenes = [
    scene('a', 'Mira went west. Aldren stayed.'),
    scene('b', 'The Salt Road ran on. Mira Vance counted the stones.'),
    scene('c', 'Nobody was there.'),
  ]

  it('lists every scene an entry is named in, with its count', () => {
    const found = findAppearances(scenes, index)
    expect(found.get('mira')!.map((a) => a.sceneId)).toEqual(['a', 'b'])
    expect(found.get('mira')!.map((a) => a.count)).toEqual([1, 1])
  })

  it('leaves out an entry the manuscript never names', () => {
    // The useful half of this feature: a character carefully written down and
    // never once written about.
    const found = findAppearances([scene('c', 'Nobody was there.')], index)
    expect(found.get('mira')).toBeUndefined()
  })

  it('keeps the scene order it was given, so reading order survives', () => {
    const found = findAppearances(scenes, index)
    expect(found.get('road')!.map((a) => a.sceneId)).toEqual(['b'])
  })

  it('carries the chapter through, so an appearance can be navigated to', () => {
    expect(findAppearances(scenes, index).get('aldren')![0].chapterId).toBe('c-a')
  })
})

describe('totalMentions', () => {
  it('adds up across scenes', () => {
    const found = findAppearances(
      [scene('a', 'Mira. Mira. Mira.'), scene('b', 'Mira Vance.')],
      index,
    )
    expect(totalMentions(found.get('mira'))).toBe(4)
  })

  it('is zero for an entry that appears nowhere', () => {
    expect(totalMentions(undefined)).toBe(0)
  })
})
