/**
 * Character import acceptance (plan §6), driven through the real UI against a
 * real IndexedDB.
 *
 * The interesting checks are the destructive ones: that a duplicate strategy
 * does what its label says, and that Undo after a bulk import leaves the
 * Playground as it was — including the design and the conversations of a card
 * that got updated, which the import must never touch.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/import-check.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 960 } })
const page = await ctx.newPage()

await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(900)

/** Talk to the app's own database rather than clicking a cast into being. */
async function seed() {
  return page.evaluate(async () => {
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

    const seriesId = id('s')
    await put('series', {
      id: seriesId,
      createdAt: now,
      updatedAt: now,
      name: 'The Salt Road',
      description: '',
      sharedCodex: true,
    })

    const projectIds = []
    for (const title of ['Book One', 'Book Two']) {
      const pid = id('p')
      projectIds.push(pid)
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
        seriesId,
        seriesOrder: projectIds.length,
        status: 'planning',
        settings: {
          defaultAiPresetId: null,
          pov: 'third-limited',
          tense: 'past',
          measureWidthCh: 68,
          structureMode: 'scenes',
        },
      })
    }

    // Two characters in the first book, one in the second — a series import
    // has to gather all three.
    const entry = (projectId, name, summary) => ({
      id: id('e'),
      createdAt: now,
      updatedAt: now,
      projectId,
      seriesId: null,
      type: 'character',
      name,
      aliases: [],
      summary,
      body: null,
      plainText: `${name} in prose.`,
      attributes: [],
      relationships: [],
      imageId: null,
      tags: ['cast'],
      aiContext: 'when-relevant',
      aiContextTokenBudget: null,
    })
    await put('codexEntries', entry(projectIds[0], 'Mira', 'A salt trader.'))
    await put('codexEntries', entry(projectIds[0], 'Tomas', 'An innkeeper.'))
    await put('codexEntries', entry(projectIds[1], 'Elenya', 'A border guard.'))
    // A location, which must never become a character card.
    await put('codexEntries', { ...entry(projectIds[0], 'The Pass', 'A road.'), type: 'location' })

    // A card that already exists, with work on it the import must not destroy.
    await put('characterCards', {
      id: id('c'),
      createdAt: now,
      updatedAt: now,
      projectId: projectIds[0],
      codexEntryId: null,
      displayName: 'Mira',
      avatarImageId: null,
      cropSettings: null,
      design: { frame: 'shard', finish: 'holo', accent: null, gloss: 0.8, vignette: 0.5 },
      description: 'HERS',
      personality: 'HERS',
      scenario: 'The caravan halts.',
      firstMessage: 'You again.',
      exampleDialogue: [],
      systemPromptOverride: null,
      voiceNotes: 'clipped',
      tags: ['mine'],
    })

    db.close()
    return { projectId: projectIds[0] }
  })
}

const { projectId } = await seed()
// Seeded behind the app's back, so reload rather than rely on it noticing.
await page.reload()
await page.waitForTimeout(1200)
check('seeded a series with two books', true, Boolean(projectId))

/** The cards table as the app would read it. */
async function readCards() {
  return page.evaluate(async () => {
    const open = indexedDB.open('inkwell')
    const db = await new Promise((res) => {
      open.onsuccess = () => res(open.result)
    })
    const all = await new Promise((res) => {
      const req = db.transaction('characterCards').objectStore('characterCards').getAll()
      req.onsuccess = () => res(req.result)
    })
    db.close()
    return all
      .filter((c) => typeof c.deletedAt !== 'number')
      .map((c) => ({
        name: c.displayName,
        description: c.description,
        personality: c.personality,
        tags: c.tags,
        scenario: c.scenario,
        firstMessage: c.firstMessage,
        voiceNotes: c.voiceNotes,
        design: c.design ?? null,
        linked: Boolean(c.codexEntryId),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })
}

const before = await readCards()
check('one card to start with', 1, before.length)

async function openImport() {
  await page.goto(`${BASE}#/playground/cards?project=${projectId}`)
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: /^Import$/ }).click()
  await page.waitForTimeout(500)
}

// ── Run one: the whole series, updating the character we already have ────────
await openImport()
await page.getByText('The Salt Road', { exact: true }).click()
await page.waitForTimeout(900)
check('a series gathers characters from every book', true, (await page.locator('[role="dialog"] li').count()) === 3, 'Mira, Tomas, Elenya — and not The Pass')

await page.getByRole('button', { name: /^Review 3$/ }).click()
await page.waitForTimeout(400)
check('the mapping is shown before anything is written', true, await page.getByText('What each field becomes').isVisible())
check('  and what it will not touch', true, await page.getByText(/Never touched/).isVisible())
check('skip is the default, so nothing is overwritten by accident', true, await page.getByText(/2.*to add.*1.*skipped/s).isVisible().catch(() => false))

await page.getByRole('button', { name: 'Update them' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /^Import 3$/ }).click()
await page.waitForTimeout(2200)

const after = await readCards()
check('every character came across', 3, after.length)
check('  the count is reported', true, await page.getByText(/2 imported · 1 updated/).isVisible())
const mira = after.find((c) => c.name === 'Mira')
check('the existing card was refreshed', 'A salt trader.', mira.description)
check('  its design survived', before[0].design, mira.design)
check('  its scenario survived', 'The caravan halts.', mira.scenario)
check('  its voice notes survived', 'clipped', mira.voiceNotes)
check('imported cards are linked to the Almanac', true, after.every((c) => c.linked))

// ── Undo puts everything back ───────────────────────────────────────────────
await page.getByRole('button', { name: 'Undo' }).click()
await page.waitForTimeout(1800)
const undone = await readCards()
check('undo leaves the same cards as before', before, undone)

// ── Run two: keep both ──────────────────────────────────────────────────────
await openImport()
await page.getByText('This book', { exact: true }).click()
await page.waitForTimeout(900)
await page.getByRole('button', { name: /^Review 2$/ }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Add a second card' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /^Import 2$/ }).click()
await page.waitForTimeout(2200)
const copied = await readCards()
check('a second card is numbered, not silently merged', true, copied.some((c) => c.name === 'Mira (2)'), copied.map((c) => c.name).join(', '))
check('  and the original is untouched', 'HERS', copied.find((c) => c.name === 'Mira').description)

await browser.close()
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
