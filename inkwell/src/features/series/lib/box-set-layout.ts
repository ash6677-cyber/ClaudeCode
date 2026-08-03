/**
 * Physical layout of a slipcased box set.
 *
 * Everything here is in centimetres and then handed to the renderer at 1
 * unit = 1 cm, so the numbers can be checked against a real book rather than
 * tuned until they look right. A box set reads as fake mostly through
 * proportion — a spine too thick for its page count, a case that fits its
 * books like a shoebox — and proportion is exactly what a unit test can pin
 * down.
 *
 * No three.js in this file. It is arithmetic, and it is tested as arithmetic.
 */

/** Trade paperback trim, the size most novels are actually printed at. */
export const BOOK_HEIGHT_CM = 21.6 // 8.5"
export const BOOK_WIDTH_CM = 14 // 5.5"

/**
 * Words that fit on one printed page at a typical trade setting: 12pt serif,
 * generous leading, ~1" margins. Publishers plan with 250–300; 275 is the
 * middle of that and gives spine widths that match books on a real shelf.
 */
const WORDS_PER_PAGE = 275

/**
 * Thickness of one leaf in centimetres. 60gsm–80gsm trade stock runs about
 * 500 pages to the inch, and a leaf is two pages — so 2.54/500 per page.
 */
const CM_PER_PAGE = 2.54 / 500

/** Covers, endpapers and the hinge add a little to every spine. */
const BINDING_CM = 0.25

/** Nothing is thinner than a pamphlet or thicker than a doorstop. */
const MIN_SPINE_CM = 0.8
const MAX_SPINE_CM = 6.5

/**
 * The crevice between two volumes standing side by side.
 *
 * Books packed dead flush render as one continuous ribbon of colour: with no
 * space between them there is nothing for the light to fail to reach, so
 * neighbouring spines meet with no seam and the set reads as a single striped
 * board rather than as separate books. Real volumes never touch along their
 * whole height, and the dark hairline where they don't is most of what tells
 * the eye where one book ends and the next begins.
 *
 * Small enough to be a hairline at any sensible zoom, wide enough that the
 * shadow map — roughly a tenth of a millimetre per texel across this set —
 * can actually resolve it.
 */
const BOOK_GAP_CM = 0.09

/** Clearance so books slide in and out rather than jamming. */
const CASE_SLACK_CM = 0.25
/** Greyboard thickness of the slipcase walls. */
export const CASE_WALL_CM = 0.3

export interface BookBlock {
  projectId: string
  /** Spine width in cm — the book's thickness on the shelf. */
  thickness: number
  /** Centre of this book along the case's width axis, relative to the set's centre. */
  offset: number
}

export interface BoxSetLayout {
  books: BookBlock[]
  /** Interior span the books occupy. */
  innerWidth: number
  /** Outside dimensions of the slipcase. */
  caseWidth: number
  caseHeight: number
  caseDepth: number
  /** How far the books stand proud of the mouth of the case, in cm. */
  revealDepth: number
}

/**
 * Spine width for a book of a given length.
 *
 * Clamped at both ends: a 900-word flash piece still needs a spine you can
 * print on, and a million-word epic is bound as several volumes in real life
 * rather than as one 30cm brick.
 */
export function spineThicknessCm(wordCount: number): number {
  const words = Number.isFinite(wordCount) && wordCount > 0 ? wordCount : 0
  const pages = words / WORDS_PER_PAGE
  const raw = pages * CM_PER_PAGE + BINDING_CM
  return Math.min(MAX_SPINE_CM, Math.max(MIN_SPINE_CM, raw))
}

export interface BoxSetInput {
  projectId: string
  wordCount: number
}

/**
 * Lays the books out inside their case, in the order given.
 *
 * Volumes sit against one another with only a hairline between them — packed,
 * as a box set is, but not fused. The whole run is then centred, so adding a
 * volume grows the case symmetrically instead of pushing the set sideways.
 */
export function layoutBoxSet(books: BoxSetInput[], reveal = 0): BoxSetLayout {
  const thicknesses = books.map((book) => spineThicknessCm(book.wordCount))
  const gaps = Math.max(0, books.length - 1) * BOOK_GAP_CM
  const innerWidth = thicknesses.reduce((sum, t) => sum + t, 0) + gaps

  let cursor = -innerWidth / 2
  const placed: BookBlock[] = books.map((book, i) => {
    const thickness = thicknesses[i]
    const offset = cursor + thickness / 2
    cursor += thickness + BOOK_GAP_CM
    return { projectId: book.projectId, thickness, offset }
  })

  const caseDepth = BOOK_WIDTH_CM + CASE_SLACK_CM + CASE_WALL_CM
  return {
    books: placed,
    innerWidth,
    caseWidth: innerWidth + CASE_SLACK_CM + CASE_WALL_CM * 2,
    caseHeight: BOOK_HEIGHT_CM + CASE_SLACK_CM + CASE_WALL_CM * 2,
    caseDepth,
    // Half out at full reveal: enough to read every cover, not so much that
    // the books would topple out of a case sitting on a shelf.
    revealDepth: clamp01(reveal) * BOOK_WIDTH_CM * 0.5,
  }
}

/**
 * Distance the camera must sit from the set's centre to frame it completely.
 *
 * Derived from the set's bounding sphere rather than any one dimension, so a
 * one-book set and a nine-book set are both framed the same way and the
 * camera doesn't have to be re-tuned as the series grows.
 */
export function framingDistance(layout: BoxSetLayout, fovDegrees: number, aspect: number): number {
  const radius =
    0.5 * Math.hypot(layout.caseWidth, layout.caseHeight, layout.caseDepth + layout.revealDepth)
  const vFov = (fovDegrees * Math.PI) / 180
  // The horizontal field is the narrower one on a portrait viewport, so the
  // set has to be framed against whichever of the two is tighter.
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
  const fit = radius / Math.sin(Math.min(vFov, hFov) / 2)
  // A little air around the set; a box set cropped to the pixel looks like a
  // mistake even when it is technically in frame.
  return fit * 1.12
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}
