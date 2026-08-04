/**
 * What a character card looks like.
 *
 * Every surface that draws a card — the grid, the detail page, the chat
 * header — renders through one component fed by this module, so a card looks
 * like itself everywhere rather than like whatever each screen happened to
 * style. That is the whole reason the design lives on the record instead of
 * in the tile that happens to be showing it.
 *
 * The values here become custom properties on the card element. Same trick
 * the theme uses, for the same reason: the CSS states the relationships once,
 * and this only decides the handful of numbers that vary per card.
 */

import { parseOklch, readableOn, formatOklch } from '@/features/theme/lib/oklch'
import type { CardDesign, CardFinish, CardFrame } from '@/types'

/** What a card is drawn as when it has never been designed. */
export const DEFAULT_DESIGN: CardDesign = {
  frame: 'plain',
  finish: 'matte',
  accent: null,
  gloss: 0.5,
  vignette: 0.55,
}

export const FRAME_LABEL: Record<CardFrame, string> = {
  plain: 'Plain',
  inlay: 'Inlay',
  arch: 'Arch',
  plate: 'Plate',
  shard: 'Shard',
}

export const FRAME_HINT: Record<CardFrame, string> = {
  plain: 'A clean edge. Lets the portrait do the talking.',
  inlay: 'A rule set in from the edge, like a printed border.',
  arch: 'A rounded top. Reads as a portrait rather than a photo.',
  plate: 'Square and heavy, with a nameplate across the foot.',
  shard: 'Cut corners. Sharp, modern, a little dangerous.',
}

export const FINISH_LABEL: Record<CardFinish, string> = {
  matte: 'Matte',
  satin: 'Satin',
  foil: 'Foil',
  holo: 'Holographic',
}

export const FINISH_HINT: Record<CardFinish, string> = {
  matte: 'No sheen at all. Paper, not plastic.',
  satin: 'A soft, wide highlight.',
  foil: 'One hard specular line, like stamped metal.',
  holo: 'The highlight splits into spectrum.',
}

export const FRAMES: CardFrame[] = ['plain', 'inlay', 'arch', 'plate', 'shard']
export const FINISHES: CardFinish[] = ['matte', 'satin', 'foil', 'holo']

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

/** A design with every field present and in range, from anything at all. */
export function normalizeDesign(design: CardDesign | undefined): CardDesign {
  if (!design) return DEFAULT_DESIGN
  return {
    // An unknown frame or finish came from a newer version or an edited
    // file. Falling back to the default draws something sensible rather
    // than nothing, which is the right answer for a value that is purely
    // presentational.
    frame: FRAMES.includes(design.frame) ? design.frame : DEFAULT_DESIGN.frame,
    finish: FINISHES.includes(design.finish) ? design.finish : DEFAULT_DESIGN.finish,
    accent: typeof design.accent === 'string' && parseOklch(design.accent) ? design.accent : null,
    gloss: clamp01(design.gloss),
    vignette: clamp01(design.vignette),
  }
}

/** True when a design would draw exactly the app's own card. */
export function designIsDefault(design: CardDesign | undefined): boolean {
  const d = normalizeDesign(design)
  return (
    d.frame === DEFAULT_DESIGN.frame &&
    d.finish === DEFAULT_DESIGN.finish &&
    d.accent === null &&
    d.gloss === DEFAULT_DESIGN.gloss &&
    d.vignette === DEFAULT_DESIGN.vignette
  )
}

/**
 * A stable colour for a card that has not chosen one.
 *
 * Derived from the name rather than random, so the same character is the same
 * colour on every device and after every reload — a cast that reshuffles its
 * colours when you refresh is worse than one colour for everybody.
 *
 * Hue only. Lightness and chroma are fixed so every generated accent sits at
 * the same weight, which is what stops a grid of them looking like a bag of
 * sweets.
 */
export function hueFromName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360
  return hash
}

export function generatedAccent(name: string): string {
  return `oklch(68% 0.13 ${hueFromName(name)})`
}

/**
 * The colour a card actually draws in.
 *
 * The writer's choice if they made one, otherwise a stable colour from the
 * name. Never the theme accent: a wall of cards all in the theme's primary is
 * exactly the contact sheet this feature exists to break up.
 */
export function accentFor(design: CardDesign | undefined, name: string): string {
  const d = normalizeDesign(design)
  return d.accent ?? generatedAccent(name)
}

/**
 * The custom properties for a card, ready to put on its element.
 *
 * `--card-ink` is computed rather than chosen: whatever accent a writer picks,
 * the name sitting on it has to stay readable, and asking them to pick a
 * second colour that works is asking them to do the app's job.
 */
export function designStyle(
  design: CardDesign | undefined,
  name: string,
): Record<string, string> {
  const d = normalizeDesign(design)
  const accent = accentFor(d, name)
  const parsed = parseOklch(accent)
  const ink = parsed ? formatOklch(readableOn(parsed)) : 'oklch(98% 0 0)'
  return {
    '--card-accent': accent,
    '--card-ink': ink,
    '--card-gloss': String(d.gloss),
    '--card-vignette': String(d.vignette),
  }
}

/** The class names that carry a card's frame and finish. */
export function designClasses(design: CardDesign | undefined): string {
  const d = normalizeDesign(design)
  return `card-face card-frame-${d.frame} card-finish-${d.finish}`
}
