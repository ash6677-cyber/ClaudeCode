/**
 * The monster-book stress test: a 150,000-word novel, measured where a
 * writer would feel it.
 *
 * Every other harness proves the app correct on a short book. This one
 * proves it stays *fast* on a long one — 60 chapters, 180 scenes, a cast of
 * thirty — because the difference between premium and premium-in-the-demo
 * is what happens to the keystroke at word 150,001.
 *
 * Reported numbers are wall-clock through the real UI (protocol overhead
 * included), so thresholds are set for the slowest machine we care about,
 * not the fastest lab. What matters most is that they are *enforced*: a
 * change that doubles typing latency fails this script before it ships.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/stress-check.mjs
 */
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
)
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5410/'

let failures = 0
const check = (name, ok, detail) => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name} · ${detail}`)
}

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(String(e)))

await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(1200)

// ── Build the monster ────────────────────────────────────────────────────────
console.log('Seeding: 60 chapters × 3 scenes × ~840 words, 30 Almanac entries…')
const seedStart = Date.now()
const { projectId, totalWords, firstSceneTitle, midSceneTitle } = await page.evaluate(async () => {
  const open = indexedDB.open('inkwell')
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result)
    open.onerror = () => rej(open.error)
  })
  const now = Date.now()
  const id = (p) => `${p}-${Math.random().toString(36).slice(2, 10)}`

  // Deterministic pseudo-prose with the cast woven in, so the codex
  // underline pass has real work to do on every paragraph.
  const cast = [
    'Charlotte', 'Henry', 'Tomas', 'Mirela', 'Osric', 'Brenna', 'Cassian', 'Ilse',
    'Yannick', 'Petra', 'Aldous', 'Sable', 'Ferren', 'Odile', 'Marek', 'Liesl',
    'Corvin', 'Anouk', 'Bertrand', 'Sunniva', 'Dragan', 'Elowen', 'Fitz', 'Greta',
    'Halvard', 'Imke', 'Jorun', 'Kaspar', 'Lorena', 'Matthias',
  ]
  const scraps = [
    'the harbour kept its own counsel and the fog did not lift',
    'a debt is a story someone else gets to finish',
    'the lamps burned low and the ledger stayed open',
    'salt in the timbers, salt in the tea, salt in every promise',
    'nobody rings the bell buoy; the sea does that itself',
    'the road out of town was paved with other people’s reasons',
    'winter came early and stayed like a creditor',
    'what the tide takes it itemises, eventually',
  ]
  const sentence = (c, s, i) =>
    `${cast[(c * 7 + s * 3 + i) % cast.length]} said that ${scraps[(c + s + i) % scraps.length]}, and ${cast[(c * 5 + i) % cast.length]} wrote it down.`
  // 14 words per sentence, 4 sentences per paragraph, 15 paragraphs per scene
  // ≈ 840 words per scene; 180 scenes ≈ 151,200 words.
  const sceneDoc = (c, s) => {
    const paragraphs = []
    for (let p = 0; p < 15; p++) {
      const text = [0, 1, 2, 3].map((i) => sentence(c, s, p * 4 + i)).join(' ')
      paragraphs.push({ type: 'paragraph', content: [{ type: 'text', text }] })
    }
    return paragraphs
  }

  const projectId = id('p')
  const tx = (store) => db.transaction(store, 'readwrite').objectStore(store)
  const put = (store, value) =>
    new Promise((res, rej) => {
      const t = db.transaction(store, 'readwrite')
      t.objectStore(store).put(value)
      t.oncomplete = () => res(value)
      t.onerror = () => rej(t.error)
    })
  // Bulk writes share one transaction per store, or seeding itself takes minutes.
  const putAll = (store, values) =>
    new Promise((res, rej) => {
      const t = db.transaction(store, 'readwrite')
      const os = t.objectStore(store)
      for (const v of values) os.put(v)
      t.oncomplete = () => res()
      t.onerror = () => rej(t.error)
    })

  await put('projects', {
    id: projectId,
    createdAt: now,
    updatedAt: now,
    title: 'The Salt Ledger',
    author: 'A. Writer',
    synopsis: 'Sixty chapters of fog, debt, and tide.',
    genre: 'Literary',
    targetWordCount: 150000,
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

  const chapters = []
  const scenes = []
  let totalWords = 0
  for (let c = 0; c < 60; c++) {
    const chapterId = id('c')
    chapters.push({
      id: chapterId,
      createdAt: now,
      updatedAt: now,
      projectId,
      title: `Chapter ${c + 1}`,
      order: c,
      status: 'drafting',
    })
    for (let s = 0; s < 3; s++) {
      const paragraphs = sceneDoc(c, s)
      const plainText = paragraphs.map((p) => p.content[0].text).join('\n')
      const wordCount = plainText.split(/\s+/).length
      totalWords += wordCount
      scenes.push({
        id: id('s'),
        createdAt: now,
        updatedAt: now,
        projectId,
        chapterId,
        title: `Scene ${c + 1}.${s + 1}`,
        order: s,
        content: { type: 'doc', content: paragraphs },
        plainText,
        wordCount,
        status: 'drafting',
        povCharacterId: null,
        locationCodexId: null,
        summary: '',
        beats: [],
        labels: [],
        linkedCodexIds: [],
      })
    }
  }
  await putAll('chapters', chapters)
  await putAll('scenes', scenes)

  const entries = cast.map((name, i) => ({
    id: id('e'),
    createdAt: now,
    updatedAt: now,
    projectId,
    seriesId: null,
    type: i % 5 === 4 ? 'location' : 'character',
    name,
    aliases: [],
    summary: `${name}, of the salt ledger.`,
    body: null,
    plainText: '',
    attributes: [],
    relationships: [],
    imageId: null,
    tags: [],
    aiContext: 'when-relevant',
    aiContextTokenBudget: null,
  }))
  await putAll('codexEntries', entries)

  db.close()
  return {
    projectId,
    totalWords,
    firstSceneTitle: 'Scene 1.1',
    midSceneTitle: 'Scene 30.2',
  }
})
console.log(`Seeded ${totalWords.toLocaleString()} words in ${Date.now() - seedStart}ms.\n`)

// ── Cold open: how long until a 150k-word book is writable? ────────────────
const tLoad0 = Date.now()
await page.goto(`${BASE}#/editor?project=${projectId}`)
await page.locator('.editor-prose p').first().waitFor({ timeout: 30000 })
const tLoad = Date.now() - tLoad0
check('cold open to a writable editor', tLoad < 5000, `${tLoad}ms (limit 5000)`)

const treeRows = await page.getByRole('main').locator('aside button, aside [role="button"]').count()
console.log(`INFO · manuscript tree renders ${treeRows} interactive rows`)

// ── Scene switch: tree click to fresh prose on screen ───────────────────────
await page.getByText(midSceneTitle, { exact: true }).scrollIntoViewIfNeeded()
const tSwitch0 = Date.now()
await page.getByText(midSceneTitle, { exact: true }).click()
await page.locator('.editor-prose p').first().waitFor({ timeout: 10000 })
const tSwitch = Date.now() - tSwitch0
check('switching scenes mid-book', tSwitch < 1500, `${tSwitch}ms (limit 1500)`)

// ── Typing latency: the number the whole app is judged by ──────────────────
await page.locator('.editor-prose p').nth(7).click()
await page.keyboard.press('End')
// Warm-up (first keystroke pays lazy costs that aren't typing latency).
await page.keyboard.type('warm. ')
const SAMPLE = 'The tide itemised everything we thought we owned, and sent the bill to Charlotte.'
const tType0 = Date.now()
await page.keyboard.type(SAMPLE)
const perKey = (Date.now() - tType0) / SAMPLE.length
check('typing into an 840-word scene of a 150k book', perKey < 20, `${perKey.toFixed(1)}ms/keystroke (limit 20)`)

// ── Autosave of that edit must not stall the caret ──────────────────────────
await page.waitForTimeout(1300)
const tType1 = Date.now()
await page.keyboard.type(' And then some more, mid-save.')
const perKeyDuringSave = (Date.now() - tType1) / 30
check('typing right after autosave fires', perKeyDuringSave < 20, `${perKeyDuringSave.toFixed(1)}ms/keystroke (limit 20)`)

// ── The flush: words typed, scene switched before the save fires ───────────
// Serialisation now happens at save time, not per keystroke — so the one
// thing that must never break is the edit younger than the 800ms debounce
// when the writer clicks away. The unmount flush owes them that sentence.
const FLUSH_SENTINEL = `flush-proof-${Date.now()}`
await page.keyboard.type(` ${FLUSH_SENTINEL}`)
await page.getByText(firstSceneTitle, { exact: true }).click()
await page.locator('.editor-prose p').first().waitFor({ timeout: 10000 })
await page.waitForTimeout(600)
const flushed = await page.evaluate(async (sentinel) => {
  const open = indexedDB.open('inkwell')
  const db = await new Promise((res) => {
    open.onsuccess = () => res(open.result)
  })
  const scenes = await new Promise((res) => {
    const req = db.transaction('scenes').objectStore('scenes').getAll()
    req.onsuccess = () => res(req.result)
  })
  db.close()
  return scenes.some((s) => s.plainText.includes(sentinel))
}, FLUSH_SENTINEL)
check(
  'switching scenes mid-sentence never loses the sentence',
  flushed,
  flushed ? 'the sub-debounce edit reached the database' : 'TYPED WORDS WERE LOST',
)

// ── Whole-manuscript search across 150k words ───────────────────────────────
await page.keyboard.press('Control+Shift+f')
const searchBox = page.getByPlaceholder('Search across every scene…')
await searchBox.waitFor({ timeout: 5000 })
const tSearch0 = Date.now()
await searchBox.fill('creditor')
await page.locator('mark.search-match').first().waitFor({ timeout: 10000 })
const tSearch = Date.now() - tSearch0
const resultCount = await page.getByText(/match(es)?$/).count()
check('searching all 150k words', tSearch < 3000, `${tSearch}ms to first results (limit 3000), ${resultCount} scenes listed`)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// ── The reader: open the whole book as a book ───────────────────────────────
const tRead0 = Date.now()
await page.goto(`${BASE}#/read?project=${projectId}`)
await page.getByText(/Chapter 1\b/).first().waitFor({ timeout: 20000 })
const tRead = Date.now() - tRead0
check('opening the whole book in the reader', tRead < 8000, `${tRead}ms (limit 8000)`)

// ── The pathological scene: an entire draft pasted into ONE scene ──────────
// Writers do this. 20,000 words in a single ProseMirror document is where
// per-keystroke work that "felt free" on an 840-word scene stops being free.
console.log('\nSeeding the pathological scene: ~20,000 words in one document…')
const { giantTitle } = await page.evaluate(async (projectId) => {
  const open = indexedDB.open('inkwell')
  const db = await new Promise((res) => {
    open.onsuccess = () => res(open.result)
  })
  const chapters = await new Promise((res) => {
    const req = db.transaction('chapters').objectStore('chapters').getAll()
    req.onsuccess = () => res(req.result.filter((c) => c.projectId === projectId))
  })
  const chapter = chapters.sort((a, b) => a.order - b.order)[0]
  const now = Date.now()
  const paragraphs = []
  for (let p = 0; p < 350; p++) {
    const text = Array.from(
      { length: 4 },
      (_, i) =>
        `Sentence ${p}.${i}: Charlotte counted what the tide had itemised and Henry disputed the arithmetic in the margin of the salt ledger.`,
    ).join(' ')
    paragraphs.push({ type: 'paragraph', content: [{ type: 'text', text }] })
  }
  const plainText = paragraphs.map((p) => p.content[0].text).join('\n')
  await new Promise((res, rej) => {
    const t = db.transaction('scenes', 'readwrite')
    t.objectStore('scenes').put({
      id: `s-giant-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
      projectId,
      chapterId: chapter.id,
      title: 'The Pasted Draft',
      order: 99,
      content: { type: 'doc', content: paragraphs },
      plainText,
      wordCount: plainText.split(/\s+/).length,
      status: 'drafting',
      povCharacterId: null,
      locationCodexId: null,
      summary: '',
      beats: [],
      labels: [],
      linkedCodexIds: [],
    })
    t.oncomplete = res
    t.onerror = () => rej(t.error)
  })
  db.close()
  return { giantTitle: 'The Pasted Draft' }
}, projectId)

await page.goto(`${BASE}#/editor?project=${projectId}`)
await page.locator('.editor-prose p').first().waitFor({ timeout: 30000 })
const tGiant0 = Date.now()
await page.getByText(giantTitle, { exact: true }).click()
await page.locator('.editor-prose p').nth(300).waitFor({ timeout: 15000 })
const tGiant = Date.now() - tGiant0
check('opening a 20k-word single scene', tGiant < 3000, `${tGiant}ms (limit 3000)`)

await page.locator('.editor-prose p').nth(349).scrollIntoViewIfNeeded()
await page.locator('.editor-prose p').nth(349).click()
await page.keyboard.press('End')
await page.keyboard.type('warm. ')
const GIANT_SAMPLE = 'Still the ledger would not balance, and still she wrote.'
const tGiantType0 = Date.now()
await page.keyboard.type(GIANT_SAMPLE)
const perKeyGiant = (Date.now() - tGiantType0) / GIANT_SAMPLE.length
check(
  'typing at the end of the 20k-word scene',
  perKeyGiant < 25,
  `${perKeyGiant.toFixed(1)}ms/keystroke (limit 25)`,
)

// Focus mode with paragraph dimming rebuilds decorations for all 350
// paragraphs on every keystroke — the harshest thing the editor can be
// asked to do, and exactly the mode a writer deep in a draft lives in.
await page.keyboard.press('Control+.')
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Focus mode settings' }).click()
const dimItem = page.getByRole('menuitemcheckbox', { name: 'Dim other paragraphs' })
if ((await dimItem.getAttribute('data-state')) !== 'checked') await dimItem.click()
else await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await page.locator('.editor-prose p').nth(349).click()
await page.keyboard.press('End')
const tDim0 = Date.now()
await page.keyboard.type(GIANT_SAMPLE)
const perKeyDim = (Date.now() - tDim0) / GIANT_SAMPLE.length
check(
  'typing with focus dim across 350 paragraphs',
  perKeyDim < 30,
  `${perKeyDim.toFixed(1)}ms/keystroke (limit 30)`,
)
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// ── Exporting the monster: EPUB and Word, timed to the download ────────────
await page.goto(`${BASE}#/projects`)
await page.getByRole('button', { name: 'More actions for The Salt Ledger', exact: true }).click()
await page.getByRole('menuitem', { name: 'Export…' }).click()
const exportDialog = page.getByRole('dialog')
await exportDialog.getByText(/chapters · /).waitFor({ timeout: 20000 })

for (const [label, limit] of [
  ['EPUB', 20000],
  ['Word (.docx)', 20000],
]) {
  await exportDialog.getByRole('button', { name: label }).click()
  const downloadPromise = page.waitForEvent('download', { timeout: limit + 5000 })
  const tExport0 = Date.now()
  await exportDialog.getByRole('button', { name: /^Export$/ }).click()
  const download = await downloadPromise
  const tExport = Date.now() - tExport0
  const path = await download.path()
  check(
    `exporting all ${totalWords.toLocaleString()} words to ${label}`,
    tExport < limit && Boolean(path),
    `${tExport}ms (limit ${limit})`,
  )
  // The dialog stays open between formats; re-open if an export closed it.
  if ((await exportDialog.getByRole('button', { name: /^Export$/ }).count()) === 0) {
    await page.getByRole('button', { name: 'More actions for The Salt Ledger', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Export…' }).click()
    await exportDialog.getByText(/chapters · /).waitFor({ timeout: 20000 })
  }
}

// ── Heap sanity ──────────────────────────────────────────────────────────────
const heapMB = await page.evaluate(() =>
  performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
)
if (heapMB !== null) {
  check('JS heap stays reasonable with the monster open', heapMB < 400, `${heapMB}MB (limit 400)`)
}

check('no uncaught errors along the way', consoleErrors.length === 0, JSON.stringify(consoleErrors))

await browser.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
