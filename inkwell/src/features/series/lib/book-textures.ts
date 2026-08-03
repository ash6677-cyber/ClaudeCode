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
// Raised now that the case carries artwork rather than a flat colour: at 56
// the panels were the softest surface in a 4K render.
const CASE_PX_PER_CM = 72

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

export interface PanelArt {
  source: CanvasImageSource
  width: number
  height: number
}

export interface CasePrintInput {
  seriesName: string
  author: string
  bookCount: number
  caseColor: string
  foilColor: string
  /**
   * The covers of the books inside, in reading order.
   *
   * The case is printed from these rather than from artwork of its own: a
   * box set's slipcase carries the series' key art, and the series' key art
   * is what is already on its volumes. Empty prints plain stamped board.
   */
  covers: PanelArt[]
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
 * Always printed upright. Every face of a slipcase is read with the case
 * standing the right way up, so there is no panel whose design should run
 * vertically — an earlier version rotated the narrow ones and left their
 * artwork in texture space, which laid a sideways title straight across a
 * horizontal row of covers.
 *
 * @param widthCm  Physical width of the panel.
 * @param heightCm Physical height of the panel.
 */
export function paintCasePanel(
  input: CasePrintInput,
  widthCm: number,
  heightCm: number,
): HTMLCanvasElement {
  const width = Math.round(widthCm * CASE_PX_PER_CM)
  const height = Math.round(heightCm * CASE_PX_PER_CM)
  const canvas = createCanvas(width, height)
  const ctx = context(canvas)

  ctx.fillStyle = input.caseColor
  ctx.fillRect(0, 0, width, height)

  const panelW = width
  const panelH = height

  const printed = drawCoverMontage(ctx, input.covers, panelW, panelH)

  if (printed) {
    // A scrim under the type. Stamped foil over full-bleed art is unreadable
    // wherever the art happens to be bright, and a series name you can only
    // read on half the panels is worse than no art at all.
    const scrim = ctx.createLinearGradient(0, 0, 0, panelH)
    scrim.addColorStop(0, 'rgba(0, 0, 0, 0.66)')
    scrim.addColorStop(0.3, 'rgba(0, 0, 0, 0.24)')
    scrim.addColorStop(0.62, 'rgba(0, 0, 0, 0.28)')
    scrim.addColorStop(1, 'rgba(0, 0, 0, 0.74)')
    ctx.fillStyle = scrim
    ctx.fillRect(0, 0, panelW, panelH)
  }

  // Board is laminated, and laminate is never perfectly even — a broad,
  // very low-contrast sweep keeps the panel from reading as flat vector fill.
  const sweep = ctx.createLinearGradient(0, 0, panelW, panelH)
  sweep.addColorStop(0, 'rgba(255, 255, 255, 0.06)')
  sweep.addColorStop(0.5, 'rgba(255, 255, 255, 0)')
  sweep.addColorStop(1, 'rgba(0, 0, 0, 0.1)')
  ctx.fillStyle = sweep
  ctx.fillRect(0, 0, panelW, panelH)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = input.foilColor

  if (printed) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
    ctx.shadowBlur = panelH * 0.02
  }

  // With the volumes reproduced across the middle of the panel, the type
  // moves to the head and foot and clears them. On a plain board there is
  // nothing to clear, so it sits centred as a stamped case does.
  const titleY = printed ? 0.16 : 0.44
  const authorY = printed ? 0.26 : 0.28
  const countY = printed ? 0.87 : 0.68

  const nameSize = fitText(ctx, input.seriesName, panelW * 0.76, panelH * (printed ? 0.1 : 0.13), 600)
  ctx.font = `600 ${nameSize}px ${SERIF}`
  const lines = wrapLines(ctx, input.seriesName, panelW * 0.76)
  const lineHeight = nameSize * 1.14
  const start = panelH * titleY - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, i) => ctx.fillText(line, panelW / 2, start + i * lineHeight))

  const smallSize = Math.max(8, nameSize * 0.3)
  ctx.font = `400 ${smallSize}px ${SERIF}`
  ctx.globalAlpha = 0.9
  if (input.author.trim()) {
    ctx.fillText(input.author.toUpperCase(), panelW / 2, panelH * authorY + lineHeight * (lines.length - 1))
  }
  if (input.bookCount > 0) {
    const label = input.bookCount === 1 ? 'THE COMPLETE EDITION' : `${input.bookCount} VOLUMES`
    ctx.fillText(label, panelW / 2, panelH * countY)
  }
  ctx.globalAlpha = 1

  return canvas
}

/**
 * Prints the volumes across a case panel.
 *
 * Two layers, and the reason for both is the same: a finished cover is art
 * *plus type*. Cross-fading ten of them into one continuous band — which is
 * what a wraparound illustration would want — collides ten titles and ten
 * imprints into illegible mush. So the covers appear twice, in two roles.
 *
 * Behind: the same covers blurred past the point where any lettering is
 * recognisable, which leaves an atmospheric wash in exactly the series'
 * colours and nothing to read.
 *
 * In front: each volume reproduced whole and small, in reading order — which
 * is how the back of a real box set shows you what is inside, and the only
 * arrangement where ten covers can share a panel and all stay legible.
 *
 * @returns whether anything was printed.
 */
function drawCoverMontage(
  ctx: CanvasRenderingContext2D,
  covers: PanelArt[],
  width: number,
  height: number,
): boolean {
  if (covers.length === 0) return false

  drawBlurredWash(ctx, covers, width, height)
  drawCoverGrid(ctx, covers, width, height)
  return true
}

/** The covers as an out-of-focus backdrop: colour without content. */
function drawBlurredWash(
  ctx: CanvasRenderingContext2D,
  covers: PanelArt[],
  width: number,
  height: number,
) {
  const slice = width / covers.length
  ctx.save()
  // Blurred at the destination rather than per strip, so the joins between
  // covers dissolve along with their lettering.
  ctx.filter = `blur(${Math.max(8, width * 0.045)}px)`
  covers.forEach((art, index) => {
    // Drawn overscanned: a blur samples beyond each edge, and without the
    // bleed the panel would come back with soft board-coloured gutters.
    const bleed = slice * 0.6
    const left = index * slice - bleed
    const panelWidth = slice + bleed * 2
    const scale = Math.max(panelWidth / art.width, (height * 1.3) / art.height)
    const drawW = art.width * scale
    const drawH = art.height * scale
    ctx.drawImage(art.source, left + (panelWidth - drawW) / 2, (height - drawH) / 2, drawW, drawH)
  })
  ctx.restore()
}

/**
 * Every volume reproduced small, in reading order.
 *
 * Laid out in as few rows as will fit: one row reads best, but ten covers
 * across a narrow side panel would be slivers, so the grid grows a row at a
 * time until each reproduction is a recognisable cover rather than a stripe.
 */
function drawCoverGrid(
  ctx: CanvasRenderingContext2D,
  covers: PanelArt[],
  width: number,
  height: number,
) {
  const areaX = width * 0.08
  const areaW = width * 0.84
  const areaY = height * 0.34
  const areaH = height * 0.42
  const gap = width * 0.012
  const aspect = 0.625 // 5:8, the shape a cover is printed at

  // Whichever arrangement makes the reproductions largest, not the first one
  // that happens to fit. Ten covers in a single row across a panel do fit —
  // as slivers a centimetre wide — while two rows of five are twice the size
  // and are what you could actually recognise a book from.
  let best = { rows: 1, cols: covers.length, w: 0, h: 0 }
  for (let rows = 1; rows <= covers.length; rows++) {
    const cols = Math.ceil(covers.length / rows)
    const byWidth = (areaW - gap * (cols - 1)) / cols
    const byHeight = ((areaH - gap * (rows - 1)) / rows) * aspect
    const w = Math.min(byWidth, byHeight)
    if (w > best.w) best = { rows, cols, w, h: w / aspect }
  }

  const totalH = best.rows * best.h + gap * (best.rows - 1)
  const startY = areaY + (areaH - totalH) / 2

  covers.forEach((art, index) => {
    const row = Math.floor(index / best.cols)
    const col = index % best.cols
    const inRow = Math.min(best.cols, covers.length - row * best.cols)
    const rowW = inRow * best.w + gap * (inRow - 1)
    const x = areaX + (areaW - rowW) / 2 + col * (best.w + gap)
    const y = startY + row * (best.h + gap)

    ctx.save()
    // A printed reproduction sits on the board, so it gets a contact shadow.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
    ctx.shadowBlur = best.w * 0.12
    ctx.shadowOffsetY = best.w * 0.04
    ctx.fillStyle = '#000'
    ctx.fillRect(x, y, best.w, best.h)
    ctx.restore()

    const scale = Math.max(best.w / art.width, best.h / art.height)
    const drawW = art.width * scale
    const drawH = art.height * scale
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, best.w, best.h)
    ctx.clip()
    ctx.drawImage(art.source, x + (best.w - drawW) / 2, y + (best.h - drawH) / 2, drawW, drawH)
    ctx.restore()
  })
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
