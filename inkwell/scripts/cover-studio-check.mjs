/**
 * Cover Studio acceptance for §16.2, §16.4 and §16.6 — variants, undo, the
 * text outline, and the eyedropper — through the real UI.
 *
 * The claims worth driving end-to-end:
 *  - a duplicate is a second design, not a second handle on the first one;
 *  - the star decides what the book wears, and exactly one design wears it;
 *  - undo returns to before the gesture, not one pointer-move back;
 *  - the outline changes the exported pixels, not merely a checkbox;
 *  - the eyedropper answers with the colour that is actually in the picture.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/cover-studio-check.mjs
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

  // The same flat-colour grid the crop harness uses: colour answers "which
  // pixel is this" without pixel-perfect comparisons.
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

const readCovers = () =>
  page.evaluate(async () => {
    const open = indexedDB.open('inkwell')
    const db = await new Promise((res) => {
      open.onsuccess = () => res(open.result)
    })
    const all = await new Promise((res) => {
      const req = db.transaction('covers').objectStore('covers').getAll()
      req.onsuccess = () => res(req.result.filter((r) => typeof r.deletedAt !== 'number'))
    })
    db.close()
    return all
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      .map((cover) => ({
        name: cover.name ?? null,
        active: cover.active ?? null,
        cropX: Math.round(cover.crop.x),
        overlayOn: cover.overlay.enabled,
        titleColor: cover.typography[0]?.color ?? null,
        stroke: cover.typography[0]?.stroke ?? false,
      }))
  })

const preview = page.locator('[data-testid="cover-image"]')
const centreOfPreview = async () => {
  const box = await preview.boundingBox()
  return { box, x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// ── Variants ─────────────────────────────────────────────────────────────────
check('one design to start with', 1, (await readCovers()).length)

await page.getByRole('button', { name: /^Duplicate$/ }).click()
await page.waitForTimeout(900)
let covers = await readCovers()
check('duplicating makes a second design', 2, covers.length)
check('with the design copied into it', '#ffffff', covers[1].titleColor)

// Edit the duplicate and prove the original never felt it.
const { x: cx, y: cy } = await centreOfPreview()
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.move(cx - 100, cy, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(900)
covers = await readCovers()
check(
  'editing the duplicate leaves the original alone',
  [50, true],
  [covers[0].cropX, covers[1].cropX > 50],
  'a duplicate that shares state is a second handle, not a second design',
)

// The star: make the duplicate the cover the book wears. The labels differ
// by state, so select by position among the stars, not by wording.
const stars = page.locator('[aria-label="Use this cover"], [aria-label="This is the cover in use"]')
await stars.last().click()
await page.waitForTimeout(700)
covers = await readCovers()
check('the star marks exactly one design active', [false, true], covers.map((c) => c.active === true))

await stars.first().click()
await page.waitForTimeout(700)
covers = await readCovers()
check('and moving it moves it, never doubles it', [true, false], covers.map((c) => c.active === true))

// Switching back to the first design for the rest of the checks.
await page.getByRole('button', { name: 'Cover 1', exact: false }).first().click().catch(() => {})
await page.waitForTimeout(200)
const firstChip = page.locator('button.truncate').first()
await firstChip.click()
await page.waitForTimeout(600)

// ── Undo ─────────────────────────────────────────────────────────────────────
const before = (await readCovers())[0].cropX
const from = await centreOfPreview()
await page.mouse.move(from.x, from.y)
await page.mouse.down()
await page.mouse.move(from.x - 120, from.y, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(1100)
const dragged = (await readCovers())[0].cropX
check('a drag moved the picture', true, dragged !== before, `${before} → ${dragged}`)

await page.keyboard.press('Control+z')
await page.waitForTimeout(700)
check(
  'Ctrl+Z returns to before the whole drag, not one pointer-move back',
  before,
  (await readCovers())[0].cropX,
)

await page.keyboard.press('Control+Shift+z')
await page.waitForTimeout(700)
check('Ctrl+Shift+Z brings the drag back', dragged, (await readCovers())[0].cropX)

await page.keyboard.press('Control+z')
await page.waitForTimeout(500)

// ── The outline ──────────────────────────────────────────────────────────────
async function exportedTitleDarkCount() {
  await page.getByRole('button', { name: /Export PNG/ }).click()
  await page.waitForTimeout(2200)
  return page.evaluate(async () => {
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
      .filter((a) => a.fileName !== 'grid.png' && a.fileName?.endsWith('.png'))
      .sort((a, b) => b.createdAt - a.createdAt)[0]
    if (!exported) return -1
    const bitmap = await createImageBitmap(exported.blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const c = canvas.getContext('2d')
    c.drawImage(bitmap, 0, 0)
    // A band through the title. White letters on mid-tone grid: only an
    // outline puts near-black pixels here.
    const y = Math.round(bitmap.height * 0.42)
    const row = c.getImageData(0, y, bitmap.width, 1).data
    let dark = 0
    for (let i = 0; i < row.length; i += 4) {
      if (row[i] < 60 && row[i + 1] < 60 && row[i + 2] < 60) dark++
    }
    return dark
  })
}

const plain = await exportedTitleDarkCount()
await page.getByText('THE SALT ROAD').nth(1).click().catch(() => {})
// Open the title layer's controls in the panel.
await page.getByRole('button', { name: /Title/ }).first().click()
await page.waitForTimeout(400)
const outlineSwitch = page.locator('[role="dialog"], body').getByRole('switch').last()
await outlineSwitch.click()
await page.waitForTimeout(600)
check('the outline is stored on the layer', true, (await readCovers())[0].stroke)

const outlined = await exportedTitleDarkCount()
check(
  'and it puts a dark ring around white letters in the exported PNG',
  true,
  outlined > plain + 20,
  `dark pixels across the title row: ${plain} → ${outlined}`,
)

// ── The eyedropper ───────────────────────────────────────────────────────────
await page.getByRole('button', { name: 'Pick a colour from the cover image' }).click()
await page.waitForTimeout(300)
const { box } = await centreOfPreview()
// A point in the top band, clear of the title: image pixel (675, 120) —
// column 3, row 1 of the grid.
await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.15)
await page.waitForTimeout(900)

const expectedHex = await page.evaluate(() => {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const c = canvas.getContext('2d')
  c.fillStyle = `hsl(${(3 * 137) % 360}, 85%, ${18 + 1 * 8}%)`
  c.fillRect(0, 0, 1, 1)
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
})
covers = await readCovers()
check(
  'the eyedropper reads the colour that is actually in the picture',
  expectedHex,
  covers[0].titleColor,
  'image pixel (675, 120): grid column 3, row 1',
)
check('and sampling did not pan the picture', 50, covers[0].cropX)

check('no uncaught errors along the way', [], consoleErrors)

await browser.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
