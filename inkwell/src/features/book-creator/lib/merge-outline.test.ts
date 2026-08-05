import { describe, expect, it } from 'vitest'

import { fillKindFor, mergeOutline, type OutlineEntry } from './merge-outline'
import { BUILT_IN_TEMPLATES, expandTemplate } from '@/features/templates/lib/templates'

const template = (id: string) => {
  const found = BUILT_IN_TEMPLATES.find((t) => t.id === id)
  if (!found) throw new Error(`no template ${id}`)
  return found
}

const planFor = (id: string) => expandTemplate(template(id))

const outline = (...titles: string[]): OutlineEntry[] =>
  titles.map((title) => ({ title, summary: `${title} happens.` }))

const shape = (merged: ReturnType<typeof mergeOutline>) =>
  merged.map((c) => `${c.kind}:${c.title}`)

describe('which division a format writes prose into', () => {
  it('is the chapter in a novel', () => {
    expect(fillKindFor(planFor('builtin:standard-novel'))).toBe('chapter')
    expect(fillKindFor(planFor('builtin:three-act'))).toBe('chapter')
  })

  it('is the act in a screenplay, where the act holds the scenes', () => {
    expect(fillKindFor(planFor('builtin:screenplay'))).toBe('act')
  })

  it('falls back to the chapter when a format has no writable division', () => {
    expect(fillKindFor([])).toBe('chapter')
    expect(fillKindFor([{ kind: 'prologue', title: 'Prologue', scenes: ['Scene 1'] }])).toBe(
      'chapter',
    )
  })
})

describe('merging an outline into a template', () => {
  const opts = { numbering: 'words' as const }

  it('leaves a blank format to the outline alone', () => {
    const merged = mergeOutline([], outline('The road', 'The inn'), opts)
    expect(shape(merged)).toEqual(['chapter:The road', 'chapter:The inn'])
    expect(merged[0].summary).toBe('The road happens.')
  })

  it('keeps a prologue a prologue and does not fill it with chapter one', () => {
    const merged = mergeOutline(planFor('builtin:standard-novel'), outline('The road'), opts)
    expect(shape(merged)).toEqual(['prologue:Prologue', 'chapter:The road', 'epilogue:Epilogue'])
    expect(merged[0].summary).toBe('')
    expect(merged[1].summary).toBe('The road happens.')
  })

  it('spills a long outline before the epilogue, never after it', () => {
    // The whole reason the merge is not a concatenation: an epilogue that
    // ends up in the middle of the book is worse than no template at all.
    const merged = mergeOutline(
      planFor('builtin:standard-novel'),
      outline('One', 'Two', 'Three'),
      opts,
    )
    expect(shape(merged)).toEqual([
      'prologue:Prologue',
      'chapter:One',
      'chapter:Two',
      'chapter:Three',
      'epilogue:Epilogue',
    ])
  })

  it('numbers a spilled chapter that the outline left unnamed', () => {
    const merged = mergeOutline(
      planFor('builtin:standard-novel'),
      [
        { title: 'One', summary: '' },
        { title: '  ', summary: 'Something happens.' },
      ],
      opts,
    )
    expect(shape(merged)[2]).toBe('chapter:Chapter Two')
    expect(merged[2].summary).toBe('Something happens.')
  })

  it('honours the format’s own numbering when it names a spilled chapter', () => {
    const merged = mergeOutline(
      [{ kind: 'chapter', title: 'Chapter I', scenes: ['Scene 1'] }],
      [
        { title: 'One', summary: '' },
        { title: '', summary: '' },
      ],
      { numbering: 'roman' },
    )
    expect(shape(merged)[1]).toBe('chapter:Chapter II')
  })

  it('leaves the format’s unused chapters standing when the outline is short', () => {
    // The writer asked for three acts of four chapters. An outline of two does
    // not silently shrink the book they chose.
    const merged = mergeOutline(planFor('builtin:three-act'), outline('One', 'Two'), opts)
    expect(shape(merged).slice(0, 5)).toEqual([
      'part:Part One',
      'chapter:One',
      'chapter:Two',
      'chapter:Chapter Three',
      'chapter:Chapter Four',
    ])
    expect(merged).toHaveLength(15)
  })

  it('fills a screenplay’s acts rather than inventing chapters inside it', () => {
    const merged = mergeOutline(planFor('builtin:screenplay'), outline('Setup', 'Trouble'), {
      numbering: 'roman',
    })
    expect(shape(merged)).toEqual(['act:Setup', 'act:Trouble', 'act:Act III'])
    // The act's own scene weighting is the format's, not the outline's.
    expect(merged.map((c) => c.scenes.length)).toEqual([4, 6, 4])
  })

  it('keeps the template title where the outline gave no name', () => {
    const merged = mergeOutline(
      planFor('builtin:standard-novel'),
      [{ title: '   ', summary: 'A summary all the same.' }],
      opts,
    )
    expect(shape(merged)[1]).toBe('chapter:Chapter One')
    expect(merged[1].summary).toBe('A summary all the same.')
  })

  it('produces the plain template when there is no outline at all', () => {
    const merged = mergeOutline(planFor('builtin:standard-novel'), [], opts)
    expect(shape(merged)).toEqual(['prologue:Prologue', 'chapter:Chapter One', 'epilogue:Epilogue'])
    expect(merged.every((c) => c.summary === '')).toBe(true)
  })

  it('gives a chapters-only project exactly the one scene it can open', () => {
    const merged = mergeOutline(planFor('builtin:screenplay'), outline('Setup'), {
      numbering: 'roman',
      scenesPerChapter: 'one',
    })
    expect(merged.map((c) => c.scenes.length)).toEqual([1, 1, 1])
  })

  it('never loses an outline entry, whatever the format', () => {
    for (const id of BUILT_IN_TEMPLATES.map((t) => t.id)) {
      const entries = outline('A', 'B', 'C', 'D', 'E')
      const merged = mergeOutline(planFor(id), entries, { numbering: 'words' })
      const summaries = merged.map((c) => c.summary).filter(Boolean)
      expect(summaries).toEqual(entries.map((e) => e.summary))
    }
  })
})
