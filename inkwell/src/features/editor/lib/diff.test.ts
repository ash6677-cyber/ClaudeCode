import { describe, expect, it } from 'vitest'

import { diffWords, summariseDiff, tokenise, type DiffPart } from './diff'

/** The surviving-plus-added text, which must rebuild the newer draft exactly. */
const rebuildAfter = (parts: DiffPart[]) =>
  parts.filter((p) => p.kind !== 'removed').map((p) => p.text).join('')

/** The surviving-plus-removed text, which must rebuild the older draft. */
const rebuildBefore = (parts: DiffPart[]) =>
  parts.filter((p) => p.kind !== 'added').map((p) => p.text).join('')

describe('tokenise', () => {
  it('keeps each word’s spacing attached to it', () => {
    // So parts concatenate back into prose without re-inserting spaces.
    expect(tokenise('the quick  fox')).toEqual(['the ', 'quick  ', 'fox'])
  })

  it('handles empty and whitespace-only text', () => {
    expect(tokenise('')).toEqual([])
    expect(tokenise('   ')).toEqual([])
  })
})

describe('diffWords', () => {
  it('reports nothing changed when nothing changed', () => {
    const parts = diffWords('She opened the door.', 'She opened the door.')
    expect(parts.every((p) => p.kind === 'same')).toBe(true)
    expect(summariseDiff(parts).unchanged).toBe(true)
  })

  it('marks a single inserted word and leaves the rest alone', () => {
    const parts = diffWords('She opened the door.', 'She slowly opened the door.')
    expect(parts.filter((p) => p.kind === 'added').map((p) => p.text.trim())).toEqual(['slowly'])
    expect(parts.some((p) => p.kind === 'removed')).toBe(false)
  })

  it('marks a deletion', () => {
    const parts = diffWords('She slowly opened the door.', 'She opened the door.')
    expect(parts.filter((p) => p.kind === 'removed').map((p) => p.text.trim())).toEqual(['slowly'])
  })

  it('shows a substitution as one removal and one addition, not a storm', () => {
    // The merge step is the whole reason a rewritten sentence stays readable.
    const parts = diffWords('The room was very cold', 'The room was freezing')
    expect(parts.filter((p) => p.kind === 'removed').map((p) => p.text.trim())).toEqual([
      'very cold',
    ])
    expect(parts.filter((p) => p.kind === 'added').map((p) => p.text.trim())).toEqual(['freezing'])
  })

  it('never emits two neighbouring parts of the same kind', () => {
    // The invariant behind that: a run of changed words is one mark, however
    // many words it covers, and however many separate runs the change has.
    const parts = diffWords(
      'The room was very cold and quite dark.',
      'The room was freezing and pitch black.',
    )
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].kind).not.toBe(parts[i - 1].kind)
    }
    // Two real substitutions here, either side of the surviving "and".
    expect(parts.filter((p) => p.kind === 'removed')).toHaveLength(2)
  })

  it('rebuilds both drafts exactly', () => {
    // The property that matters most: the marks are a faithful account of the
    // change, not an approximation of it. Restore is a decision made on this.
    const before = 'He waited by the harbour wall until the tide turned, then walked home.'
    const after = 'He waited on the harbour wall until the tide turned and then walked back home.'
    const parts = diffWords(before, after)
    expect(rebuildBefore(parts)).toBe(before)
    expect(rebuildAfter(parts)).toBe(after)
  })

  it('rebuilds both drafts across a heavy rewrite', () => {
    const before = 'Chapter one. The lighthouse had not been lit in forty years.'
    const after = 'Chapter One\n\nNobody had lit the lighthouse in forty years, and nobody would.'
    const parts = diffWords(before, after)
    expect(rebuildBefore(parts)).toBe(before)
    expect(rebuildAfter(parts)).toBe(after)
  })

  it('handles a draft appearing from nothing, and vanishing to nothing', () => {
    const written = diffWords('', 'A first line.')
    expect(rebuildBefore(written)).toBe('')
    expect(rebuildAfter(written)).toBe('A first line.')
    expect(summariseDiff(written)).toMatchObject({ wordsAdded: 3, wordsRemoved: 0 })

    const cut = diffWords('A first line.', '')
    expect(summariseDiff(cut)).toMatchObject({ wordsAdded: 0, wordsRemoved: 3 })
  })

  it('treats a reflow as no change at all', () => {
    // Wrapping differently is not an edit, and marking it as one would bury
    // the real changes in a scene that was only reformatted.
    const parts = diffWords('one two three', 'one\ntwo\nthree')
    expect(summariseDiff(parts).unchanged).toBe(true)
  })

  it('keeps the newer spacing on surviving words', () => {
    // So the reassembled "after" is byte-identical to the live draft.
    expect(rebuildAfter(diffWords('one two', 'one\ntwo'))).toBe('one\ntwo')
  })

  it('finds the small change inside a long passage', () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`)
    const before = words.join(' ')
    const after = [...words.slice(0, 300), 'INSERTED', ...words.slice(300)].join(' ')
    const parts = diffWords(before, after)
    expect(parts.filter((p) => p.kind === 'added').map((p) => p.text.trim())).toEqual(['INSERTED'])
    expect(summariseDiff(parts)).toMatchObject({ wordsAdded: 1, wordsRemoved: 0 })
  })

  it('stays fast on a full-length scene', () => {
    // Linear-space alignment exists so this does not build a table of
    // millions of cells and stall the tab.
    const a = Array.from({ length: 2500 }, (_, i) => `w${i % 400}`).join(' ')
    const b = Array.from({ length: 2500 }, (_, i) => (i % 50 === 0 ? 'changed' : `w${i % 400}`)).join(' ')
    const started = performance.now()
    const parts = diffWords(a, b)
    expect(performance.now() - started).toBeLessThan(2000)
    expect(rebuildBefore(parts)).toBe(a)
    expect(rebuildAfter(parts)).toBe(b)
  })
})

describe('summariseDiff', () => {
  it('counts words, not parts', () => {
    const parts = diffWords('the cat sat', 'the enormous ginger cat sat down')
    expect(summariseDiff(parts)).toMatchObject({ wordsAdded: 3, wordsRemoved: 0, unchanged: false })
  })
})
