import { describe, expect, it } from 'vitest'

import { coverIsEmpty, pickCoverFor } from './resolve-cover'
import type { Cover, CoverTypographyLayer } from '@/types'

function layer(text: string): CoverTypographyLayer {
  return {
    id: crypto.randomUUID(),
    kind: 'title',
    text,
    fontFamily: 'literata',
    fontSize: 8,
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: 0,
    align: 'center',
    x: 50,
    y: 30,
    shadow: true,
  }
}

function cover(over: Partial<Cover> = {}): Cover {
  return {
    id: crypto.randomUUID(),
    createdAt: 1_000,
    updatedAt: 1_000,
    projectId: 'p1',
    sourceImageId: null,
    aspectPreset: 'ebook',
    crop: { x: 50, y: 50, zoom: 1, rotation: 0 },
    overlay: { enabled: true, color: '#000000', opacity: 0.35, direction: 'bottom' },
    typography: [],
    exportedImageId: null,
    ...over,
  }
}

describe('pickCoverFor', () => {
  it('finds the design by its own link to the project', () => {
    // Not by Project.coverId, which holds an exported PNG's id. Looking that
    // up in the covers table is what made the box set draw blank jackets.
    const mine = cover({ projectId: 'p1' })
    const theirs = cover({ projectId: 'p2' })
    expect(pickCoverFor([theirs, mine], 'p1')).toBe(mine)
  })

  it('returns nothing for a project that has no design', () => {
    expect(pickCoverFor([cover({ projectId: 'p2' })], 'p1')).toBeUndefined()
  })

  it('picks the same one every time when sync has left two behind', () => {
    // Two devices offline can each create a cover for one book. Whichever
    // order they arrive in, every device has to choose the same row or the
    // shelf and the studio show different art for the same novel.
    const older = cover({ projectId: 'p1', updatedAt: 1_000 })
    const newer = cover({ projectId: 'p1', updatedAt: 2_000 })
    expect(pickCoverFor([older, newer], 'p1')).toBe(newer)
    expect(pickCoverFor([newer, older], 'p1')).toBe(newer)
  })
})

describe('coverIsEmpty', () => {
  it('treats a freshly created record as nothing to draw', () => {
    // Opening Cover Studio creates one. A book the writer merely glanced at
    // must still show its title on the shelf, not a grey rectangle.
    expect(coverIsEmpty(cover())).toBe(true)
  })

  it('counts art alone as a cover', () => {
    expect(coverIsEmpty(cover({ sourceImageId: 'img1' }))).toBe(false)
  })

  it('counts type alone as a cover', () => {
    expect(coverIsEmpty(cover({ typography: [layer('The Salt Road')] }))).toBe(false)
  })

  it('does not count an empty text layer', () => {
    // Adding a layer and not typing in it is not a cover.
    expect(coverIsEmpty(cover({ typography: [layer('   ')] }))).toBe(true)
  })
})
