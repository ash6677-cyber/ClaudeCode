/**
 * Geometry for a bending sheet of paper.
 *
 * The page is modelled as a chain of narrow segments hinged end to end.
 * Each segment's angle is slightly greater than the last, so the segments
 * accumulate into an arc rather than a plane — that's what makes the page
 * actually bend instead of pivoting rigidly like a door.
 *
 * Two things fall out of this for free, both of which real paper does and a
 * flat rotation cannot:
 *
 *  - The sheet's *chord* is shorter than its arc length, because paper
 *    doesn't stretch. So as the page bows, its free edge pulls in toward
 *    the spine and then extends again as it flattens onto the other side.
 *  - Every segment faces a slightly different direction, so light across
 *    the page varies continuously instead of as one uniform tone.
 *
 * The bend peaks mid-turn and vanishes at both ends, because a page lying
 * closed against the stack is flat, and a page held upright is at its most
 * bowed.
 */

/**
 * Total angle swept across the sheet at peak bend, in radians (~34°).
 *
 * Tuned down from a much larger value that curled the page into a tube:
 * a sheet held in the hand bows, it doesn't roll up, and an over-curled
 * page also swings far enough toward the viewer that perspective blows it
 * up past the covers.
 */
const MAX_BEND = 0.6

export interface Segment {
  /** Offset from the spine, in page-width units, of this segment's hinge. */
  x: number
  /** Depth of the hinge. Negative is toward the viewer. */
  z: number
  /** Segment angle in radians. */
  angle: number
  /** 0..1 shading for the front face — higher is darker. */
  frontShade: number
  /** 0..1 shading for the reverse. */
  backShade: number
}

/**
 * @param progress 0 = lying flat on the right, 1 = lying flat on the left.
 * @param width    Page width in px.
 * @param count    Number of segments. More is smoother and costlier.
 */
export function computeCurl(progress: number, width: number, count: number): Segment[] {
  const p = Math.max(0, Math.min(1, progress))
  // Mean rotation of the whole sheet: a straight sweep from right to left.
  const sweep = -Math.PI * p
  // How much the sheet bows. Zero when flat at either end, most when upright.
  const bend = -MAX_BEND * Math.sin(Math.PI * p)

  const segmentLength = width / count
  // Centre the bend on the mean angle so the sheet bows symmetrically
  // rather than swinging its free edge wildly ahead of the spine.
  const startAngle = sweep - bend / 2

  const segments: Segment[] = []
  let x = 0
  let z = 0

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1)
    const angle = startAngle + bend * t

    // CSS rotateY(a) sends the local +x axis to (cos a, 0, -sin a), so the
    // hinge chain has to advance along that same vector to stay joined.
    segments.push({
      x,
      z,
      angle,
      // Facing the reader head-on is unshaded; edge-on and beyond is dark.
      frontShade: clamp01(((1 - Math.cos(angle)) / 2) * 0.5),
      backShade: clamp01(((1 + Math.cos(angle)) / 2) * 0.44),
    })

    x += segmentLength * Math.cos(angle)
    z += -segmentLength * Math.sin(angle)
  }

  return segments
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** Straight-line distance from the spine to the sheet's free edge. Shorter
 * than the page width whenever the sheet is bowed. */
export function chordLength(segments: Segment[], width: number, count: number): number {
  const last = segments[segments.length - 1]
  if (!last) return width
  const segmentLength = width / count
  const endX = last.x + segmentLength * Math.cos(last.angle)
  const endZ = last.z + -segmentLength * Math.sin(last.angle)
  return Math.hypot(endX, endZ)
}
