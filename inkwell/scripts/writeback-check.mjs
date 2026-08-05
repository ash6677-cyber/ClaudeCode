/**
 * Almanac round-trip acceptance (plan §6.8, §5.3): a card reaches the Almanac
 * and comes back, and a pull that would change nothing says so rather than
 * flashing a success it did not earn.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/writeback-check.mjs
 */
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
)
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5410/'
let failures = 0
const check = (n, e, a, note='') => { const ok = JSON.stringify(e)===JSON.stringify(a); if(!ok)failures++
  console.log(`${ok?'PASS':'FAIL'} · ${n} → ${JSON.stringify(a)}${ok?'':` — expected ${JSON.stringify(e)}`}${note?` · ${note}`:''}`) }
const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 960 } })).newPage()

await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(800)
await page.getByRole('button', { name: /New project|Create your first/i }).first().click()
await page.waitForTimeout(400)
await page.getByLabel('Title', { exact: true }).fill('Mira Vale')
await page.getByRole('button', { name: /^Create/ }).click()
await page.waitForTimeout(900)
await page.getByText('Mira Vale', { exact: true }).first().click()
await page.waitForTimeout(1000)
const pid = page.url().match(/project=([^&]+)/)?.[1]

// A card with nothing in the Almanac yet.
await page.goto(`${BASE}#/playground/cards?project=${pid}`)
await page.waitForTimeout(800)
await page.getByRole('button', { name: /New card/i }).first().click()
await page.waitForTimeout(400)
await page.getByLabel(/Name|Display name/i).first().fill('Elenya')
await page.getByRole('button', { name: /^(Create|Add|Save)/ }).first().click()
await page.waitForTimeout(900)
await page.getByText('Elenya').first().click()
await page.waitForTimeout(1000)

check('an unlinked card offers to create the entry', true, await page.getByRole('button', { name: /Add to Almanac/i }).isVisible())
await page.getByRole('button', { name: /Add to Almanac/i }).click()
await page.waitForTimeout(1400)
check('  and says it did', true, await page.getByText(/added to the Almanac/i).isVisible())
check('  the button becomes a pull, because it is linked now', true, await page.getByRole('button', { name: /Pull from Almanac/i }).isVisible())

// Pulling with nothing changed must not pretend it did something.
await page.getByRole('button', { name: /Pull from Almanac/i }).click()
await page.waitForTimeout(1200)
check('pulling an unchanged entry says so honestly', true, await page.getByText(/Already up to date/i).isVisible())

// Change the Almanac, then pull.
const entryId = await page.evaluate(async () => {
  const open = indexedDB.open('inkwell')
  const db = await new Promise((r) => { open.onsuccess = () => r(open.result) })
  const all = await new Promise((r) => { const q = db.transaction('codexEntries').objectStore('codexEntries').getAll(); q.onsuccess = () => r(q.result) })
  const entry = all.find((e) => e.name === 'Elenya')
  await new Promise((r) => { const tx = db.transaction('codexEntries','readwrite'); tx.objectStore('codexEntries').put({ ...entry, summary: 'A border guard.', plainText: 'Wary of strangers.' }); tx.oncomplete = r })
  db.close(); return entry?.id ?? null
})
check('the Almanac entry exists to be edited', true, Boolean(entryId))
await page.reload()
await page.waitForTimeout(1400)
await page.getByRole('button', { name: /Pull from Almanac/i }).click()
await page.waitForTimeout(1400)
check('pulling brings the new text across', true, await page.getByText(/Updated from Elenya/i).isVisible())
const description = await page.getByLabel(/Description/i).first().inputValue().catch(() => '')
check('  and the card shows it', 'A border guard.', description)

await browser.close()
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
