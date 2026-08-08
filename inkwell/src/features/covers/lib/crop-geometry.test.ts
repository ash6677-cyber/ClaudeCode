import { describe, expect, it } from 'vitest'

import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampZoom,
  coverGeometry,
  panCrop,
  wheelZoomFactor,
  zoomBy,
} from './crop-geometry'

const container = { w: 400, h: 600 }
const crop = (over: Partial<Parameters<typeof coverGeometry>[2]> = {}) => ({
  x: 50,
  y: 50,
  zoom: 1,
  rotation: 0,
  ...over,
})

describe('placing the image', () => {
  it('covers the container, never leaving a gap', () => {
    for (const image of [{ w: 1000, h: 400 }, { w: 400, h: 1000 }, { w: 800, h: 1200 }]) {
      const geo = coverGeometry(container, image, crop())
      expect(geo.w).toBeGreaterThanOrEqual(container.w - 0.001)
      expect(geo.h).toBeGreaterThanOrEqual(container.h - 0.001)
    }
  })

  it('keeps the image’s own proportions', () => {
    const geo = coverGeometry(container, { w: 1000, h: 400 }, crop())
    expect(geo.w / geo.h).toBeCloseTo(1000 / 400, 6)
  })

  it('reads 0 and 100 as the two edges, and 50 as the middle', () => {
    const image = { w: 1200, h: 600 }
    const left = coverGeometry(container, image, crop({ x: 0 }))
    const right = coverGeometry(container, image, crop({ x: 100 }))
    const middle = coverGeometry(container, image, crop({ x: 50 }))
    expect(left.x).toBe(0)
    expect(right.x).toBe(-left.freeX)
    expect(middle.x).toBeCloseTo(-left.freeX / 2, 6)
  })

  it('gives a zoomed image room to move on both axes', () => {
    // The bug this replaces: an image whose shape matches the cover had no
    // overflow, so zooming in gave the position controls nothing to do.
    const exact = { w: 400, h: 600 }
    const unzoomed = coverGeometry(container, exact, crop())
    expect([unzoomed.freeX, unzoomed.freeY]).toEqual([0, 0])

    const zoomed = coverGeometry(container, exact, crop({ zoom: 2 }))
    expect(zoomed.freeX).toBeCloseTo(400, 6)
    expect(zoomed.freeY).toBeCloseTo(600, 6)
    expect(coverGeometry(container, exact, crop({ zoom: 2, x: 0 })).x).toBe(0)
  })

  it('refuses to divide by a container or image that is not there yet', () => {
    expect(coverGeometry({ w: 0, h: 0 }, { w: 100, h: 100 }, crop()).w).toBe(0)
    expect(coverGeometry(container, { w: 0, h: 0 }, crop()).freeX).toBe(0)
  })

  it('clamps a percentage that was hand-edited out of range', () => {
    const image = { w: 1200, h: 600 }
    expect(coverGeometry(container, image, crop({ x: 500 })).x).toBe(
      coverGeometry(container, image, crop({ x: 100 })).x,
    )
    expect(coverGeometry(container, image, crop({ x: -20 })).x).toBe(0)
  })
})

describe('dragging the image', () => {
  const geo = coverGeometry(container, { w: 1200, h: 600 }, crop({ zoom: 1 }))

  it('moves the picture the way the hand moved', () => {
    // Dragging right shows less of the right-hand side, which is a lower
    // percentage — the sign nobody gets right by guessing.
    const moved = panCrop(crop(), geo, geo.freeX / 4, 0)
    expect(moved.x).toBeCloseTo(25, 6)
    expect(panCrop(crop(), geo, -geo.freeX / 4, 0).x).toBeCloseTo(75, 6)
  })

  it('stops at the edge rather than tearing free of the image', () => {
    expect(panCrop(crop(), geo, geo.freeX * 5, 0).x).toBe(0)
    expect(panCrop(crop(), geo, -geo.freeX * 5, 0).x).toBe(100)
  })

  it('leaves an axis alone when nothing on it is hidden', () => {
    const flat = coverGeometry(container, { w: 400, h: 600 }, crop())
    expect(panCrop(crop(), flat, 100, 100)).toEqual({ x: 50, y: 50 })
  })

  it('moves further per pixel the tighter the crop is', () => {
    const wide = coverGeometry(container, { w: 4000, h: 600 }, crop())
    const narrow = coverGeometry(container, { w: 500, h: 600 }, crop())
    const wideStep = 50 - panCrop(crop(), wide, 20, 0).x
    const narrowStep = 50 - panCrop(crop(), narrow, 20, 0).x
    expect(narrowStep).toBeGreaterThan(wideStep)
  })
})

describe('zooming', () => {
  it('multiplies, so the gesture feels the same at either end', () => {
    expect(zoomBy(1, 1.2)).toBeCloseTo(1.2, 6)
    expect(zoomBy(2, 1.2)).toBeCloseTo(2.4, 6)
  })

  it('never leaves the range the sliders offer', () => {
    expect(zoomBy(2.9, 4)).toBe(MAX_ZOOM)
    expect(zoomBy(1.1, 0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM)
    expect(zoomBy(1.5, 0)).toBe(1.5)
  })

  it('reads a wheel the way every other zoom does', () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1)
    expect(wheelZoomFactor(100)).toBeLessThan(1)
    expect(wheelZoomFactor(0)).toBe(1)
    // Two small notches equal one large one, so a trackpad and a mouse agree.
    expect(wheelZoomFactor(-50) * wheelZoomFactor(-50)).toBeCloseTo(wheelZoomFactor(-100), 10)
  })
})

describe('finding the pixel under a point', () => {
  it('inverts the placement exactly at zoom 1', async () => {
    const { imagePointAt } = await import('./crop-geometry')
    const image = { w: 1200, h: 600 }
    // Centre of the cover shows the centre of the picture at a centred crop.
    const hit = imagePointAt(container, image, crop(), 200, 300)
    expect(hit).toEqual({ x: 600, y: 300 })
  })

  it('follows the crop: showing the left edge means sampling the left edge', async () => {
    const { imagePointAt } = await import('./crop-geometry')
    const image = { w: 1200, h: 600 }
    const hit = imagePointAt(container, image, crop({ x: 0 }), 0, 0)
    expect(hit).toEqual({ x: 0, y: 0 })
  })

  it('inverts a zoomed placement', async () => {
    const { imagePointAt } = await import('./crop-geometry')
    const image = { w: 400, h: 600 }
    const geoCentre = imagePointAt(container, image, crop({ zoom: 2 }), 200, 300)
    expect(geoCentre).toEqual({ x: 200, y: 300 })
    // Zoomed in twice, a quarter-width step on screen is an eighth of the image.
    const step = imagePointAt(container, image, crop({ zoom: 2 }), 300, 300)
    expect(step?.x).toBe(250)
  })

  it('answers "no pixel" beyond the picture rather than clamping to an edge', async () => {
    const { imagePointAt } = await import('./crop-geometry')
    // Rotation exposes background at the corners; a colour sampled from the
    // nearest edge pixel would be a lie about what is visibly there.
    const image = { w: 400, h: 600 }
    expect(imagePointAt(container, image, crop({ rotation: 45 }), 2, 2)).toBeNull()
  })

  it('round-trips through the rotation', async () => {
    const { imagePointAt, coverGeometry } = await import('./crop-geometry')
    const image = { w: 1200, h: 600 }
    const centre = imagePointAt(container, image, crop({ rotation: 30 }), 200, 300)
    // The centre is the fixed point of the rotation, so it maps to itself.
    expect(centre).toEqual({ x: 600, y: 300 })
    void coverGeometry
  })
})
