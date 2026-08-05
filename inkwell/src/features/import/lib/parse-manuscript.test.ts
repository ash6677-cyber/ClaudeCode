import { describe, expect, it } from 'vitest'

import {
  SCENE_BREAK,
  countWords,
  detectStructure,
  normaliseTitles,
  parseMarkdownBlocks,
} from './parse-manuscript'

const md = (source: string) => detectStructure(parseMarkdownBlocks(source))
const titles = (m: ReturnType<typeof md>) => m.chapters.map((c) => c.title)

describe('reading Markdown', () => {
  it('takes a document at its word when it has headings', () => {
    const book = md(`# Chapter One

The caravan came down.

# Chapter Two

The salt was gone.`)
    expect(book.method).toBe('headings')
    expect(titles(book)).toEqual(['Chapter One', 'Chapter Two'])
    expect(book.chapters[0].scenes[0].paragraphs).toEqual(['The caravan came down.'])
  })

  it('reads a second-level heading as a scene inside its chapter', () => {
    const book = md(`# Chapter One

## The bridge

She crossed at dusk.

## The inn

Tomas was waiting.`)
    expect(book.chapters).toHaveLength(1)
    expect(book.chapters[0].scenes.map((s) => s.title)).toEqual(['The bridge', 'The inn'])
  })

  it('keeps text written before the first heading', () => {
    // An epigraph, or a document that simply starts. Dropping it would lose
    // words the writer can only discover are missing by rereading.
    const book = md(`An old saying about salt.

# Chapter One

The caravan came down.`)
    expect(book.chapters).toHaveLength(2)
    expect(book.chapters[0].scenes[0].paragraphs).toEqual(['An old saying about salt.'])
  })

  it('joins wrapped lines back into one paragraph', () => {
    const book = md(`The caravan came down\nout of the hills.`)
    expect(book.chapters[0].scenes[0].paragraphs).toEqual([
      'The caravan came down out of the hills.',
    ])
  })

  it('reads a divider line as a scene break, not as prose', () => {
    const book = md(`First scene.

***

Second scene.`)
    expect(book.method).toBe('scene-breaks')
    expect(book.chapters[0].scenes).toHaveLength(2)
    expect(book.chapters[0].scenes[1].paragraphs).toEqual(['Second scene.'])
  })

  it('does not invent chapters from scene breaks alone', () => {
    // A divider says the scene changed and nothing more. Guessing chapters
    // from it would be structure the document never claimed.
    const book = md(`One.\n\n---\n\nTwo.\n\n---\n\nThree.`)
    expect(book.chapters).toHaveLength(1)
    expect(book.chapters[0].scenes).toHaveLength(3)
  })

  it('brings a document with no structure in as one honest chapter', () => {
    const book = md(`Just some prose.\n\nAnd more of it.`)
    expect(book.method).toBe('single')
    expect(book.chapters).toHaveLength(1)
    expect(book.chapters[0].scenes[0].paragraphs).toHaveLength(2)
  })

  it('survives an empty or whitespace-only document', () => {
    expect(md('').chapters).toEqual([])
    expect(md('   \n\n  ').chapters).toEqual([])
  })

  it('drops a heading that has nothing under it rather than making an empty chapter', () => {
    const book = md(`# Chapter One

# Chapter Two

Real words.`)
    expect(titles(book)).toEqual(['Chapter Two'])
  })

  it('leaves emphasis alone — a novel is not a README', () => {
    const book = md(`She said *nothing at all*.`)
    expect(book.chapters[0].scenes[0].paragraphs[0]).toBe('She said *nothing at all*.')
  })
})

describe('telling the book’s name from its first chapter', () => {
  it('takes a Word title block as the title, not as chapter one', () => {
    const book = detectStructure([
      { text: 'The Salt Road', heading: null, isTitle: true },
      { text: 'Chapter One', heading: 1 },
      { text: 'The caravan came down.', heading: null },
    ])
    expect(book.title).toBe('The Salt Road')
    expect(titles(book)).toEqual(['Chapter One'])
  })

  it('reads a lone opening # above several ## as the title', () => {
    // The commonest Markdown manuscript there is. Read the other way, the
    // whole book ends up inside a single chapter named after itself.
    const book = md(`# The Salt Road

## Chapter One

The caravan came down.

## Chapter Two

The salt was gone.`)
    expect(book.title).toBe('The Salt Road')
    expect(titles(book)).toEqual(['Chapter One', 'Chapter Two'])
  })

  it('does not steal the first chapter of a document that has only one heading level', () => {
    const book = md(`# Chapter One

The caravan came down.

# Chapter Two

The salt was gone.`)
    expect(book.title).toBe('')
    expect(titles(book)).toEqual(['Chapter One', 'Chapter Two'])
  })

  it('never lifts a heading that calls itself a chapter', () => {
    // One `#` above two `##`s, which is the shape of a title page — but this
    // one says "Chapter One", and no book is named that.
    const book = md(`# Chapter One

## The bridge

She crossed at dusk.

## The inn

Tomas was waiting.`)
    expect(book.title).toBe('')
    expect(titles(book)).toEqual(['Chapter One'])
    expect(book.chapters[0].scenes).toHaveLength(2)
  })

  it('leaves a # alone when its ##s are scenes of a real second chapter', () => {
    const book = md(`# Chapter One

## The bridge

She crossed at dusk.

# Chapter Two

## The inn

Tomas was waiting.`)
    expect(book.title).toBe('')
    expect(titles(book)).toEqual(['Chapter One', 'Chapter Two'])
  })

  it('says nothing about a title when the document declared none', () => {
    expect(md('Just some prose.').title).toBe('')
    expect(md('').title).toBe('')
  })

  it('survives a document that is a title page and nothing else', () => {
    const book = detectStructure([{ text: 'The Salt Road', heading: null, isTitle: true }])
    expect(book.title).toBe('The Salt Road')
    expect(book.chapters).toEqual([])
  })
})

describe('word counts', () => {
  it('counts what a writer would count', () => {
    expect(countWords('The caravan came down.')).toBe(4)
    expect(countWords('   ')).toBe(0)
    expect(countWords('')).toBe(0)
  })

  it('totals up through scenes and chapters', () => {
    const book = md(`# One

Two words here.

# Two

And three words here.`)
    expect(book.chapters[0].wordCount).toBe(3)
    expect(book.chapters[1].wordCount).toBe(4)
    expect(book.wordCount).toBe(7)
  })
})

describe('normaliseTitles', () => {
  const chapter = (title: string) => ({ title, scenes: [], wordCount: 0 })

  it('leaves distinct titles alone', () => {
    const out = normaliseTitles([chapter('The Bridge'), chapter('The Inn')])
    expect(out.map((c) => c.title)).toEqual(['The Bridge', 'The Inn'])
  })

  it('renumbers repeated chapter headings rather than repeating them', () => {
    // A document whose every heading reads "Chapter One" would otherwise
    // produce a manuscript nobody can navigate.
    const out = normaliseTitles([chapter('Chapter One'), chapter('Chapter One')])
    expect(out.map((c) => c.title)).toEqual(['Chapter One', 'Chapter 2'])
  })

  it('disambiguates a repeated real title without pretending it is numbered', () => {
    const out = normaliseTitles([chapter('The Bridge'), chapter('The Bridge')])
    expect(out.map((c) => c.title)).toEqual(['The Bridge', 'The Bridge (2)'])
  })

  it('names an untitled chapter by its position', () => {
    expect(normaliseTitles([chapter('  ')])[0].title).toBe('Chapter 1')
  })
})

describe('the scene-break marker', () => {
  it('never survives into the text a writer reads', () => {
    const book = md(`One.\n\n***\n\nTwo.`)
    const everything = book.chapters.flatMap((c) => c.scenes.flatMap((s) => s.paragraphs))
    expect(everything.some((p) => p.includes(SCENE_BREAK.trim()))).toBe(false)
  })
})
