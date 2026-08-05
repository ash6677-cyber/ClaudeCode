/**
 * AI failure acceptance (plan §13.1–3), against a provider that fails on
 * purpose.
 *
 * A fake endpoint is served alongside the app and told which status to
 * return, so each branch of the taxonomy can be produced deliberately rather
 * than waited for: a rejected key, a rate limit with a Retry-After, and a
 * request that never connects at all.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/ai-failure-check.mjs
 */
import { createServer } from 'node:http'

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
)
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5410/'
const FAKE_PORT = Number(process.env.FAKE_PORT ?? 5411)

let failures = 0
const check = (name, expected, actual, note = '') => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual)
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'} · ${name} → ${JSON.stringify(actual)}` +
      `${ok ? '' : ` — expected ${JSON.stringify(expected)}`}${note ? ` · ${note}` : ''}`,
  )
}

// ── A provider that fails to order ──────────────────────────────────────────
let mode = 'ok'
const fake = createServer((req, res) => {
  // Retry-After is only readable from JavaScript on a cross-origin response
  // when the server says it may be. Real providers vary in whether they do,
  // which is exactly why the app treats the countdown as a bonus rather than
  // something to depend on — but to test the path at all, this one exposes it.
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Expose-Headers': 'Retry-After',
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    res.end()
    return
  }
  if (mode === 'auth') {
    res.writeHead(401, { ...cors, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'Incorrect API key provided.' } }))
    return
  }
  if (mode === 'rate') {
    res.writeHead(429, { ...cors, 'Content-Type': 'application/json', 'Retry-After': '15' })
    res.end(JSON.stringify({ error: { message: 'Rate limit reached for requests.' } }))
    return
  }
  res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }))
})
await new Promise((r) => fake.listen(FAKE_PORT, '127.0.0.1', r))

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 960 } })
const page = await ctx.newPage()

await page.goto(`${BASE}#/settings?tab=ai`)
await page.waitForTimeout(900)

async function openProviderForm() {
  await page.getByRole('button', { name: /Add provider|New provider|Connect an AI/i }).first().click()
  await page.waitForTimeout(500)
  const dialog = page.locator('[role="dialog"]')
  await dialog.locator('input[type="password"]').fill('sk-test')
  await page.waitForTimeout(200)
  // "Something else" is the one that takes an address, which is how the
  // stand-in service is reached.
  await dialog.getByRole('button', { name: /^Something else/ }).click()
  await page.waitForTimeout(300)
  await dialog.getByLabel(/^Address/i).fill(`http://127.0.0.1:${FAKE_PORT}/v1`)
  await dialog.getByLabel(/^Model$/i).fill('test-model')
}

await openProviderForm()
check('the key privacy note is stated, not implied', true, await page.getByText(/never sent anywhere but the service/i).isVisible())

// ── A key the provider rejects ──────────────────────────────────────────────
mode = 'auth'
await page.getByRole('button', { name: 'Check it works' }).click()
await page.waitForTimeout(1500)
check('a bad key fails at Test, not mid-chat', true, await page.getByText('Incorrect API key provided.').isVisible())
check('  with the auth-specific next step', true, await page.getByText(/Check the API key in Settings/i).isVisible())
check('  and no retry, because retrying cannot work', 0, await page.getByRole('button', { name: 'Try again' }).count())
check('  but a way to go and fix it', true, await page.getByRole('link', { name: 'Settings' }).isVisible())

// ── A rate limit, which is worth waiting out ────────────────────────────────
mode = 'rate'
await page.getByRole('button', { name: 'Check it works' }).click()
await page.waitForTimeout(1500)
check('a rate limit reads as a rate limit', true, await page.getByText('Rate limit reached for requests.').isVisible())
const countdown = await page.getByRole('button', { name: /^1[0-5]s$/ }).count()
check('  and counts down the wait the provider asked for', true, countdown > 0)

// ── Nothing listening at all ────────────────────────────────────────────────
await page.locator('[role="dialog"]').getByLabel(/^Address/i).fill('http://127.0.0.1:5999/v1')
await page.getByRole('button', { name: 'Check it works' }).click()
await page.waitForTimeout(2500)
check('an unreachable provider says so', true, await page.getByText(/Check your connection/i).isVisible())
check('  and offers a retry, because that one might work', true, await page.getByRole('button', { name: 'Try again' }).isVisible())

// ── A working provider ──────────────────────────────────────────────────────
mode = 'ok'
await page.locator('[role="dialog"]').getByLabel(/^Address/i).fill(`http://127.0.0.1:${FAKE_PORT}/v1`)
await page.getByRole('button', { name: 'Check it works' }).click()
await page.waitForTimeout(1500)
check('a good key says so plainly', true, await page.getByText(/Working — test-model answered/i).isVisible())

await browser.close()
fake.close()
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
