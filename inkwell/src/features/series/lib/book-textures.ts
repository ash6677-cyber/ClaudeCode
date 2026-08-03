/**
 * Painting the printed surfaces of a box set onto canvases.
 *
 * Everything the renderer shows is drawn here first: covers, spines, the
 * cut edges of the paper block, the slipcase panels. Drawing them as real
 * images rather than colouring the geometry is what lets a spine carry a
 * title you can read from any angle, and it keeps the whole thing sharp when
 * the same scene is re-rendered at 4K.
 *
 * Resolution is specified in pixels per centimetre against the physical sizes
 * in `box-set-layout`, so a texture is never accidentally low-resolution for
 * the surface it lands on.
 */

import { BOOK_HEIGHT_CM, BOOK_WIDTH_CM } from './box-set-layout'
import { boardEdgeColor, PRINT_BLACK, readableInk, shade } from './palette'

/**
 * The front cover is the surface a reader looks at, so it gets the detail.
 * The back is seen at a glance while turning the set around, and halving its
 * resolution saves about three quarters of its memory for no visible loss.
 */
const FRONT_PX_PER_CM = 80
const BACK_PX_PER_CM = 40
const SPINE_PX_PER_CM = 80
const CASE_PX_PER_CM = 56

const SERIF = "'Literata', Georgia, 'Times New Roman', serif"

export interface BookPrintInput {
  title: string
  author: string
  /** Position in the series, 1-based. 0 hides the volume line. */
  volume: number
  /** Spine thickness in cm — decides how much room the title has. */
  thicknessCm: number
  /** Board colour, normally sampled from the cover art. */
  color: string
}

export interface CasePrintInput {
  seriesName: string
  author: string
  bookCount: number
  caseColor: string
  foilColor: string
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(2, Math.round(width))
  canvas.height = Math.max(2, Math.round(height))
  return canvas
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot draw the box set artwork')
  return ctx
}

/**
 * Shrinks the type until the line fits.
 *
 * Series titles vary from one word to a dozen, and a spine is a few
 * centimetres wide. Measuring and stepping down is the only way a long title
 * doesn't simply run off the end of the board.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  weight = 600,
  minPx = 8,
): number {
  let size = startPx
  ctx.font = `${weight} ${size}px ${SERIF}`
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= Math.max(1, Math.round(size * 0.06))
    ctx.font = `${weight} ${size}px ${SERIF}`
  }
  return size
}

/** Breaks text into lines that fit, at a font already set on the context. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let line = words[0]
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`
    if (ctx.measureText(candidate).width <= maxWidth) line = candidate
    else {
      lines.push(line)
      line = word
    }
  }
  lines.push(line)
  return lines
}

/**
 * Paper grain: a faint vertical noise over a warm base.
 *
 * The cut edge of a book block is not a flat cream rectangle — it is a few
 * hundred individual sheets, and at any real viewing distance that reads as
 * fine vertical striation. A flat fill here is the single most obvious
 * giveaway that a rendered book is a box.
 */
export function paintPageEdges(): HTMLCanvasElement {
  const canvas = createCanvas(512, 512)
  const ctx = context(canvas)

  ctx.fillStyle = '#e8dfcb'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // One stripe per notional leaf, at slightly varying tone so no two sheets
  // sit at exactly the same angle to the light.
  for (let x = 0; x < canvas.width; x += 2) {
    const jitter = Math.sin(x * 12.9898) * 43758.5453
    const t = jitter - Math.floor(jitter)
    ctx.fillStyle = `rgba(120, 104, 78, ${0.05 + t * 0.14})`
    ctx.fillRect(x, 0, 1, canvas.height)
  }

  // Slight darkening toward the spine side, where the block is compressed.
  const shadow = ctx.createLinearGradient(0, 0, 0, canvas.height)
  shadow.addColorStop(0, 'rgba(60, 48, 30, 0.28)')
  shadow.addColorStop(0.25, 'rgba(60, 48, 30, 0)')
  shadow.addColorStop(0.75, 'rgba(60, 48, 30, 0)')
  shadow.addColorStop(1, 'rgba(60, 48, 30, 0.28)')
  ctx.fillStyle = shadow
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  return canvas
}

/**
 * A spine: title reading bottom-to-top, author at the foot, volume at the head.
 *
 * British and American trade convention runs spine text top-to-bottom, but
 * on a box set standing on a shelf the volume number wants to be at the head
 * and the imprint at the foot, so the title is set rotated with its baseline
 * running up the board — which is what a reader tilting their head expects.
 */
export function paintSpine(input: BookPrintInput): HTMLCanvasElement {
  const width = Math.max(24, Math.round(input.thicknessCm * SPINE_PX_PER_CM))
  const height = Math.round(BOOK_HEIGHT_CM * SPINE_PX_PER_CM)
  const canvas = createCanvas(width, height)
  const ctx = context(canvas)

  ctx.fillStyle = input.color
  ctx.fillRect(0, 0, width, height)

  // The hinge, and the reason a row of books reads as separate objects.
  //
  // A spine is not a flat face: it curves away into the boards over the last
  // few millimetres, so its brightness does not taper off gently — it falls
  // off a cliff right at the edge and then turns out of sight. Rendering that
  // as a soft, wide gradient is what made three volumes standing together
  // look like one striped board: each book's soft edge merged into its
  // neighbour's and no seam survived. A hard dark rim in the outermost few
  // per cent, with the face staying flat behind it, gives every volume its
  // own visible boundary from any angle.
  const hinge = ctx.createLinearGradient(0, 0, width, 0)
  hinge.addColorStop(0, 'rgba(0, 0, 0, 0.72)')
  hinge.addColorStop(0.03, 'rgba(0, 0, 0, 0.4)')
  hinge.addColorStop(0.1, 'rgba(0, 0, 0, 0.06)')
  hinge.addColorStop(0.5, 'rgba(0, 0, 0, 0)')
  hinge.addColorStop(0.9, 'rgba(0, 0, 0, 0.06)')
  hinge.addColorStop(0.97, 'rgba(0, 0, 0, 0.4)')
  hinge.addColorStop(1, 'rgba(0, 0, 0, 0.72)')
  ctx.fillStyle = hinge
  ctx.fillRect(0, 0, width, height)

  const ink = readableInk(input.color)
  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ink

  // Reserve the ends for the volume mark and the author.
  const titleRoom = height * 0.66
  const titleSize = fitText(ctx, input.title, titleRoom, width * 0.5, 600)
  ctx.font = `600 ${titleSize}px ${SERIF}`
  ctx.fillText(input.title, 0, 0)

  const smallSize = Math.max(7, titleSize * 0.42)
  ctx.font = `400 ${smallSize}px ${SERIF}`
  ctx.globalAlpha = 0.85
  if (input.author.trim()) {
    // Rotated space: +x runs toward the foot of the spine.
    ctx.fillText(input.author, height / 2 - smallSize * 2.4, 0)
  }
  if (input.volume > 0) {
    ctx.font = `600 ${smallSize}px ${SERIF}`
    ctx.fillText(`${input.volume}`, -height / 2 + smallSize * 2, 0)
  }
  ctx.restore()

  return canvas
}

/**
 * A typographic cover, for a book whose art hasn't been made yet.
 *
 * Deliberately a designed object rather than a grey placeholder: an empty
 * slot in a box set makes the whole set look broken, while a plain
 * typographic jacket looks like a decision.
 */
export function paintFallbackCover(input: BookPrintInput): HTMLCanvasElement {
  const width = Math.round(BOOK_WIDTH_CM * FRONT_PX_PER_CM)
  const height = Math.round(BOOK_HEIGHT_CM * FRONT_PX_PER_CM)
  const canvas = createCanvas(width, height)
  const ctx = context(canvas)

  const wash = ctx.createLinearGradient(0, 0, width * 0.4, height)
  wash.addColorStop(0, shade(input.color, 0.16))
  wash.addColorStop(1, shade(input.color, -0.22))
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, width, height)

  const ink = readableInk(input.color)
  ctx.strokeStyle = ink
  ctx.globalAlpha = 0.45
  ctx.lineWidth = Math.max(2, width * 0.006)
  const inset = width * 0.09
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2)
  ctx.globalAlpha = 1

  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const titleSize = fitText(ctx, input.title, width * 0.68, width * 0.15, 600)
  ctx.font = `600 ${titleSize}px ${SERIF}`
  const lines = wrapLines(ctx, input.title, width * 0.68)
  const lineHeight = titleSize * 1.16
  const start = height * 0.42 - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, i) => ctx.fillText(line, width / 2, start + i * lineHeight))

  if (input.author.trim()) {
    const authorSize = Math.max(10, titleSize * 0.36)
    ctx.font = `400 ${authorSize}px ${SERIF}`
    ctx.globalAlpha = 0.88
    ctx.fillText(input.author.toUpperCase(), width / 2, height * 0.82)
    ctx.globalAlpha = 1
  }

  if (input.volume > 0) {
    const markSize = Math.max(9, titleSize * 0.3)
    ctx.font = `500 ${markSize}px ${SERIF}`
    ctx.globalAlpha = 0.7
    ctx.fillText(`BOOK ${input.volume}`, width / 2, height * 0.19)
    ctx.globalAlpha = 1
  }

  return canvas
}

/** The reverse of a jacket: board colour, a rule, and the imprint. */
export function paintBackCover(input: BookPrintInput): HTMLCanvasElement {
  const width = Math.round(BOOK_WIDTH_CM * BACK_PX_PER_CM)
  const height = Math.round(BOOK_HEIGHT_CM * BACK_PX_PER_CM)
  const canvas = createCanvas(width, height)
  const ctx = context(canvas)

  ctx.fillStyle = shade(input.color, -0.12)
  ctx.fillRect(0, 0, width, height)

  const ink = readableInk(shade(input.color, -0.12))
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.32
  ctx.fillRect(width * 0.16, height * 0.74, width * 0.68, Math.max(1, height * 0.002))
  ctx.globalAlpha = 0.8
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const size = Math.max(7, width * 0.055)
  ctx.font = `400 ${size}px ${SERIF}`
  ctx.fillText(input.author.toUpperCase() || 'INKWELL', width / 2, height * 0.8)
  ctx.globalAlpha = 1

  return canvas
}

/**
 * A printed slipcase panel.
 *
 * @param widthCm  Physical width of the panel.
 * @param heightCm Physical height of the panel.
 * @param rotated  True for the narrow side panels, whose type runs vertically.
 */
export function paintCasePanel(
  input: CasePrintInput,
  widthCm: number,
  heightCm: number,
  rotated: boolean,
): HTMLCanvasElement {
  const width = Math.round(widthCm * CASE_PX_PER_CM)
  const height = Math.round(heightCm * CASE_PX_PER_CM)
  const canvas = createCanvas(width, height)
  const ctx = context(canvas)

  ctx.fillStyle = input.caseColor
  ctx.fillRect(0, 0, width, height)

  // Board is laminated, and laminate is never perfectly even — a broad,
  // very low-contrast sweep keeps the panel from reading as flat vector fill.
  const sweep = ctx.createLinearGradient(0, 0, width, height)
  sweep.addColorStop(0, 'rgba(255, 255, 255, 0.06)')
  sweep.addColorStop(0.5, 'rgba(255, 255, 255, 0)')
  sweep.addColorStop(1, 'rgba(0, 0, 0, 0.1)')
  ctx.fillStyle = sweep
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  if (rotated) {
    ctx.translate(width / 2, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.translate(-height / 2, -width / 2)
  }
  const panelW = rotated ? height : width
  const panelH = rotated ? width : height

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = input.foilColor

  const nameSize = fitText(ctx, input.seriesName, panelW * 0.76, panelH * 0.13, 600)
  ctx.font = `600 ${nameSize}px ${SERIF}`
  const lines = wrapLines(ctx, input.seriesName, panelW * 0.76)
  const lineHeight = nameSize * 1.14
  const start = panelH * 0.44 - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, i) => ctx.fillText(line, panelW / 2, start + i * lineHeight))

  const smallSize = Math.max(8, nameSize * 0.3)
  ctx.font = `400 ${smallSize}px ${SERIF}`
  ctx.globalAlpha = 0.9
  if (input.author.trim()) ctx.fillText(input.author.toUpperCase(), panelW / 2, panelH * 0.28)
  if (input.bookCount > 0) {
    const label = input.bookCount === 1 ? 'THE COMPLETE EDITION' : `${input.bookCount} VOLUMES`
    ctx.fillText(label, panelW / 2, panelH * 0.68)
  }
  ctx.globalAlpha = 1
  ctx.restore()

  return canvas
}

/** Flat fill used for the cut edges of the board at the mouth of the case. */
export function paintBoardEdge(caseColor: string): HTMLCanvasElement {
  const canvas = createCanvas(8, 8)
  const ctx = context(canvas)
  ctx.fillStyle = boardEdgeColor(caseColor)
  ctx.fillRect(0, 0, 8, 8)
  return canvas
}

/**
 * Draws an already-loaded cover image onto a correctly proportioned canvas.
 *
 * Cover art is authored at whatever aspect the writer chose in Cover Studio,
 * but a book is a fixed shape. Cropping to fill — rather than letterboxing —
 * is what a printer would do, and a black bar down the side of a cover in a
 * 3D render looks like a bug every time.
 */
export function paintCoverFromImage(
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
): HTMLCanvasElement {
  const width = Math.round(BOOK_WIDTH_CM * FRONT_PX_PER_CM)
  const height = Math.round(BOOK_HEIGHT_CM * FRONT_PX_PER_CM)
  const canvas = createCanvas(width, height)
  const ctx = context(canvas)

  ctx.fillStyle = PRINT_BLACK
  ctx.fillRect(0, 0, width, height)

  if (imageWidth > 0 && imageHeight > 0) {
    const scale = Math.max(width / imageWidth, height / imageHeight)
    const drawW = imageWidth * scale
    const drawH = imageHeight * scale
    ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH)
  }

  return canvas
}
