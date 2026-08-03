import { describe, expect, it } from 'vitest'

import { compileBook, totalWordCount } from './compile-book'
import type { Chapter, ChapterKind, Scene } from '@/types'

function chapter(title: string, order: number, kind?: ChapterKind): Chapter {
  return {
    id: `c-${order}`,
    createdAt: 0,
    updatedAt: 0,
    projectId: 'p1',
    title,
    order,
    status: 'drafting',
    ...(kind ? { kind } : {}),
  }
}

function scene(chapterId: string, order: number, words = 100): Scene {
  return {
    id: `${chapterId}-s${order}`,
    createdAt: 0,
    updatedAt: 0,
    chapterId,
    projectId: 'p1',
    title: `Scene ${order + 1}`,
    order,
    content: null,
    plainText: 'x '.repeat(words).trim(),
    wordCount: words,
    status: 'drafting',
    povCharacterId: null,
    locationCodexId: null,
    summary: '',
    beats: [],
    labels: [],
    linkedCodexIds: [],
  }
}

describe('compileBook', () => {
  it('does not count the prologue as a chapter', () => {
    // The bug this exists for: numbering by position made the prologue
    // "Chapter 1" and left every real chapter one too high for the whole book.
    const book = compileBook(
      [
        chapter('Prologue', 0, 'prologue'),
        chapter('Chapter One', 1, 'chapter'),
        chapter('Chapter Two', 2, 'chapter'),
      ],
      [],
    )
    expect(book.map((c) => c.number)).toEqual([null, 1, 2])
    expect(book.map((c) => c.kind)).toEqual(['prologue', 'chapter', 'chapter'])
  })

  it('leaves the epilogue unnumbered too', () => {
    const book = compileBook(
      [chapter('Chapter One', 0, 'chapter'), chapter('Epilogue', 1, 'epilogue')],
      [],
    )
    expect(book[1].number).toBeNull()
  })

  it('numbers parts and chapters on separate counts', () => {
    const book = compileBook(
      [
        chapter('Part One', 0, 'part'),
        chapter('Chapter One', 1, 'chapter'),
        chapter('Chapter Two', 2, 'chapter'),
        chapter('Part Two', 3, 'part'),
        chapter('Chapter Three', 4, 'chapter'),
      ],
      [],
    )
    expect(book.map((c) => c.number)).toEqual([1, 1, 2, 2, 3])
  })

  it('reads a manuscript written before kinds existed as all chapters', () => {
    // Nothing already written may change shape.
    const book = compileBook([chapter('One', 0), chapter('Two', 1)], [])
    expect(book.map((c) => c.number)).toEqual([1, 2])
    expect(book.every((c) => c.kind === 'chapter')).toBe(true)
  })

  it('still orders scenes within a chapter and totals the words', () => {
    const book = compileBook(
      [chapter('Chapter One', 0, 'chapter')],
      [scene('c-0', 1, 40), scene('c-0', 0, 60)],
    )
    expect(book[0].scenes.map((s) => s.order)).toEqual([0, 1])
    expect(book[0].wordCount).toBe(100)
    expect(totalWordCount(book)).toBe(100)
  })
})
