/**
 * Colour work for the printed surfaces of a box set.
 *
 * A slipcase is printed, not lit by CSS, so these decisions are the ones a
 * designer makes at the press: what colour the board is, whether the foil
 * reads against it, how the board's own edge differs from its face. Getting
 * contrast wrong is the difference between a set that looks manufactured and
 * one that looks like coloured rectangles.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Parses `#rgb`, `#rrggbb` or `rgb(...)`. Falls back to mid grey. */
export function parseColor(value: string): Rgb {
  const text = value.trim()

  const hexMatch = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text)
  if (hexMatch) {
    const hex = hexMatch[1]
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    }
  }

  const rgbMatch = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text)
  if (rgbMatch) {
    return {
      r: clampByte(Number(rgbMatch[1])),
      g: clampByte(Number(rgbMatch[2])),
      b: clampByte(Number(rgbMatch[3])),
    }
  }

  return { r: 128, g: 128, b: 128 }
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) => clampByte(n).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/**
 * Relative luminance, per WCAG — the gamma-corrected version, not a naive
 * channel average. The difference matters most for saturated colours: a
 * strong red and a strong yellow average alike but read nothing alike.
 */
export function relativeLuminance(color: Rgb): number {
  const channel = (value: number) => {
    const c = clampByte(value) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/**
 * Ink that will actually read on a given board colour.
 *
 * Spine text is small and set at an angle you often view from below, so it
 * needs real contrast rather than a designer's preference. Whichever of near
 * black and near white separates further from the board wins — and they are
 * off-black and off-white because printed ink is never pure.
 */
export const PRINT_BLACK = '#17151a'
export const PRINT_WHITE = '#f6f2ea'

export function readableInk(background: string): string {
  const board = parseColor(background)
  return contrastRatio(board, parseColor(PRINT_BLACK)) >=
    contrastRatio(board, parseColor(PRINT_WHITE))
    ? PRINT_BLACK
    : PRINT_WHITE
}

/** Mixes toward white (positive) or black (negative) by `amount` in 0..1. */
export function shade(color: string, amount: number): string {
  const { r, g, b } = parseColor(color)
  const target = amount >= 0 ? 255 : 0
  const t = Math.min(1, Math.abs(amount))
  return toHex({
    r: r + (target - r) * t,
    g: g + (target - g) * t,
    b: b + (target - b) * t,
  })
}

/**
 * The colour of the board's cut edge, visible at the mouth of the case.
 *
 * Greyboard is printed on its faces only; where it is cut, the raw grey core
 * shows. Rendering the edge in the same colour as the face is the detail
 * that makes a slipcase look like a coloured cube instead of a made object.
 */
export function boardEdgeColor(faceColor: string): string {
  const face = parseColor(faceColor)
  // Unbleached greyboard: a dull warm grey. Lighter than this and the lit
  // edge becomes the brightest thing in the render, pulling the eye off the
  // type it frames — which is the opposite of what a cut edge does in life.
  const core = { r: 141, g: 132, b: 119 }
  // Mostly the raw core, tinted slightly by whatever it was printed with, as
  // the ink wicks a little into the cut.
  return toHex({
    r: core.r * 0.86 + face.r * 0.14,
    g: core.g * 0.86 + face.g * 0.14,
    b: core.b * 0.86 + face.b * 0.14,
  })
}

/**
 * Picks the colour a cover reads as, from its pixels.
 *
 * Averaging every pixel gives mud — the mean of a real cover is almost always
 * a desaturated brown. Instead the pixels are bucketed by hue and lightness
 * and the most populous *saturated* bucket wins, which is how a person would
 * answer "what colour is that book": the sky, not the average of the sky and
 * the type.
 *
 * @param pixels RGBA bytes, as `ImageData.data`.
 */
export function dominantColor(pixels: Uint8ClampedArray | number[], fallback = '#3d4a5c'): string {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>()
  let sampled = 0

  // Every fourth pixel is plenty for a colour decision and keeps this cheap
  // enough to run on a full-size cover without blocking a frame.
  for (let i = 0; i + 3 < pixels.length; i += 16) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const alpha = pixels[i + 3]
    if (alpha < 128) continue

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    // Skip near-black and near-white: they are shadow, paper and type, and
    // they dominate the count on almost every cover without being its colour.
    if (max < 28 || min > 232) continue

    const saturation = max === 0 ? 0 : (max - min) / max
    const weight = 1 + saturation * 3
    const key = (Math.round(r / 32) << 10) | (Math.round(g / 32) << 5) | Math.round(b / 32)
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count += weight
    bucket.r += r * weight
    bucket.g += g * weight
    bucket.b += b * weight
    buckets.set(key, bucket)
    sampled++
  }

  if (sampled === 0) return fallback

  let best: { count: number; r: number; g: number; b: number } | null = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket
  }
  if (!best) return fallback

  return toHex({ r: best.r / best.count, g: best.g / best.count, b: best.b / best.count })
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Math.min(255, Math.max(0, value)))
}

/**
 * Cloth colours for a book with no cover art yet.
 *
 * Print-plausible bindings rather than arbitrary hues: a shelf of saturated
 * primaries reads as a bar chart, while these read as books. Kept here so the
 * flat thumbnail on a series card and the 3D set agree on what colour any
 * given volume is — the two looking different would be read as a bug.
 */
export const CLOTH_COLORS = [
  '#2f4858', '#7b3f2e', '#3c5148', '#4a3b63', '#8a6a2f',
  '#2c3e50', '#6b2f3f', '#37564a', '#5a4632', '#403a5c',
] as const

function hashOf(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return hash
}

/** Stable per-book cloth colour, so it never changes between visits. */
export function clothColorFor(seed: string): string {
  return CLOTH_COLORS[hashOf(seed) % CLOTH_COLORS.length]
}

/**
 * Cloth colours for a whole shelf, in reading order.
 *
 * Each book keeps a colour derived from its own id, so it does not change
 * between visits — but a volume that would land on the same binding as the
 * one beside it is nudged to the next colour along. Two identical spines
 * either side of a hairline read as one wide book however good the seam
 * between them is, and with ten cloths and a hash, neighbouring collisions
 * are common rather than rare.
 */
export function clothColorsFor(seeds: readonly string[]): string[] {
  const chosen: string[] = []
  for (const seed of seeds) {
    let index = hashOf(seed) % CLOTH_COLORS.length
    if (chosen.length > 0 && CLOTH_COLORS[index] === chosen[chosen.length - 1]) {
      index = (index + 1) % CLOTH_COLORS.length
    }
    chosen.push(CLOTH_COLORS[index])
  }
  return chosen
}
