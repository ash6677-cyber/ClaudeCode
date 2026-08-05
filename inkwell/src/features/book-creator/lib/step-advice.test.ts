import { describe, expect, it } from 'vitest'

import { stepAdvice } from './step-advice'

const state = (over: Partial<Parameters<typeof stepAdvice>[1]> = {}) => ({
  title: 'The Salt Road',
  chapters: [],
  cast: [],
  ...over,
})

describe('what each step says about itself', () => {
  it('blocks only on the one thing a book cannot do without', () => {
    expect(stepAdvice('concept', state({ title: '   ' })).block).toBeTruthy()
    expect(stepAdvice('concept', state()).block).toBeUndefined()
  })

  it('never blocks after the first step', () => {
    for (const step of ['outline', 'cast', 'review']) {
      expect(stepAdvice(step, state({ title: '' })).block).toBeUndefined()
    }
  })

  it('says an empty outline is fine rather than saying nothing', () => {
    expect(stepAdvice('outline', state()).note).toMatch(/format’s own chapters/)
  })

  it('warns that an unnamed character is quietly dropped', () => {
    // The one real trap: creation skips them, and the writer finds out by
    // counting cards afterwards.
    const one = stepAdvice('cast', state({ cast: [{ name: '  ' }] }))
    expect(one.note).toBe('One character has no name, so it will not be created.')
    const two = stepAdvice('cast', state({ cast: [{ name: '' }, { name: '' }, { name: 'Mira' }] }))
    expect(two.note).toBe('2 characters have no name, so they will not be created.')
  })

  it('says nothing when there is nothing to say', () => {
    expect(stepAdvice('cast', state({ cast: [{ name: 'Mira' }] }))).toEqual({})
    expect(stepAdvice('outline', state({ chapters: [{ title: 'One' }] }))).toEqual({})
    expect(stepAdvice('review', state())).toEqual({})
  })

  it('promises the numbering an untitled chapter actually gets', () => {
    expect(stepAdvice('outline', state({ chapters: [{ title: '' }] })).note).toMatch(/numbered/)
    expect(
      stepAdvice('outline', state({ chapters: [{ title: '' }, { title: ' ' }] })).note,
    ).toMatch(/^2 chapters/)
  })
})
