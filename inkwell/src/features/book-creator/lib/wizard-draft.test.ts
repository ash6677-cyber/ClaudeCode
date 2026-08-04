import { describe, expect, it } from 'vitest'

import {
  clearDraft,
  draftHasContent,
  readDraft,
  resolveStepIndex,
  writeDraft,
  type WizardDraft,
} from './wizard-draft'

/** localStorage does not exist in the node test environment; a Map does. */
function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
}

const draft = (changes: Partial<WizardDraft> = {}): WizardDraft => ({
  concept: {
    title: 'The Salt Road',
    author: '',
    genre: '',
    synopsis: '',
    targetWordCount: 80000,
    pov: 'third-limited',
    tense: 'past',
    structureMode: 'scenes',
  },
  chapterCount: 12,
  chapters: [],
  castCount: 4,
  cast: [],
  step: 'outline',
  furthestIndex: 1,
  savedAt: 1,
  ...changes,
})

describe('the draft round trip', () => {
  it('comes back exactly as it went in', () => {
    const s = fakeStorage()
    const d = draft({ chapters: [{ id: 'c1', title: 'One', summary: 'The door.' }] })
    writeDraft(d, s)
    expect(readDraft(s)).toEqual(d)
  })

  it('reads nothing where nothing was written', () => {
    expect(readDraft(fakeStorage())).toBeNull()
  })

  it('treats a garbled draft as no draft, not as a crash', () => {
    // localStorage is writable by anything on the origin, including a past
    // version of this very feature. The wizard's first render must survive
    // whatever is found there.
    const s = fakeStorage()
    for (const junk of ['not json', '42', '"a string"', '{}', '{"concept":{}}', '{"concept":{"title":1}}']) {
      s.setItem('inkwell-book-draft', junk)
      expect(readDraft(s), junk).toBeNull()
    }
  })

  it('clears without complaint, present or not', () => {
    const s = fakeStorage()
    clearDraft(s)
    writeDraft(draft(), s)
    clearDraft(s)
    expect(readDraft(s)).toBeNull()
  })
})

describe('draftHasContent', () => {
  it('is false for a pristine wizard — no resume banner for nothing', () => {
    expect(
      draftHasContent(draft({ concept: { ...draft().concept, title: '' } })),
    ).toBe(false)
  })

  it('is true the moment anything is typed or added', () => {
    expect(draftHasContent(draft())).toBe(true) // title set
    const blank = { ...draft().concept, title: '' }
    expect(draftHasContent(draft({ concept: blank, cast: [{ id: 'x', name: 'Mira', role: '', personality: '', addToCodex: true }] }))).toBe(true)
    expect(draftHasContent(draft({ concept: { ...blank, synopsis: 'a road' } }))).toBe(true)
  })

  it('does not count whitespace as content', () => {
    expect(draftHasContent(draft({ concept: { ...draft().concept, title: '   ' } }))).toBe(false)
  })
})

describe('resolveStepIndex', () => {
  const IDS = ['concept', 'outline', 'cast', 'review'] as const

  it('opens at the start with no parameter', () => {
    expect(resolveStepIndex(IDS, null, 3)).toBe(0)
  })

  it('honours a legitimate step', () => {
    expect(resolveStepIndex(IDS, 'cast', 2)).toBe(2)
  })

  it('clamps a hand-typed URL to the furthest step actually reached', () => {
    // ?step=review on a blank wizard is a writable URL, not an achievement.
    expect(resolveStepIndex(IDS, 'review', 1)).toBe(1)
    expect(resolveStepIndex(IDS, 'review', 0)).toBe(0)
  })

  it('treats an unknown step as the start', () => {
    expect(resolveStepIndex(IDS, 'nonsense', 3)).toBe(0)
  })

  it('never exceeds the last step even with a corrupt furthest', () => {
    expect(resolveStepIndex(IDS, 'review', 99)).toBe(3)
  })
})
