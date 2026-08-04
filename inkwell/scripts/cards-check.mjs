/**
 * Cards subsection acceptance (plan §4.1, §4.3): the grid toolbar narrows a
 * cast live, and a design preset restyles a card in one tap — identically on
 * the detail page and in the grid.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/cards-check.mjs
 */
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
)
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5410/'
let failures = 0
const check = (n, e, a, note = '') => {
  const ok = JSON.stringify(e) === JSON.stringify(a)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${n} → ${JSON.stringify(a)}${ok ? '' : ` — expected ${JSON.stringify(e)}`}${note ? ` · ${note}` : ''}`)
}
const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(700)
await page.getByRole('button', { name: /New project|Create your first/i }).first().click()
await page.waitForTimeout(400)
await page.getByLabel('Title', { exact: true }).fill('Mira Vale')
await page.getByRole('button', { name: /^Create/ }).click()
await page.waitForTimeout(900)
await page.getByText('Mira Vale', { exact: true }).first().click()
await page.waitForTimeout(1000)
const pid = page.url().match(/project=([^&]+)/)?.[1]

// Three characters, one of them tagged.
await page.goto(`${BASE}#/playground/cards?project=${pid}`)
await page.waitForTimeout(800)
for (const name of ['Mira', 'Elenya', 'Tomas']) {
  await page.getByRole('button', { name: /New card/i }).first().click()
  await page.waitForTimeout(350)
  await page.getByLabel(/Name|Display name/i).first().fill(name)
  await page.getByRole('button', { name: /^(Create|Add|Save)/ }).first().click()
  await page.waitForTimeout(700)
}
const tiles = () => page.locator('.card-face').count()
check('three characters in the grid', 3, await tiles())

// Filter narrows live.
await page.getByLabel('Find a character').fill('mir')
await page.waitForTimeout(400)
check('typing narrows the grid', 1, await tiles())
check('  the count is shown', true, await page.getByText('1 of 3').isVisible())
await page.getByLabel('Find a character').fill('zzz')
await page.waitForTimeout(400)
check('no matches says so', true, await page.getByText('Nobody matches').isVisible())
await page.getByRole('button', { name: 'Clear filters' }).click()
await page.waitForTimeout(400)
check('clearing restores everyone', 3, await tiles())

// Sort by name.
await page.getByRole('button', { name: 'Name' }).first().click()
await page.waitForTimeout(400)
const order = await page.locator('.card-face').evaluateAll((els) =>
  els.map((e) => e.textContent?.trim().split('\n')[0] ?? ''),
)
check('sorted by name', true, order[0].startsWith('Elenya'), order.join(' | '))

// A preset restyles in one tap, and the grid agrees.
await page.getByText('Mira', { exact: true }).first().click()
await page.waitForTimeout(900)
await page.getByRole('button', { name: 'Prism' }).click()
await page.waitForTimeout(700)
const detailClasses = await page.locator('.card-face').first().getAttribute('class')
check('preset applied on the detail page', true, /card-frame-shard/.test(detailClasses) && /card-finish-holo/.test(detailClasses), detailClasses)
await page.goto(`${BASE}#/playground/cards?project=${pid}`)
await page.waitForTimeout(900)
const gridClasses = await page.locator('.card-face').first().getAttribute('class')
check('the grid shows the same card', true, /card-frame-shard/.test(gridClasses) && /card-finish-holo/.test(gridClasses), gridClasses)

await browser.close()
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
