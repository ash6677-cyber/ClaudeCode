/**
 * Navigation acceptance: one destination list, project-aware jumps, real tab
 * titles (plan §2).
 *
 * Playwright is a tool this script borrows, not a dependency of the app, so it
 * resolves at runtime. Override PLAYWRIGHT_MODULE, CHROMIUM_PATH or BASE_URL
 * if the defaults do not match the machine.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/nav-check.mjs
 */
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
)
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5410/'
let failures = 0
const check = (name, expected, actual) => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${name} → ${JSON.stringify(actual)}${ok ? '' : ` — expected ${JSON.stringify(expected)}`}`)
}

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(600)
check('tab title on Projects', 'Projects — Inkwell', await page.title())

// Make a project so the project-scoped screens have something to name.
await page.getByRole('button', { name: /New project|Create your first/i }).first().click()
await page.waitForTimeout(400)
await page.getByLabel('Title', { exact: true }).fill('Mira Vale')
await page.getByRole('button', { name: /^Create/ }).click()
await page.waitForTimeout(900)

// Creating a project stays on Projects; open the card to put a book in scope.
await page.getByText('Mira Vale', { exact: true }).first().click()
await page.waitForTimeout(1200)
const projectId = page.url().match(/project=([^&]+)/)?.[1] ?? null
check('opening the card lands in the Editor', true, Boolean(projectId))
check('tab title in the Editor', true, (await page.title()).includes('Mira Vale'))

// The rail's own labels.
const railLabels = await page.locator('aside nav a').allInnerTexts()
check('rail shows Cover Studio', true, railLabels.some((l) => l.includes('Cover Studio')))
check('rail has no bare "Covers"', false, railLabels.some((l) => l.trim() === 'Covers'))
check('rail shows Playground', true, railLabels.some((l) => l.includes('Playground')))
check('rail has no bare "Cards"', false, railLabels.some((l) => l.trim() === 'Cards'))

// ⌘K lists everything, including what the rail leaves out.
await page.keyboard.press('Control+k')
await page.waitForTimeout(400)
await page.getByPlaceholder(/Search|Type a command|Jump/i).first().fill('')
await page.waitForTimeout(200)
const navSection = await page.locator('[role="dialog"]').innerText()
for (const label of ['Projects', 'Editor', 'Read', 'Almanac', 'Playground', 'Planning', 'Cover Studio', 'Series', 'Stats', 'Book Creator', 'Settings']) {
  check(`palette lists ${label}`, true, navSection.includes(label))
}

// A palette jump keeps the open book.
await page.getByPlaceholder(/Search|Type a command|Jump/i).first().fill('Almanac')
await page.waitForTimeout(300)
await page.getByText('Almanac', { exact: true }).last().click()
await page.waitForTimeout(700)
check('palette jump kept ?project=', true, page.url().includes(`project=${projectId}`))
check('tab title on Almanac', 'Almanac — Mira Vale — Inkwell', await page.title())

await page.goto(`${BASE}#/covers?project=${projectId}`)
await page.waitForTimeout(700)
check('tab title on Cover Studio', 'Cover Studio — Mira Vale — Inkwell', await page.title())

await page.goto(`${BASE}#/settings`)
await page.waitForTimeout(600)
check('tab title on Settings', 'Settings — Inkwell', await page.title())

await browser.close()
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
