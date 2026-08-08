/**
 * Almanac export/import acceptance (plan §22.2), through the real UI.
 *
 * The scenario the feature exists for: book one of a series has a cast, book
 * two is a different project, and the cast needs to move — entries,
 * attributes, relationships, portraits — without dragging the prose along.
 *
 * The subtle claims are the ones checked hardest: that "Charlotte is Tomas's
 * sister" still points at Tomas *in the destination*, where every id is
 * different; that a portrait survives as pixels, not as a reference to an
 * asset the destination has never heard of; and that importing the same file
 * twice changes nothing the second time.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/almanac-io-check.mjs
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
await page.waitForTimeout(1200)

// ── Book one with a cast; book two empty but for one clashing name ──────────
const { bookOne, bookTwo } = await page.evaluate(async () => {
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

  const project = async (title) => {
    const pid = id('p')
    await put('projects', {
      id: pid,
      createdAt: now,
      updatedAt: now,
      title,
      author: '',
      synopsis: '',
      genre: '',
      targetWordCount: 80000,
      coverId: null,
      seriesId: null,
      seriesOrder: 0,
      status: 'drafting',
      settings: {
        defaultAiPresetId: null,
        pov: 'third-limited',
        tense: 'past',
        measureWidthCh: 68,
        structureMode: 'scenes',
      },
    })
    return pid
  }

  const bookOne = await project('The Salt Road')
  const bookTwo = await project('The Salt Road II')

  // A solid-colour portrait: the import is proven by pixels, not filenames.
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 8
  const c = canvas.getContext('2d')
  c.fillStyle = '#3a7d44'
  c.fillRect(0, 0, 8, 8)
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  const portraitId = id('img')
  await put('imageAssets', {
    id: portraitId,
    createdAt: now,
    updatedAt: now,
    blob,
    mimeType: 'image/png',
    width: 8,
    height: 8,
    fileName: 'charlotte.png',
  })

  const entry = (projectId, name, over = {}) => ({
    id: id('e'),
    createdAt: now,
    updatedAt: now,
    projectId,
    seriesId: null,
    type: 'character',
    name,
    aliases: [],
    summary: `${name} of the salt road.`,
    body: null,
    plainText: '',
    attributes: [],
    relationships: [],
    imageId: null,
    tags: [],
    aiContext: 'when-relevant',
    aiContextTokenBudget: null,
    ...over,
  })

  const tomas = entry(bookOne, 'Tomas')
  await put('codexEntries', tomas)
  await put('codexEntries', entry(bookOne, 'Charlotte', {
    imageId: portraitId,
    attributes: [{ id: id('a'), key: 'Age', value: '32' }],
    relationships: [{ id: id('r'), targetEntryId: tomas.id, label: 'sister of' }],
  }))
  // Already in book two — the import must leave this one exactly alone.
  await put('codexEntries', entry(bookTwo, 'Tomas', { summary: 'Book two’s own Tomas.' }))

  db.close()
  return { bookOne, bookTwo }
})

// ── Export from book one, through the page's own button ─────────────────────
await page.goto(`${BASE}#/almanac?project=${bookOne}`)
await page.waitForTimeout(1500)

const downloadPromise = page.waitForEvent('download')
await page.getByRole('button', { name: /^Export$/ }).click()
const download = await downloadPromise
const filePath = await download.path()
check('the Almanac exports as a file', true, Boolean(filePath), download.suggestedFilename())

const { readFileSync, writeFileSync } = await import('node:fs')
const exported = JSON.parse(readFileSync(filePath, 'utf8'))
check('the file names its format and version', ['inkwell-almanac', 1], [exported.kind, exported.version])
check('both characters are in it', 2, exported.entries.length)
check(
  'the portrait travels as pixels inside the file',
  true,
  exported.images.length === 1 && exported.images[0].base64.length > 20,
)
check(
  'attributes and relationships are in the file whole',
  ['Age', 'sister of'],
  [
    exported.entries.find((e) => e.name === 'Charlotte')?.attributes[0]?.key,
    exported.entries.find((e) => e.name === 'Charlotte')?.relationships[0]?.label,
  ],
)

// ── Import into book two ─────────────────────────────────────────────────────
const importPath = `${filePath}.almanac.json`
writeFileSync(importPath, JSON.stringify(exported))

await page.goto(`${BASE}#/almanac?project=${bookTwo}`)
await page.waitForTimeout(1200)
await page.locator('input[type="file"]').setInputFiles(importPath)
await page.waitForTimeout(1500)

const readBookTwo = () =>
  page.evaluate(async (projectId) => {
    const open = indexedDB.open('inkwell')
    const db = await new Promise((res) => {
      open.onsuccess = () => res(open.result)
    })
    const all = (store) =>
      new Promise((res) => {
        const req = db.transaction(store).objectStore(store).getAll()
        req.onsuccess = () => res(req.result.filter((r) => typeof r.deletedAt !== 'number'))
      })
    const [entries, assets] = await Promise.all([all('codexEntries'), all('imageAssets')])
    db.close()
    const mine = entries
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => a.name.localeCompare(b.name))
    const charlotte = mine.find((e) => e.name === 'Charlotte')
    const portrait = charlotte?.imageId ? assets.find((a) => a.id === charlotte.imageId) : null
    let pixel = null
    if (portrait) {
      const bitmap = await createImageBitmap(portrait.blob)
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const c = canvas.getContext('2d')
      c.drawImage(bitmap, 4, 4, 1, 1, 0, 0, 1, 1)
      const [r, g, b] = c.getImageData(0, 0, 1, 1).data
      pixel = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    }
    return {
      names: mine.map((e) => e.name),
      tomasSummary: mine.find((e) => e.name === 'Tomas')?.summary,
      charlotteAge: charlotte?.attributes[0]?.value ?? null,
      relationship: charlotte?.relationships[0] ?? null,
      relationshipTargetName:
        mine.find((e) => e.id === charlotte?.relationships[0]?.targetEntryId)?.name ?? null,
      pixel,
    }
  }, bookTwo)

let after = await readBookTwo()
check('Charlotte arrived; Tomas was not duplicated', ['Charlotte', 'Tomas'], after.names)
check(
  'book two’s own Tomas was left exactly alone',
  'Book two’s own Tomas.',
  after.tomasSummary,
  'an import must never overwrite months of work under the same name',
)
check('her attributes came with her', '32', after.charlotteAge)
check(
  '"sister of Tomas" now points at book two\u2019s own Tomas',
  ['sister of', 'Tomas'],
  [after.relationship?.label ?? null, after.relationshipTargetName],
  'the skipped name still resolves, so the link lands on the local copy instead of dying',
)
check('the portrait arrived as the same pixels', '#3a7d44', after.pixel)

// ── The same file again ──────────────────────────────────────────────────────
await page.locator('input[type="file"]').setInputFiles(importPath)
await page.waitForTimeout(1200)
after = await readBookTwo()
check('importing the same file twice changes nothing', ['Charlotte', 'Tomas'], after.names)

check('no uncaught errors along the way', [], consoleErrors)

await browser.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
