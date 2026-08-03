import { describe, expect, it } from 'vitest'

import {
  BOOK_HEIGHT_CM,
  BOOK_WIDTH_CM,
  CASE_WALL_CM,
  framingDistance,
  layoutBoxSet,
  spineThicknessCm,
} from './box-set-layout'

const novel = (projectId: string, wordCount: number) => ({ projectId, wordCount })

describe('spineThicknessCm', () => {
  it('matches a real paperback of the same length', () => {
    // 90,000 words is roughly 330 pages at trade settings, which on 500ppi
    // stock is about 1.7cm of paper plus a couple of millimetres of binding.
    // Anyone can check this against a book on their own shelf.
    expect(spineThicknessCm(90_000)).toBeGreaterThan(1.7)
    expect(spineThicknessCm(90_000)).toBeLessThan(2.2)
  })

  it('gets thicker with length', () => {
    expect(spineThicknessCm(120_000)).toBeGreaterThan(spineThicknessCm(60_000))
  })

  it('gives a novella a printable spine rather than a sliver', () => {
    // A 900-word piece still has to be a solid object you could pick up.
    expect(spineThicknessCm(900)).toBeGreaterThanOrEqual(0.8)
    expect(spineThicknessCm(0)).toBeGreaterThanOrEqual(0.8)
  })

  it('caps an epic instead of rendering a 30cm brick', () => {
    // Past a point real publishers split the volume; a single slab that wide
    // reads as a bug, not as a long book.
    expect(spineThicknessCm(5_000_000)).toBeLessThanOrEqual(6.5)
  })

  it('treats junk word counts as zero rather than producing NaN', () => {
    for (const bad of [NaN, -1, Infinity]) {
      expect(Number.isFinite(spineThicknessCm(bad))).toBe(true)
    }
  })
})

describe('layoutBoxSet', () => {
  it('leaves a hairline between volumes, not a fused block', () => {
    // Packed dead flush, neighbouring spines meet with no seam and the set
    // renders as one striped board rather than as separate books — there is
    // no space for the light to fail to reach. A sliver is enough, and it
    // has to be a real gap rather than a painted line so the shadow falls
    // into it from every angle.
    const layout = layoutBoxSet([
      novel('a', 80_000),
      novel('b', 120_000),
      novel('c', 60_000),
    ])
    for (let i = 1; i < layout.books.length; i++) {
      const previous = layout.books[i - 1]
      const current = layout.books[i]
      const previousRightEdge = previous.offset + previous.thickness / 2
      const currentLeftEdge = current.offset - current.thickness / 2
      const gap = currentLeftEdge - previousRightEdge
      expect(gap).toBeGreaterThan(0.02)
      // Still packed: any wider and they read as books on a shelf with room
      // to fall over, not as a set that was slid into a case together.
      expect(gap).toBeLessThan(0.2)
    }
  })

  it('accounts for the hairlines in the width of the case', () => {
    // Otherwise the books would be wider than the box they sit in.
    const books = [novel('a', 80_000), novel('b', 120_000), novel('c', 60_000)]
    const layout = layoutBoxSet(books)
    const spines = books.reduce((sum, b) => sum + spineThicknessCm(b.wordCount), 0)
    expect(layout.innerWidth).toBeGreaterThan(spines)
    expect(layout.caseWidth).toBeGreaterThan(layout.innerWidth)
  })

  it('centres the run, so adding a book grows the case both ways', () => {
    const layout = layoutBoxSet([novel('a', 80_000), novel('b', 120_000)])
    const first = layout.books[0]
    const last = layout.books[layout.books.length - 1]
    expect(first.offset - first.thickness / 2).toBeCloseTo(-layout.innerWidth / 2, 9)
    expect(last.offset + last.thickness / 2).toBeCloseTo(layout.innerWidth / 2, 9)
  })

  it('keeps the books in the order given', () => {
    // Reading order is authorial; a prequel written last still comes first.
    const layout = layoutBoxSet([novel('three', 70_000), novel('one', 70_000), novel('two', 70_000)])
    expect(layout.books.map((b) => b.projectId)).toEqual(['three', 'one', 'two'])
  })

  it('builds a case that actually contains its books', () => {
    const layout = layoutBoxSet([novel('a', 80_000), novel('b', 95_000)])
    expect(layout.caseWidth).toBeGreaterThan(layout.innerWidth)
    expect(layout.caseHeight).toBeGreaterThan(BOOK_HEIGHT_CM)
    expect(layout.caseDepth).toBeGreaterThan(BOOK_WIDTH_CM)
    // Slack, not a shoebox: the fit is millimetres, not centimetres.
    expect(layout.caseWidth - layout.innerWidth).toBeLessThan(1 + CASE_WALL_CM * 2)
  })

  it('handles a one-book series', () => {
    const layout = layoutBoxSet([novel('only', 80_000)])
    expect(layout.books[0].offset).toBeCloseTo(0, 9)
    expect(layout.caseWidth).toBeGreaterThan(layout.books[0].thickness)
  })

  it('handles an empty series without collapsing', () => {
    const layout = layoutBoxSet([])
    expect(layout.books).toEqual([])
    expect(layout.innerWidth).toBe(0)
    expect(layout.caseHeight).toBeGreaterThan(0)
    expect(layout.caseDepth).toBeGreaterThan(0)
  })

  it('pulls the books out of the case as reveal rises', () => {
    const flush = layoutBoxSet([novel('a', 80_000)], 0)
    const proud = layoutBoxSet([novel('a', 80_000)], 1)
    expect(flush.revealDepth).toBe(0)
    expect(proud.revealDepth).toBeGreaterThan(0)
    // Never so far that a real set would fall out of its case.
    expect(proud.revealDepth).toBeLessThan(BOOK_WIDTH_CM * 0.6)
  })

  it('ignores a nonsensical reveal instead of launching the books', () => {
    expect(layoutBoxSet([novel('a', 80_000)], 40).revealDepth).toBe(
      layoutBoxSet([novel('a', 80_000)], 1).revealDepth,
    )
    expect(layoutBoxSet([novel('a', 80_000)], -3).revealDepth).toBe(0)
  })
})

describe('framingDistance', () => {
  it('backs off further for a wider set', () => {
    // The camera must not need retuning as the series grows.
    const two = layoutBoxSet([novel('a', 90_000), novel('b', 90_000)])
    const nine = layoutBoxSet(Array.from({ length: 9 }, (_, i) => novel(`b${i}`, 90_000)))
    expect(framingDistance(nine, 35, 16 / 9)).toBeGreaterThan(framingDistance(two, 35, 16 / 9))
  })

  it('backs off further on a narrow viewport', () => {
    // On a phone held upright the horizontal field is the tighter one, and
    // framing to the vertical field alone would crop the set off both sides.
    const layout = layoutBoxSet([novel('a', 90_000), novel('b', 90_000), novel('c', 90_000)])
    expect(framingDistance(layout, 35, 0.5)).toBeGreaterThan(framingDistance(layout, 35, 16 / 9))
  })

  it('backs off further for a narrower lens', () => {
    const layout = layoutBoxSet([novel('a', 90_000)])
    expect(framingDistance(layout, 20, 16 / 9)).toBeGreaterThan(framingDistance(layout, 50, 16 / 9))
  })

  it('leaves the set clear of the near edges of the frame', () => {
    // Half the diagonal must fit inside the visible cone at that distance,
    // with room to spare — a set cropped to the pixel looks like a mistake.
    const layout = layoutBoxSet([novel('a', 90_000), novel('b', 130_000)])
    const fov = 35
    const aspect = 16 / 9
    const distance = framingDistance(layout, fov, aspect)
    const radius = 0.5 * Math.hypot(layout.caseWidth, layout.caseHeight, layout.caseDepth)
    const halfVisible = distance * Math.tan((fov * Math.PI) / 180 / 2)
    expect(halfVisible).toBeGreaterThan(radius)
  })
})
