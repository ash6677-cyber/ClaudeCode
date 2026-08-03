import { describe, expect, it } from 'vitest'

import {
  BUILT_IN_TEMPLATES,
  chapterKind,
  expandTemplate,
  formatNumber,
  isNumbered,
  numberToRoman,
  numberToWords,
  templateSize,
  titleStatesKind,
} from './templates'

const standard = BUILT_IN_TEMPLATES.find((t) => t.id === 'builtin:standard-novel')!
const threeAct = BUILT_IN_TEMPLATES.find((t) => t.id === 'builtin:three-act')!

describe('numberToWords', () => {
  it('writes the numbers a novel uses', () => {
    expect(numberToWords(1)).toBe('One')
    expect(numberToWords(12)).toBe('Twelve')
    expect(numberToWords(20)).toBe('Twenty')
    expect(numberToWords(43)).toBe('Forty-Three')
    expect(numberToWords(100)).toBe('One Hundred')
    expect(numberToWords(118)).toBe('One Hundred Eighteen')
  })

  it('gives up rather than inventing wording for absurd lengths', () => {
    // No novel has a thousandth chapter, and "One Thousand" in a title would
    // be a stranger sight than the digits.
    expect(numberToWords(1000)).toBe('1000')
  })
})

describe('numberToRoman', () => {
  it('writes the awkward ones correctly', () => {
    expect(numberToRoman(4)).toBe('IV')
    expect(numberToRoman(9)).toBe('IX')
    expect(numberToRoman(14)).toBe('XIV')
    expect(numberToRoman(40)).toBe('XL')
    expect(numberToRoman(1987)).toBe('MCMLXXXVII')
  })
})

describe('formatNumber', () => {
  it('honours the style the template asked for', () => {
    expect(formatNumber(7, 'words')).toBe('Seven')
    expect(formatNumber(7, 'digits')).toBe('7')
    expect(formatNumber(7, 'roman')).toBe('VII')
  })
})

describe('isNumbered', () => {
  it('knows which divisions of a book take a number', () => {
    expect(isNumbered('chapter')).toBe(true)
    expect(isNumbered('part')).toBe(true)
    expect(isNumbered('prologue')).toBe(false)
    expect(isNumbered('epilogue')).toBe(false)
  })
})

describe('chapterKind', () => {
  it('reads a chapter written before kinds existed as an ordinary chapter', () => {
    expect(chapterKind({})).toBe('chapter')
    expect(chapterKind({ kind: 'prologue' })).toBe('prologue')
  })
})

describe('titleStatesKind', () => {
  it('spots a title that already says what the division is', () => {
    // These get no tag and no standfirst — the label would only repeat them.
    expect(titleStatesKind('Prologue', 'prologue')).toBe(true)
    expect(titleStatesKind('Chapter Nine', 'chapter')).toBe(true)
    expect(titleStatesKind('part two', 'part')).toBe(true)
  })

  it('does not spot one that leaves it to be said', () => {
    expect(titleStatesKind('Before', 'prologue')).toBe(false)
    expect(titleStatesKind('The Long Dark', 'chapter')).toBe(false)
  })

  it('does not mistake one kind for another', () => {
    expect(titleStatesKind('Prologue', 'epilogue')).toBe(false)
  })
})

describe('expandTemplate', () => {
  it('lays out a prologue and then chapter one', () => {
    const plan = expandTemplate(standard)
    expect(plan.map((c) => c.title)).toEqual(['Prologue', 'Chapter One'])
    expect(plan.map((c) => c.kind)).toEqual(['prologue', 'chapter'])
  })

  it('does not number the prologue', () => {
    // The whole reason kinds exist: a prologue is not chapter one.
    const plan = expandTemplate(standard)
    expect(plan[0].title).toBe('Prologue')
  })

  it('numbers each kind on its own count, not on position', () => {
    // Three parts of four chapters: the parts count one to three while the
    // chapters run one to twelve straight through them.
    const plan = expandTemplate(threeAct)
    expect(plan.filter((c) => c.kind === 'part').map((c) => c.title)).toEqual([
      'Part One',
      'Part Two',
      'Part Three',
    ])
    const chapters = plan.filter((c) => c.kind === 'chapter').map((c) => c.title)
    expect(chapters).toHaveLength(12)
    expect(chapters[0]).toBe('Chapter One')
    expect(chapters[3]).toBe('Chapter Four')
    expect(chapters[4]).toBe('Chapter Five')
    expect(chapters[11]).toBe('Chapter Twelve')
  })

  it('carries the numbering style into the titles', () => {
    const plan = expandTemplate({ ...standard, numbering: 'roman' })
    expect(plan.map((c) => c.title)).toEqual(['Prologue', 'Chapter I'])
  })

  it('leaves a single unnumbered part alone but distinguishes repeats', () => {
    const plan = expandTemplate({
      numbering: 'digits',
      parts: [{ id: 'a', kind: 'epilogue', title: 'Epilogue', count: 2, scenesEach: 1 }],
    })
    expect(plan.map((c) => c.title)).toEqual(['Epilogue', 'Epilogue 2'])
  })

  it('gives a chapters-only project exactly one scene per chapter', () => {
    // Any more and the project would hold scenes its editor cannot reach.
    const plan = expandTemplate(
      { numbering: 'words', parts: [{ id: 'a', kind: 'chapter', title: 'Chapter {n}', count: 2, scenesEach: 4 }] },
      { scenesPerChapter: 'one' },
    )
    expect(plan.every((c) => c.scenes.length === 1)).toBe(true)
  })

  it('never creates a chapter with nowhere to write', () => {
    const plan = expandTemplate({
      numbering: 'words',
      parts: [{ id: 'a', kind: 'chapter', title: 'Chapter {n}', count: 1, scenesEach: 0 }],
    })
    expect(plan[0].scenes).toHaveLength(1)
  })

  it('expands nothing from a blank template', () => {
    expect(expandTemplate({ numbering: 'words', parts: [] })).toEqual([])
  })

  it('ignores a part asking for a negative number of chapters', () => {
    const plan = expandTemplate({
      numbering: 'words',
      parts: [{ id: 'a', kind: 'chapter', title: 'Chapter {n}', count: -3, scenesEach: 1 }],
    })
    expect(plan).toEqual([])
  })
})

describe('templateSize', () => {
  it('counts what would be created', () => {
    expect(templateSize(expandTemplate(threeAct))).toEqual({ chapters: 15, scenes: 15 })
  })
})

describe('BUILT_IN_TEMPLATES', () => {
  it('offers a blank option, so a template is never forced', () => {
    const blank = BUILT_IN_TEMPLATES.find((t) => t.id === 'builtin:blank')
    expect(blank).toBeDefined()
    expect(expandTemplate(blank!)).toEqual([])
  })

  it('every built-in expands without a chapter that has no scene', () => {
    for (const template of BUILT_IN_TEMPLATES) {
      for (const chapter of expandTemplate(template)) {
        expect(chapter.scenes.length).toBeGreaterThan(0)
        expect(chapter.title.trim()).not.toBe('')
      }
    }
  })
})
