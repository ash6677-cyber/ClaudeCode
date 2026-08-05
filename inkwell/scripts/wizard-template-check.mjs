/**
 * Book Creator acceptance (plan §15.2–15.5), driven through the real UI.
 *
 * The merge is unit-tested; what those tests cannot see is whether the format
 * chosen on step one is the format the database ends up with, whether the
 * skip really produces a usable book, and whether the banner that explains
 * what was made appears exactly once — including across a reload, which is
 * the case a dismissed-flag implementation gets wrong.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/wizard-template-check.mjs
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

const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(String(e)))

async function openWizard() {
  await page.goto(`${BASE}#/book-creator`)
  await page.waitForTimeout(900)
  // A draft left by an earlier run would open the wizard mid-way.
  const fresh = page.getByRole('button', { name: 'Start fresh' })
  if (await fresh.isVisible().catch(() => false)) {
    await fresh.click()
    await page.waitForTimeout(400)
  }
}

/** The book as the app's own database holds it, newest project first. */
async function readNewestBook() {
  return page.evaluate(async () => {
    const open = indexedDB.open('inkwell')
    const db = await new Promise((res) => {
      open.onsuccess = () => res(open.result)
    })
    const all = (store) =>
      new Promise((res) => {
        const req = db.transaction(store).objectStore(store).getAll()
        req.onsuccess = () => res(req.result.filter((r) => typeof r.deletedAt !== 'number'))
      })
    const [projects, chapters, scenes, cards, codex] = await Promise.all([
      all('projects'),
      all('chapters'),
      all('scenes'),
      all('characterCards'),
      all('codexEntries'),
    ])
    db.close()
    const project = projects.sort((a, b) => b.createdAt - a.createdAt)[0]
    if (!project) return null
    const mine = chapters.filter((c) => c.projectId === project.id).sort((a, b) => a.order - b.order)
    return {
      title: project.title,
      author: project.author,
      chapters: mine.map((c) => ({
        kind: c.kind ?? 'chapter',
        title: c.title,
        scenes: scenes
          .filter((s) => s.chapterId === c.id)
          .sort((a, b) => a.order - b.order)
          .map((s) => ({ title: s.title, summary: s.summary })),
      })),
      cards: cards.filter((c) => c.projectId === project.id).map((c) => c.displayName),
      codex: codex.filter((c) => c.projectId === project.id).map((c) => c.name),
    }
  })
}

const shape = (book) => book.chapters.map((c) => `${c.kind}:${c.title}`)

// ── Step one now carries the format, and it is not decoration ────────────────
await openWizard()
check(
  'the Concept step offers the same formats New Project does',
  true,
  await page.getByRole('button', { name: 'Standard novel' }).isVisible(),
)
check(
  'nothing can move forward without a title',
  true,
  await page.getByText(/needs a title/).isVisible(),
)
check(
  'and Next is not merely disabled in silence',
  true,
  await page.getByRole('button', { name: /^Next/ }).isDisabled(),
)

await page.locator('#wizard-title').fill('The Salt Road')
await page.waitForTimeout(300)
check(
  'the block clears the moment it is answered',
  false,
  await page.getByRole('button', { name: /^Next/ }).isDisabled(),
)

await page.getByRole('button', { name: 'Standard novel' }).click()
await page.waitForTimeout(400)

// ── The outline goes into the format, not beside it ──────────────────────────
await page.getByRole('button', { name: /^Next/ }).click()
await page.waitForTimeout(500)
check(
  'an empty outline says so, and does not pretend to be an error',
  true,
  await page.getByText(/format’s own chapters/).isVisible(),
)

for (const [title, summary] of [
  ['The bridge at dusk', 'Mira crosses.'],
  ['Salt and silence', 'The caravan halts.'],
]) {
  await page.getByRole('button', { name: /Add chapter/i }).click()
  await page.waitForTimeout(200)
  const rows = page.locator('input[placeholder*="Chapter title" i]')
  const n = (await rows.count()) - 1
  await rows.nth(n).fill(title)
  await page.locator('textarea').nth(n).fill(summary)
}
await page.waitForTimeout(400)

await page.getByRole('button', { name: /^Next/ }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Add character/i }).click()
await page.waitForTimeout(300)
check(
  'an unnamed character is warned about before it is silently dropped',
  true,
  await page.getByText(/no name, so it will not be created/).isVisible(),
)
await page.locator('input[placeholder*="Name" i]').first().fill('Mira')
await page.waitForTimeout(300)
check(
  'and the warning goes once the name is there',
  false,
  await page.getByText(/no name, so it will not be created/).isVisible(),
)

await page.getByRole('button', { name: /^Next/ }).click()
await page.waitForTimeout(500)
const reviewText = await page.locator('main, body').first().innerText()
check(
  'Review shows the format’s divisions, not just the outline',
  true,
  reviewText.includes('Prologue') && reviewText.includes('Epilogue'),
  'the wizard used to show two chapters and create two chapters',
)

await page.getByRole('button', { name: /Create book/ }).click()
await page.waitForTimeout(2200)

const book = await readNewestBook()
check(
  'a wizard book built on Standard novel really has a prologue and an epilogue',
  ['prologue:Prologue', 'chapter:The bridge at dusk', 'chapter:Salt and silence', 'epilogue:Epilogue'],
  shape(book),
)
check(
  'the outline’s summary lands on the chapter it was written for',
  ['', 'Mira crosses.', 'The caravan halts.', ''],
  book.chapters.map((c) => c.scenes[0]?.summary ?? null),
)
check('the cast was created', ['Mira'], book.cards)
check('and reached the Codex where it was asked to', ['Mira'], book.codex)

// ── The handoff ──────────────────────────────────────────────────────────────
check(
  'the editor says what was just made',
  true,
  await page.getByText(/created\./).first().isVisible(),
)
// Scoped to the page body: the nav rail has a Playground link of its own,
// and it is always there whether the banner appeared or not.
const bannerLink = page.getByRole('main').getByRole('link', { name: 'Playground' })
check(
  'and points at the Playground, where the cast actually lives',
  true,
  await bannerLink.isVisible(),
)

await page.reload()
await page.waitForTimeout(1500)
check(
  'the banner is a one-time note, not a permanent fixture',
  false,
  await bannerLink.isVisible().catch(() => false),
  'a dismissed-flag implementation gets exactly this case wrong',
)

// ── Skipping ─────────────────────────────────────────────────────────────────
await openWizard()
await page.locator('#wizard-title').fill('A Concept Alone')
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Three acts' }).click()
await page.waitForTimeout(400)
check(
  'the way out exists from step one',
  true,
  await page.getByRole('button', { name: /Just make the book/ }).first().isVisible(),
)
await page.getByRole('button', { name: /Just make the book/ }).first().click()
await page.waitForTimeout(2200)

const skipped = await readNewestBook()
check('skipping still makes the book it was told to', 'A Concept Alone', skipped.title)
check(
  'and lays it out in the format that was chosen, rather than leaving it empty',
  ['part:Part One', 'chapter:Chapter One', 'chapter:Chapter Two'],
  shape(skipped).slice(0, 3),
)
check('a skipped book has all fifteen of that format’s divisions', 15, skipped.chapters.length)
check('and no cast, because none was asked for', [], skipped.cards)

// ── A screenplay fills acts, not chapters ────────────────────────────────────
await openWizard()
await page.locator('#wizard-title').fill('The Long Drive')
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Screenplay' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Just make the book/ }).first().click()
await page.waitForTimeout(2200)

const screenplay = await readNewestBook()
check(
  'a screenplay is acts of scenes, not a novel wearing a different name',
  ['act:Act I', 'act:Act II', 'act:Act III'],
  shape(screenplay),
)
check(
  'and keeps the act weighting a feature actually has',
  [4, 6, 4],
  screenplay.chapters.map((c) => c.scenes.length),
)

check('no uncaught errors along the way', [], consoleErrors)

await browser.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
