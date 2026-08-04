/**
 * The Book Creator navigation matrix, executed rather than asserted on paper.
 *
 * Every row is a real gesture on a real phone-sized Chromium: the browser's
 * back, forward after back, the in-app Back button, Cancel, a reload, and a
 * tab kill. Each one records the step the wizard lands on and whether the
 * fields the writer typed are still there.
 *
 * Hardware back on Android and the iOS swipe-back gesture are deliberately
 * not "simulated": both dispatch exactly the same popstate as page.goBack(),
 * so a separate fake would test the fake, not the app.
 */
/*
 * Playwright is not a dependency of this app — it is a tool this script
 * borrows. Point PLAYWRIGHT_MODULE at an install and CHROMIUM_PATH at a
 * browser if the defaults are wrong for the machine, and BASE_URL at
 * wherever the build is being served from.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/wizard-nav-matrix.mjs
 */
const PLAYWRIGHT_MODULE =
  process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const { chromium, devices } = await import(PLAYWRIGHT_MODULE)

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5410/'
const WIZARD = `${BASE}#/book-creator`

const rows = []
let failures = 0

function record(gesture, from, expected, actual, extra = '') {
  const ok = expected === actual
  if (!ok) failures++
  rows.push({ gesture, from, expected, actual, ok, extra })
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${gesture} (from ${from}) → ${actual}${ok ? '' : ` — expected ${expected}`}${extra ? ` · ${extra}` : ''}`)
}

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] })

/** Where are we, as far as a writer is concerned? */
async function where(page) {
  const url = page.url()
  if (!url.includes('#/book-creator')) {
    return url.includes('#/projects') ? 'projects' : `elsewhere(${url.split('#')[1] ?? url})`
  }
  const m = url.match(/[?&]step=([a-z]+)/)
  return m ? m[1] : 'concept(no param)'
}

/** The heading of whichever step panel is on screen — the app's own answer. */
async function visibleStep(page) {
  const checks = [
    ['concept', '#wizard-title'],
    ['outline', '#wizard-chapter-count'],
    ['cast', '#wizard-cast-count'],
    ['review', 'text=Ready to create'],
  ]
  for (const [name, sel] of checks) {
    if (await page.locator(sel).first().isVisible().catch(() => false)) return name
  }
  return 'none'
}

async function titleValue(page) {
  if (!(await page.locator('#wizard-title').first().isVisible().catch(() => false))) return null
  return page.locator('#wizard-title').inputValue()
}

async function fillWizardToReview(page) {
  await page.locator('#wizard-title').fill('The Salt Road')
  await page.locator('#wizard-genre').fill('Literary fantasy')
  await page.locator('#wizard-synopsis').fill('A salt caravan crosses a border that no longer exists.')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Add chapter' }).click()
  await page.getByPlaceholder('Chapter title').first().fill('The door in the wall')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Add character' }).click()
  await page.getByPlaceholder('Name').first().fill('Mira')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(600) // let the debounced draft land
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Forward through every step, then back out of the whole wizard.
// ─────────────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices['iPhone 12'] })
  const page = await ctx.newPage()
  await page.goto(`${BASE}#/projects`)
  await page.getByRole('link', { name: /Book Creator|Start with the Book Creator/i }).first().click()
  await page.waitForTimeout(300)
  record('enter from Projects', 'projects', 'concept', await visibleStep(page))

  await fillWizardToReview(page)
  record('Next ×3', 'concept', 'review', await visibleStep(page), `url=${await where(page)}`)

  await page.goBack()
  await page.waitForTimeout(200)
  record('browser back', 'review', 'cast', await visibleStep(page))
  record('  fields intact', 'cast', 'Mira', await page.getByPlaceholder('Name').first().inputValue())

  await page.goBack()
  await page.waitForTimeout(200)
  record('browser back', 'cast', 'outline', await visibleStep(page))
  record('  fields intact', 'outline', 'The door in the wall', await page.getByPlaceholder('Chapter title').first().inputValue())

  await page.goBack()
  await page.waitForTimeout(200)
  record('browser back', 'outline', 'concept', await visibleStep(page))
  record('  fields intact', 'concept', 'The Salt Road', await titleValue(page))

  await page.goBack()
  await page.waitForTimeout(300)
  record('browser back (4th)', 'concept', 'projects', await where(page))

  // Forward re-enters the wizard, which remounts it — so this is also the
  // "come back later" path: the draft puts the writer back where they were,
  // not at a blank step 1.
  await page.goForward()
  await page.waitForTimeout(400)
  record('browser forward (re-enter)', 'projects', 'review', await visibleStep(page))
  record('  cast intact', 'review', 'true', String(await page.getByText('Mira').first().isVisible()))

  await page.goForward()
  await page.waitForTimeout(200)
  record('browser forward', 'review', 'outline', await visibleStep(page))

  await ctx.close()
}

// ─────────────────────────────────────────────────────────────────────────────
// B. The in-app Back button, and Cancel with a draft in hand.
// ─────────────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices['iPhone 12'] })
  const page = await ctx.newPage()
  await page.goto(WIZARD)
  await fillWizardToReview(page)

  await page.getByRole('button', { name: 'Back' }).click()
  await page.waitForTimeout(200)
  record('in-app Back', 'review', 'cast', await visibleStep(page))
  await page.getByRole('button', { name: 'Back' }).click()
  await page.waitForTimeout(200)
  record('in-app Back', 'cast', 'outline', await visibleStep(page))

  const backDisabled = await page.getByRole('button', { name: 'Back' }).isDisabled()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.waitForTimeout(200)
  record('in-app Back', 'outline', 'concept', await visibleStep(page))
  record('Back disabled at step 1', 'concept', 'true', String(await page.getByRole('button', { name: 'Back' }).isDisabled()), `was ${backDisabled} at outline`)

  // The stepper may only reach as far as the writer has been.
  await page.getByRole('button', { name: 'Review' }).click()
  await page.waitForTimeout(200)
  record('stepper jump to Review', 'concept', 'review', await visibleStep(page))

  // Cancel with content must ask, and the dialog must fit on the screen.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(250)
  const dialog = page.getByRole('alertdialog')
  const box = await dialog.boundingBox()
  const vp = page.viewportSize()
  const fits = box !== null && box.y >= 0 && box.y + box.height <= vp.height + 1
  record('Cancel with a draft', 'review', 'true', String(await dialog.isVisible()), 'confirm shown')
  record('  dialog fits the screen', 'review', 'true', String(fits), box ? `y=${Math.round(box.y)} h=${Math.round(box.height)} vp=${vp.height}` : 'no box')

  await page.getByRole('button', { name: 'Keep writing' }).click()
  await page.waitForTimeout(250)
  record('Keep writing', 'confirm', 'review', await visibleStep(page))

  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Leave', exact: true }).click()
  await page.waitForTimeout(400)
  record('Leave', 'confirm', 'projects', await where(page))

  await ctx.close()
}

// ─────────────────────────────────────────────────────────────────────────────
// C. The draft survives a reload, a killed tab, and a hand-typed URL.
// ─────────────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices['iPhone 12'] })
  const page = await ctx.newPage()
  await page.goto(WIZARD)
  await fillWizardToReview(page)

  await page.reload()
  await page.waitForTimeout(500)
  record('reload', 'review', 'review', await visibleStep(page), `url=${await where(page)}`)
  record('  notice shown', 'review', 'true', String(await page.getByText('Picked up where you left off.').isVisible()))
  await page.getByRole('button', { name: 'Back' }).click()
  await page.waitForTimeout(200)
  record('  Back after reload stays in-app', 'review', 'cast', await visibleStep(page))
  record('  cast intact', 'cast', 'Mira', await page.getByPlaceholder('Name').first().inputValue())

  // Kill the tab outright — no unload ceremony the app can rely on.
  await page.close()
  const page2 = await ctx.newPage()
  await page2.goto(WIZARD)
  await page2.waitForTimeout(500)
  record('killed tab, reopened', 'cast', 'cast', await visibleStep(page2))
  record('  title restored', 'cast', 'The Salt Road', await (async () => {
    await page2.getByRole('button', { name: 'Concept' }).click()
    await page2.waitForTimeout(200)
    return titleValue(page2)
  })())

  await ctx.close()
}

// ─────────────────────────────────────────────────────────────────────────────
// D. A hand-typed step on a wizard that has never been used.
// ─────────────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices['iPhone 12'] })
  const page = await ctx.newPage()
  await page.goto(`${BASE}#/book-creator?step=review`)
  await page.waitForTimeout(500)
  record('typed ?step=review, no draft', 'nothing', 'concept', await visibleStep(page))

  // And Start fresh really does clear it.
  await page.locator('#wizard-title').fill('Discarded')
  await page.waitForTimeout(600)
  await page.reload()
  await page.waitForTimeout(500)
  record('draft written from step 1', 'concept', 'Discarded', await titleValue(page))
  await page.getByRole('button', { name: 'Start fresh' }).click()
  await page.waitForTimeout(300)
  record('Start fresh', 'concept', '', await titleValue(page))
  await page.reload()
  await page.waitForTimeout(500)
  record('  stays cleared after reload', 'concept', '', await titleValue(page))
  record('  no resume notice', 'concept', 'false', String(await page.getByText('Picked up where you left off.').isVisible()))

  await ctx.close()
}

await browser.close()

console.log('\n' + '='.repeat(72))
console.log(`${rows.length} checks · ${rows.length - failures} passed · ${failures} failed`)
console.log('='.repeat(72))
process.exit(failures === 0 ? 0 : 1)
