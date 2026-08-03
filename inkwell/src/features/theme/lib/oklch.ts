/**
 * Colour, in the space the app is already written in.
 *
 * Every token in the stylesheet is an `oklch()` value, and that is the right
 * space to let someone edit in: lightness, chroma and hue are three things a
 * person can actually reason about, and moving one of them leaves the other
 * two looking the way they did. The same nudge in hex changes all three at
 * once, which is why picking colours in hex feels like guessing.
 *
 * Conversion to sRGB exists here for one reason: to say whether text on a
 * background can be read. Total control over a theme includes the freedom to
 * make something unreadable, so the app should not prevent it — but it should
 * know, and say so.
 */

export interface Oklch {
  /** Perceptual lightness, 0–1. */
  l: number
  /** Chroma — distance from grey. 0 is neutral; ~0.37 is as far as sRGB goes. */
  c: number
  /** Hue angle in degrees, 0–360. */
  h: number
  /** Alpha, 0–1. Omitted means fully opaque. */
  alpha?: number
}

export interface Rgb {
  r: number
  g: number
  b: number
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))

/**
 * Reads the `oklch()` values the stylesheet is written in.
 *
 * Lightness is written as a percentage there and kept as 0–1 here, because
 * every formula below wants it that way and converting once at the edge beats
 * remembering which form you are holding.
 */
export function parseOklch(value: string): Oklch | null {
  const match = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)/i.exec(
    value.trim(),
  )
  if (!match) return null
  const [, rawL, percent, rawC, rawH, rawAlpha] = match
  const l = percent ? Number(rawL) / 100 : Number(rawL)
  const parsed: Oklch = {
    l: clamp(l, 0, 1),
    c: Math.max(0, Number(rawC)),
    h: ((Number(rawH) % 360) + 360) % 360,
  }
  if (rawAlpha !== undefined) parsed.alpha = clamp(Number(rawAlpha), 0, 1)
  return parsed
}

const round = (value: number, places: number) => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/** Writes the form the stylesheet uses, so themed and built-in values match. */
export function formatOklch({ l, c, h, alpha }: Oklch): string {
  const body = `${round(l * 100, 2)}% ${round(c, 4)} ${round(h, 2)}`
  return alpha === undefined || alpha >= 1 ? `oklch(${body})` : `oklch(${body} / ${round(alpha, 3)})`
}

/** OKLab → linear sRGB, by the standard matrices. */
function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function linearToSrgb(channel: number): number {
  const v = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
  return clamp(v, 0, 1)
}

/**
 * The colour as a screen would show it.
 *
 * Out-of-gamut values are clipped per channel rather than gamut-mapped. That
 * is a lie about the colour, but only for chroma the display cannot produce
 * anyway, and it is the same lie the browser tells — so the contrast figure
 * below matches what the reader will actually see.
 */
export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const radians = (h * Math.PI) / 180
  const [lr, lg, lb] = oklabToLinearRgb(l, c * Math.cos(radians), c * Math.sin(radians))
  return {
    r: Math.round(linearToSrgb(lr) * 255),
    g: Math.round(linearToSrgb(lg) * 255),
    b: Math.round(linearToSrgb(lb) * 255),
  }
}

export function toHex(color: Oklch): string {
  const { r, g, b } = oklchToRgb(color)
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function channelLuminance(value: number): number {
  const v = value / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(color: Oklch): number {
  const { r, g, b } = oklchToRgb(color)
  return (
    0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
  )
}

/** WCAG contrast, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

export type ContrastVerdict = 'fails' | 'large-only' | 'good' | 'excellent'

/**
 * What a contrast ratio means for reading.
 *
 * The thresholds are WCAG's: 3 carries headings and little else, 4.5 is the
 * bar for body text, 7 is the enhanced one. Reported rather than enforced —
 * a writer who wants a barely-there grey on grey is allowed to have it, and
 * only needs to know that is what they chose.
 */
export function contrastVerdict(ratio: number): ContrastVerdict {
  if (ratio < 3) return 'fails'
  if (ratio < 4.5) return 'large-only'
  if (ratio < 7) return 'good'
  return 'excellent'
}

/**
 * A readable ink for a background, keeping the background's own hue.
 *
 * Used when a colour is set and its partner has not been touched: a plain
 * black or white would be correct and lifeless, where a very dark or very
 * light version of the same hue reads as deliberate.
 */
export function readableOn(background: Oklch, minimum = 4.5): Oklch {
  const dark: Oklch = { l: 0.16, c: Math.min(background.c, 0.04), h: background.h }
  const light: Oklch = { l: 0.97, c: Math.min(background.c, 0.03), h: background.h }
  const tinted =
    contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light
  if (contrastRatio(background, tinted) >= minimum) return tinted

  // A background of middling lightness leaves neither tinted ink comfortable,
  // and there it is worth losing the hue to stay readable. Black and white
  // always suffice: their contrasts against any background multiply to
  // exactly 21, so the better of the two is never below √21 ≈ 4.58.
  const black: Oklch = { l: 0, c: 0, h: background.h }
  const white: Oklch = { l: 1, c: 0, h: background.h }
  return contrastRatio(background, black) >= contrastRatio(background, white) ? black : white
}

/** Moves lightness by an amount, keeping hue and chroma. */
export function lighten(color: Oklch, by: number): Oklch {
  return { ...color, l: clamp(color.l + by, 0, 1) }
}

/**
 * Rotates a whole palette's hue by the same angle.
 *
 * Recolouring a theme one token at a time means twenty-seven decisions and a
 * palette that no longer agrees with itself. Turning every hue together is
 * the one move that keeps the relationships intact.
 */
export function rotateHue(color: Oklch, degrees: number): Oklch {
  return { ...color, h: (((color.h + degrees) % 360) + 360) % 360 }
}
