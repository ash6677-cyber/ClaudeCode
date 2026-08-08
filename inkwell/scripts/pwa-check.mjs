/**
 * The phone-install story, proven end to end.
 *
 * Everything here has existed for a while — manifest, icons, service
 * worker, persistence requests — and none of it had ever been machine-
 * checked. Offline support is exactly the kind of code that breaks without
 * anyone noticing, because nobody develops with the network off. This
 * harness is the writer on a train: install-grade metadata present, the
 * worker in control, and the app — with their words in it — opening with
 * no connection at all.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/pwa-check.mjs
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
const page = await ctx.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(String(e)))

// ── Install-grade metadata ──────────────────────────────────────────────────
await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(1000)

const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
check('the page declares a manifest', true, Boolean(manifestHref))

const manifest = await page.evaluate(async (href) => {
  const res = await fetch(href)
  return res.ok ? res.json() : null
}, manifestHref)
check('the manifest parses', true, manifest !== null)
check('it opens standalone, like an app', 'standalone', manifest?.display)
check(
  'it carries a maskable icon (Android home screens crop)',
  true,
  (manifest?.icons ?? []).some((i) => i.purpose === 'maskable'),
)
const iconStatuses = await page.evaluate(async (icons) => {
  const out = []
  for (const icon of icons) out.push((await fetch(icon.src)).status)
  return out
}, manifest?.icons ?? [])
check('every declared icon actually exists', true, iconStatuses.every((s) => s === 200), `${iconStatuses}`)
check(
  'the install sheet gets screenshots, wide and narrow',
  [true, true],
  ['wide', 'narrow'].map((ff) => (manifest?.screenshots ?? []).some((s) => s.form_factor === ff)),
)
const shotStatuses = await page.evaluate(async (shots) => {
  const out = []
  for (const s of shots) out.push((await fetch(s.src)).status)
  return out
}, manifest?.screenshots ?? [])
check('…and the screenshots exist too', true, shotStatuses.length > 0 && shotStatuses.every((s) => s === 200), `${shotStatuses}`)

// ── The worker takes control ────────────────────────────────────────────────
const swState = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return { supported: false }
  const reg = await navigator.serviceWorker.ready
  // Control arrives on the *next* load after first registration.
  return { supported: true, scope: reg.scope, controlled: navigator.serviceWorker.controller !== null }
})
check('the service worker reaches ready', true, swState.supported && Boolean(swState.scope))

await page.reload()
await page.waitForTimeout(1200)
const controlled = await page.evaluate(() => navigator.serviceWorker.controller !== null)
check('after one reload, the worker controls the page', true, controlled)

// ── Words go in while online ────────────────────────────────────────────────
await page.evaluate(async () => {
  const open = indexedDB.open('inkwell')
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result)
    open.onerror = () => rej(open.error)
  })
  const now = Date.now()
  await new Promise((res, rej) => {
    const tx = db.transaction('projects', 'readwrite')
    tx.objectStore('projects').put({
      id: 'p-offline-proof',
      createdAt: now,
      updatedAt: now,
      title: 'Written Before The Tunnel',
      author: '',
      synopsis: '',
      genre: '',
      targetWordCount: 1000,
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
    tx.oncomplete = res
    tx.onerror = () => rej(tx.error)
  })
  db.close()
})
// One more online load, so every asset the shell needs has passed through
// the worker's cache at least once.
await page.reload()
await page.waitForTimeout(1500)

// ── The tunnel ──────────────────────────────────────────────────────────────
await ctx.setOffline(true)
await page.reload()
await page.waitForTimeout(2500)

const offline = await page.evaluate(() => ({
  booted: document.querySelector('#root')?.children.length > 0,
  title: document.title,
}))
check('with no connection at all, the app still opens', true, offline.booted, offline.title)
check(
  'and the book written before the tunnel is on the shelf',
  1,
  await page.getByText('Written Before The Tunnel').count(),
)

// Still fully usable: navigation works offline too.
await page.getByText('Written Before The Tunnel').click()
await page.waitForTimeout(1500)
check(
  'opening the book offline reaches the editor',
  true,
  (await page.getByText(/Start your manuscript|No scene selected/).count()) > 0,
)

await ctx.setOffline(false)
check('no uncaught errors along the way', [], consoleErrors)

await browser.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
