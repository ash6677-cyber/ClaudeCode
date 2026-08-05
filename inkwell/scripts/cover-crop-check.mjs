/**
 * Cover Studio acceptance (plan §16.1, §16.3), driven through the real UI.
 *
 * Two things are being proved, and only one of them is arithmetic.
 *
 * The first is that framing by hand works at all — that dragging the picture
 * moves it, and keeps moving it when the cover is zoomed in, which is exactly
 * where the old model gave up: it positioned the image and *then* scaled the
 * whole layer about its centre, so on a zoomed cover the position controls
 * did nothing whatsoever.
 *
 * The second is parity. A cover studio whose export does not match its
 * preview is worse than no cover studio, so the exported PNG is decoded and
 * sampled at the same normalised points as a screenshot of the preview. The
 * source image is a grid of flat colours precisely so that "these two show
 * the same part of the picture" is a question about colour, not about pixels.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/cover-crop-check.mjs
 */
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
)
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5410/'

let failures = 0
const check = (name, expected, actual, note = '') => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual)
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'} · ${name} → ${JSON.stringify(actual)}` +
      `${ok ? '' : ` — expected ${JSON.stringify(expected)}`}${note ? ` · ${note}` : ''}`,
  )
}

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(String(e)))

await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(1000)

/**
 * A project whose cover already has a wide, gridded source image.
 *
 * Wide on purpose: a picture the same shape as the cover has no overflow to
 * pan into at zoom 1, and the first thing worth proving is that panning works
 * in the ordinary case.
 */
const { projectId } = await page.evaluate(async () => {
  const open = indexedDB.open('inkwell')
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result)
    open.onerror = () => rej(open.error)
  })
  const now = Date.now()
  const id = (p) => `${p}-${Math.random().toString(36).slice(2, 10)}`
  const put = (store, value) =>
    new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value)
      tx.oncomplete = () => res(value)
      tx.onerror = () => rej(tx.error)
    })

  // An 8 × 8 grid whose neighbouring cells are as far apart as colours get:
  // a big hue step across, a big lightness step down. Cells that differ only
  // slightly would let a real movement of most of a cell pass for no
  // movement at all, which is the one thing this image exists to rule out.
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 800
  const c = canvas.getContext('2d')
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      c.fillStyle = `hsl(${(col * 137) % 360}, 85%, ${18 + row * 8}%)`
      c.fillRect(col * 200, row * 100, 200, 100)
    }
  }
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))

  const imageId = id('img')
  await put('imageAssets', {
    id: imageId,
    createdAt: now,
    updatedAt: now,
    blob,
    mimeType: 'image/png',
    width: 1600,
    height: 800,
    fileName: 'grid.png',
  })

  const projectId = id('p')
  await put('projects', {
    id: projectId,
    createdAt: now,
    updatedAt: now,
    title: 'The Salt Road',
    author: 'Mira Vance',
    synopsis: '',
    genre: '',
    targetWordCount: 80000,
    coverId: null,
    seriesId: null,
    seriesOrder: 0,
    status: 'planning',
    settings: {
      defaultAiPresetId: null,
      pov: 'third-limited',
      tense: 'past',
      measureWidthCh: 68,
      structureMode: 'scenes',
    },
  })

  await put('covers', {
    id: id('cv'),
    createdAt: now,
    updatedAt: now,
    projectId,
    sourceImageId: imageId,
    aspectPreset: 'ebook',
    crop: { x: 50, y: 50, zoom: 1, rotation: 0 },
    // Seeded off, and full rather than bottom-weighted, so that toggling it
    // is a measurement of the scrim itself and not of where a gradient
    // happens to have faded out by.
    overlay: { enabled: false, color: '#000000', opacity: 0.6, direction: 'full' },
    typography: [
      {
        id: id('t'),
        kind: 'title',
        text: 'THE SALT ROAD',
        fontFamily: 'inter',
        fontSize: 9,
        fontWeight: 700,
        color: '#ffffff',
        letterSpacing: 2,
        align: 'center',
        x: 50,
        y: 42,
        shadow: false,
      },
    ],
    exportedImageId: null,
  })

  db.close()
  return { projectId }
})

await page.goto(`${BASE}#/covers?project=${projectId}`)
await page.waitForTimeout(1600)

const preview = page.locator('[data-testid="cover-image"]')
check('the cover opens with its image', true, await preview.isVisible())

const readCrop = () =>
  page.evaluate(async () => {
    const open = indexedDB.open('inkwell')
    const db = await new Promise((res) => {
      open.onsuccess = () => res(open.result)
    })
    const all = await new Promise((res) => {
      const req = db.transaction('covers').objectStore('covers').getAll()
      req.onsuccess = () => res(req.result)
    })
    db.close()
    const cover = all[all.length - 1]
    return {
      x: Math.round(cover.crop.x * 10) / 10,
      y: Math.round(cover.crop.y * 10) / 10,
      zoom: Math.round(cover.crop.zoom * 100) / 100,
    }
  })

/** Sample a PNG buffer at normalised points, in the page. */
async function samplePng(base64, points) {
  return page.evaluate(
    async ({ base64, points }) => {
      const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const c = canvas.getContext('2d')
      c.drawImage(bitmap, 0, 0)
      return points.map(([u, v]) => {
        const x = Math.min(bitmap.width - 1, Math.max(0, Math.round(u * bitmap.width)))
        const y = Math.min(bitmap.height - 1, Math.max(0, Math.round(v * bitmap.height)))
        const [r, g, b] = c.getImageData(x, y, 1, 1).data
        return [r, g, b]
      })
    },
    { base64, points },
  )
}

// Points away from the edges, where a half-pixel of rounding would decide
// which grid cell a sample lands in.
// Kept clear of the title band (roughly y 0.36–0.48): a sample that lands on
// the lettering measures the text layer, not which part of the picture is on
// screen, and the two rasterise differently in a browser and on a canvas.
const POINTS = [
  [0.25, 0.15],
  [0.75, 0.15],
  [0.25, 0.72],
  [0.75, 0.72],
  [0.5, 0.86],
]

const near = (a, b, tolerance = 24) =>
  a.length === b.length &&
  a.every((c, i) => c.every((channel, j) => Math.abs(channel - b[i][j]) <= tolerance))

async function samplePreview() {
  const shot = await preview.screenshot()
  return samplePng(shot.toString('base64'), POINTS)
}

/** Export through the app's own button, then read the PNG it saved. */
async function exportAndSample() {
  await page.getByRole('button', { name: /Export PNG/ }).click()
  await page.waitForTimeout(2200)
  const base64 = await page.evaluate(async () => {
    const open = indexedDB.open('inkwell')
    const db = await new Promise((res) => {
      open.onsuccess = () => res(open.result)
    })
    const assets = await new Promise((res) => {
      const req = db.transaction('imageAssets').objectStore('imageAssets').getAll()
      req.onsuccess = () => res(req.result)
    })
    db.close()
    const exported = assets
      .filter((a) => a.fileName?.endsWith('.png') && a.fileName !== 'grid.png')
      .sort((a, b) => b.createdAt - a.createdAt)[0]
    if (!exported) return null
    const buffer = await exported.blob.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  })
  return base64 ? samplePng(base64, POINTS) : null
}

// ── Dragging ─────────────────────────────────────────────────────────────────
// Measured immediately before each gesture: taking a screenshot scrolls the
// element into view, so a box read earlier can point at empty page by the
// time the mouse uses it.
const centreOfPreview = async () => {
  const box = await preview.boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** A drag on the picture, in whole pixels from wherever it currently is. */
async function dragBy(dx, dy) {
  const from = await centreOfPreview()
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(900)
}

// Deliberately from the middle, where the title is. A cover's title is the
// biggest thing on it, so "the text always wins" would mean the picture
// behind it could never be moved — which is what the first attempt did.
const beforeDrag = await samplePreview()
await dragBy(-120, 0)

const dragged = await readCrop()
check(
  'dragging the picture moves the crop, without touching a slider',
  true,
  dragged.x > 50,
  `x went 50 → ${dragged.x}; dragging left shows more of the right-hand side`,
)
check('and leaves the axis with nothing to move alone', 50, dragged.y, 'the image is wide, not tall')

const afterDrag = await samplePreview()
check(
  'the preview shows a different part of the picture afterwards',
  false,
  // A tight threshold on purpose: "changed" has to mean changed, not merely
  // "not identical", or a probe that measures nothing would still pass.
  near(beforeDrag, afterDrag, 6),
)

// ── Parity ───────────────────────────────────────────────────────────────────
const exported = await exportAndSample()
check('the export produced a PNG', true, exported !== null)
check(
  'and it shows what the preview showed',
  true,
  near(afterDrag, exported, 40),
  `preview ${JSON.stringify(afterDrag)} vs export ${JSON.stringify(exported)}`,
)

// ── Zoom, and the defect that lived inside it ────────────────────────────────
const zoomPoint = await centreOfPreview()
await page.keyboard.down('Control')
await page.mouse.move(zoomPoint.x, zoomPoint.y)
await page.mouse.wheel(0, -400)
await page.keyboard.up('Control')
await page.waitForTimeout(900)
const zoomed = await readCrop()
check('holding Ctrl and scrolling zooms in', true, zoomed.zoom > 1, `zoom → ${zoomed.zoom}`)

await page.mouse.move(zoomPoint.x, zoomPoint.y)
await page.mouse.wheel(0, -400)
await page.waitForTimeout(700)
check(
  'a plain scroll is left to the page, which has to be able to scroll',
  zoomed.zoom,
  (await readCrop()).zoom,
)

const beforeZoomedDrag = await samplePreview()
await dragBy(0, -100)
const zoomedDrag = await readCrop()
check(
  'a zoomed cover can still be moved vertically',
  true,
  zoomedDrag.y > 50,
  'the old model scaled about the centre after positioning, so this did nothing at all',
)
check(
  'and the picture on screen really moved',
  false,
  near(beforeZoomedDrag, await samplePreview(), 6),
)

const zoomedExport = await exportAndSample()
check(
  'a zoomed, dragged cover still exports what it previews',
  true,
  near(await samplePreview(), zoomedExport, 40),
)

// ── The text, which shares the same surface ─────────────────────────────────
const readTitle = () =>
  page.evaluate(async () => {
    const open = indexedDB.open('inkwell')
    const db = await new Promise((res) => {
      open.onsuccess = () => res(open.result)
    })
    const all = await new Promise((res) => {
      const req = db.transaction('covers').objectStore('covers').getAll()
      req.onsuccess = () => res(req.result)
    })
    db.close()
    const layer = all[all.length - 1].typography[0]
    return { x: Math.round(layer.x), y: Math.round(layer.y) }
  })

const titleBefore = await readTitle()
check('dragging over the title did not drag the title', { x: 50, y: 42 }, titleBefore)

const title = page.locator('[data-testid="cover-surface"]').getByText('THE SALT ROAD')
await title.click()
await page.waitForTimeout(400)
const titleBox = await title.boundingBox()
await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2)
await page.mouse.down()
await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2 - 60, {
  steps: 10,
})
await page.mouse.up()
await page.waitForTimeout(700)
const titleAfter = await readTitle()
check(
  'but a title that has been selected moves when dragged',
  true,
  titleAfter.y < titleBefore.y,
  `y ${titleBefore.y} → ${titleAfter.y}`,
)
check('and stays where it was horizontally', titleBefore.x, titleAfter.x)

// ── The scrim ────────────────────────────────────────────────────────────────
// §16.3 asked for a gradient scrim for legibility over busy art. The studio
// already had one; what was never proved is that it does the job, so that is
// what is measured here rather than the control being added twice.
const relativeLuminance = ([r, g, b]) => {
  const f = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrastWithWhite = (rgb) => 1.05 / (relativeLuminance(rgb) + 0.05)

const readTitleArea = async () => {
  // Sampled just beside the title rather than through it, so the measurement
  // is of the background the white text has to stand on.
  const base64 = await (await preview.screenshot()).toString('base64')
  return samplePng(base64, [[0.12, 0.42]])
}

const bareBackground = (await readTitleArea())[0]

// The Overlay section's own switch, which is the only one on the page until
// a typography layer is expanded.
await page.locator('button[role="switch"]').first().click()
await page.waitForTimeout(800)

const overlayState = await page.evaluate(async () => {
  const open = indexedDB.open('inkwell')
  const db = await new Promise((res) => {
    open.onsuccess = () => res(open.result)
  })
  const all = await new Promise((res) => {
    const req = db.transaction('covers').objectStore('covers').getAll()
    req.onsuccess = () => res(req.result)
  })
  db.close()
  return all[all.length - 1].overlay
})
check('the overlay control turns the scrim on', true, overlayState.enabled)

await page.waitForTimeout(500)
const scrimmed = (await readTitleArea())[0]
check(
  'and it darkens the ground the title stands on',
  true,
  contrastWithWhite(scrimmed) > contrastWithWhite(bareBackground),
  `${contrastWithWhite(bareBackground).toFixed(2)} → ${contrastWithWhite(scrimmed).toFixed(2)} against white`,
)

check('no uncaught errors along the way', [], consoleErrors)

await browser.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
