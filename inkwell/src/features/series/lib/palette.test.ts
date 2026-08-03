import { describe, expect, it } from 'vitest'

import {
  boardEdgeColor,
  CLOTH_COLORS,
  clothColorFor,
  clothColorsFor,
  contrastRatio,
  dominantColor,
  parseColor,
  PRINT_BLACK,
  PRINT_WHITE,
  readableInk,
  relativeLuminance,
  shade,
  toHex,
} from './palette'

/** Builds RGBA pixel bytes from a list of [r,g,b,count] runs. */
function pixels(...runs: [number, number, number, number][]): Uint8ClampedArray {
  const out: number[] = []
  for (const [r, g, b, count] of runs) {
    for (let i = 0; i < count; i++) out.push(r, g, b, 255)
  }
  return Uint8ClampedArray.from(out)
}

describe('parseColor', () => {
  it('reads the formats the app actually stores', () => {
    expect(parseColor('#ff8800')).toEqual({ r: 255, g: 136, b: 0 })
    expect(parseColor('#f80')).toEqual({ r: 255, g: 136, b: 0 })
    expect(parseColor('FF8800')).toEqual({ r: 255, g: 136, b: 0 })
    expect(parseColor('rgb(255, 136, 0)')).toEqual({ r: 255, g: 136, b: 0 })
    expect(parseColor('rgba(255 136 0 / 0.5)')).toEqual({ r: 255, g: 136, b: 0 })
  })

  it('falls back to grey rather than producing NaN', () => {
    // A malformed colour must render as a dull box, not as a black hole or
    // an invisible one — these values go straight into a canvas fill.
    for (const junk of ['', 'nonsense', '#gg0011', '#12345']) {
      const parsed = parseColor(junk)
      expect(Number.isFinite(parsed.r)).toBe(true)
      expect(parsed).toEqual({ r: 128, g: 128, b: 128 })
    }
  })

  it('round-trips through toHex', () => {
    expect(toHex(parseColor('#2c3e50'))).toBe('#2c3e50')
  })
})

describe('relativeLuminance', () => {
  it('is gamma-corrected, not a channel average', () => {
    // Pure green and pure blue average identically but read nothing alike;
    // a naive mean would rank them the same and pick unreadable ink.
    expect(relativeLuminance(parseColor('#00ff00'))).toBeGreaterThan(
      relativeLuminance(parseColor('#0000ff')) * 5,
    )
  })

  it('spans black to white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 6)
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 6)
  })
})

describe('readableInk', () => {
  it('prints dark on light board and light on dark', () => {
    expect(readableInk('#f2e9d8')).toBe(PRINT_BLACK)
    expect(readableInk('#1b2430')).toBe(PRINT_WHITE)
  })

  it('always clears the WCAG large-text bar', () => {
    // Spine text is small and read at an angle. 3:1 is the floor for large
    // text; anything under it is decoration, not a title you can read.
    const boards = [
      '#ffffff', '#000000', '#7f7f7f', '#c0392b', '#f1c40f',
      '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#16a085',
    ]
    for (const board of boards) {
      const ratio = contrastRatio(parseColor(board), parseColor(readableInk(board)))
      expect(ratio).toBeGreaterThanOrEqual(3)
    }
  })

  it('picks whichever ink separates further, including mid greys', () => {
    // Mid grey is the hard case: both inks are legal, one is clearly better.
    const board = '#808080'
    const chosen = parseColor(readableInk(board))
    const other = parseColor(readableInk(board) === PRINT_BLACK ? PRINT_WHITE : PRINT_BLACK)
    expect(contrastRatio(parseColor(board), chosen)).toBeGreaterThanOrEqual(
      contrastRatio(parseColor(board), other),
    )
  })
})

describe('shade', () => {
  it('lightens and darkens', () => {
    expect(relativeLuminance(parseColor(shade('#3d4a5c', 0.4)))).toBeGreaterThan(
      relativeLuminance(parseColor('#3d4a5c')),
    )
    expect(relativeLuminance(parseColor(shade('#3d4a5c', -0.4)))).toBeLessThan(
      relativeLuminance(parseColor('#3d4a5c')),
    )
  })

  it('reaches pure white and pure black at the extremes', () => {
    expect(shade('#3d4a5c', 1)).toBe('#ffffff')
    expect(shade('#3d4a5c', -1)).toBe('#000000')
  })

  it('clamps rather than overshooting into a wrapped colour', () => {
    expect(shade('#ffffff', 5)).toBe('#ffffff')
    expect(shade('#000000', -5)).toBe('#000000')
  })
})

describe('boardEdgeColor', () => {
  it('is the raw grey core, not the printed face', () => {
    // Greyboard is printed on its faces; the cut edge shows the core. An
    // edge matching the face is what makes a slipcase read as a solid
    // coloured cube rather than as board with something printed on it.
    const face = '#8e1c1c'
    const edge = boardEdgeColor(face)
    expect(edge).not.toBe(face)
    expect(contrastRatio(parseColor(edge), parseColor(face))).toBeGreaterThan(1.5)
  })

  it('takes a faint tint from whatever it was printed with', () => {
    // Ink wicks a little into the cut, so a red case and a blue case do not
    // have identical edges.
    expect(boardEdgeColor('#c0392b')).not.toBe(boardEdgeColor('#2980b9'))
  })

  it('stays in the greyboard family whatever the face', () => {
    for (const face of ['#000000', '#ffffff', '#ff0000']) {
      const { r, g, b } = parseColor(boardEdgeColor(face))
      expect(Math.max(r, g, b)).toBeLessThan(180)
      expect(Math.min(r, g, b)).toBeGreaterThan(95)
    }
  })
})

describe('dominantColor', () => {
  it('picks the colour a person would name, not the average', () => {
    // Half a cover in deep blue, half split between black type and white
    // paper. The mean of that is a muddy grey; the answer is blue.
    const cover = pixels([30, 60, 140, 500], [0, 0, 0, 300], [250, 250, 250, 300])
    const { r, g, b } = parseColor(dominantColor(cover))
    expect(b).toBeGreaterThan(r + 40)
    expect(b).toBeGreaterThan(g + 30)
  })

  it('prefers a saturated minority over a desaturated majority', () => {
    // A muted background covering most of the cover should still lose to a
    // strong accent, the way a person reads a book's colour.
    const cover = pixels([130, 128, 126, 900], [200, 30, 40, 400])
    const { r, g, b } = parseColor(dominantColor(cover))
    expect(r).toBeGreaterThan(g + 60)
    expect(r).toBeGreaterThan(b + 60)
  })

  it('ignores transparent pixels', () => {
    const data = Uint8ClampedArray.from([
      ...Array.from({ length: 400 }, () => [10, 200, 90, 0]).flat(),
      ...Array.from({ length: 100 }, () => [200, 40, 40, 255]).flat(),
    ])
    const { r, g } = parseColor(dominantColor(data))
    expect(r).toBeGreaterThan(g)
  })

  it('falls back when there is nothing to read', () => {
    expect(dominantColor(new Uint8ClampedArray(0), '#123456')).toBe('#123456')
    // All black and all white are both "no colour here".
    expect(dominantColor(pixels([0, 0, 0, 400]), '#123456')).toBe('#123456')
    expect(dominantColor(pixels([255, 255, 255, 400]), '#123456')).toBe('#123456')
  })

  it('returns a valid hex colour for any input', () => {
    const random = Uint8ClampedArray.from(
      Array.from({ length: 4000 }, (_, i) => (i * 37) % 256),
    )
    expect(dominantColor(random)).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('clothColorsFor', () => {
  it('never puts two identical bindings side by side', () => {
    // Two volumes in the same cloth either side of a hairline read as one
    // wide book however good the seam between them is. With ten cloths and a
    // hash, a neighbouring collision is common rather than rare.
    const ids = Array.from({ length: 200 }, (_, i) => `project-${i}`)
    for (let start = 0; start + 6 <= ids.length; start += 3) {
      const shelf = clothColorsFor(ids.slice(start, start + 6))
      for (let i = 1; i < shelf.length; i++) {
        expect(shelf[i]).not.toBe(shelf[i - 1])
      }
    }
  })

  it('is stable — the same shelf always gets the same bindings', () => {
    const ids = ['a', 'b', 'c', 'd']
    expect(clothColorsFor(ids)).toEqual(clothColorsFor(ids))
  })

  it('keeps each book on its own colour when no neighbour clashes', () => {
    // Only a collision moves a book; otherwise it keeps the colour its id
    // gives it, so a volume does not change binding when one is added later.
    const ids = ['a', 'b', 'c']
    const shelf = clothColorsFor(ids)
    ids.forEach((id, i) => {
      if (i === 0 || clothColorFor(id) !== shelf[i - 1]) expect(shelf[i]).toBe(clothColorFor(id))
    })
  })

  it('only ever uses real cloth colours', () => {
    for (const color of clothColorsFor(['x', 'y', 'z', 'w'])) {
      expect(CLOTH_COLORS).toContain(color)
    }
  })

  it('copes with an empty shelf and a single book', () => {
    expect(clothColorsFor([])).toEqual([])
    expect(clothColorsFor(['solo'])).toEqual([clothColorFor('solo')])
  })
})
