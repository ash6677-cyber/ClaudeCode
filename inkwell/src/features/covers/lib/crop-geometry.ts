/**
 * Where the source image actually sits on the cover.
 *
 * Placement used to be described twice — once as CSS (`background-size:
 * cover` plus a percentage position plus a `scale()` transform) and once as
 * canvas arithmetic — and the two agreed only by luck. They agreed at zoom 1.
 * They did not agree once zoomed, because CSS scaled the whole layer about
 * its centre *after* positioning it, which quietly made the horizontal and
 * vertical controls do nothing at all on a zoomed cover: whatever offset they
 * asked for, the centre stayed the centre.
 *
 * So the geometry lives here, once, in pixels, and both the preview and the
 * exported PNG read it. That is also what makes dragging the image possible:
 * a drag is only a question about how many pixels of the picture are hidden,
 * and that number is `freeX`/`freeY` below.
 */

export interface Box {
  w: number
  h: number
}

export interface Crop {
  x: number
  y: number
  zoom: number
  rotation: number
}

export interface CoverGeometry {
  /** Where to draw the image, in container pixels. */
  x: number
  y: number
  w: number
  h: number
  /** How much of the image is off the edges — the room a drag has to move in. */
  freeX: number
  freeY: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 3

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

const clampPercent = (n: number) => Math.min(100, Math.max(0, n))

/**
 * The image sized to cover the container, then zoomed, then positioned.
 *
 * `x` and `y` are read as "which part of the hidden overflow to show": 0 is
 * the left or top edge, 100 the right or bottom, 50 the middle. That is
 * exactly what CSS's percentage background-position means, which is why
 * existing covers keep the framing they were saved with.
 */
export function coverGeometry(container: Box, image: Box, crop: Crop): CoverGeometry {
  if (container.w <= 0 || container.h <= 0 || image.w <= 0 || image.h <= 0) {
    return { x: 0, y: 0, w: container.w, h: container.h, freeX: 0, freeY: 0 }
  }
  const base = Math.max(container.w / image.w, container.h / image.h)
  const scale = base * clampZoom(crop.zoom)
  const w = image.w * scale
  const h = image.h * scale
  // Rounding here would show as a hairline of background along one edge at
  // some sizes, so the fractional pixel is kept and left to the renderer.
  const freeX = Math.max(0, w - container.w)
  const freeY = Math.max(0, h - container.h)
  return {
    // Adding zero collapses the negative zero that falls out of `-0 * 0`, so
    // the numbers compare as the plain values they are.
    x: -freeX * (clampPercent(crop.x) / 100) + 0,
    y: -freeY * (clampPercent(crop.y) / 100) + 0,
    w,
    h,
    freeX,
    freeY,
  }
}

/**
 * A drag, in the only terms the crop understands.
 *
 * Moving the picture right by ten pixels means showing ten pixels less of its
 * right-hand side, so the percentage goes down. An axis with nothing hidden
 * has nowhere to go and stays put rather than jumping to an edge.
 */
export function panCrop(
  crop: Crop,
  geometry: Pick<CoverGeometry, 'freeX' | 'freeY'>,
  dx: number,
  dy: number,
): { x: number; y: number } {
  return {
    x: geometry.freeX > 0 ? clampPercent(crop.x - (dx / geometry.freeX) * 100) : crop.x,
    y: geometry.freeY > 0 ? clampPercent(crop.y - (dy / geometry.freeY) * 100) : crop.y,
  }
}

/**
 * A wheel notch or a pinch, as a multiplier rather than a step.
 *
 * Multiplying keeps the felt speed even: the same gesture that takes 1.0 to
 * 1.2 takes 2.0 to 2.4, which is how every other zoom anyone has used behaves.
 */
export function zoomBy(zoom: number, factor: number): number {
  if (!Number.isFinite(factor) || factor <= 0) return clampZoom(zoom)
  return clampZoom(clampZoom(zoom) * factor)
}

/** A wheel delta as a zoom factor. Trackpads report small deltas often. */
export function wheelZoomFactor(deltaY: number): number {
  if (!Number.isFinite(deltaY)) return 1
  return Math.exp(-deltaY / 400)
}
