/**
 * Playground acceptance (plan §3): the four rooms, the old addresses that
 * still have to reach them, and a Chat button that means one thing.
 *
 * Run against a production build, on a phone-sized viewport, because two of
 * the criteria are about how many taps something takes and where back goes.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/playground-check.mjs
 */
const { chromium, devices } = await import(
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
const ctx = await browser.newContext({ ...devices['iPhone 12'] })
const page = await ctx.newPage()

/** The hash route, without the origin noise. */
const route = () => page.url().split('#')[1] ?? ''

// ── Setup: one book, one character ──────────────────────────────────────────
await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(700)
await page.getByRole('button', { name: /New project|Create your first/i }).first().click()
await page.waitForTimeout(400)
await page.getByLabel('Title', { exact: true }).fill('Mira Vale')
await page.getByRole('button', { name: /^Create/ }).click()
await page.waitForTimeout(900)
await page.getByText('Mira Vale', { exact: true }).first().click()
await page.waitForTimeout(1000)
const projectId = page.url().match(/project=([^&]+)/)?.[1] ?? null
check('a book is open', true, Boolean(projectId))

await page.goto(`${BASE}#/playground/cards?project=${projectId}`)
await page.waitForTimeout(800)
await page.getByRole('button', { name: /New card/i }).first().click()
await page.waitForTimeout(400)
await page.getByLabel(/Name|Display name/i).first().fill('Elenya')
await page.getByRole('button', { name: /^(Create|Add|Save)/ }).first().click()
await page.waitForTimeout(900)
check('a character exists', true, await page.getByText('Elenya').first().isVisible())

// ── The four rooms, and the tab row that reaches them ───────────────────────
for (const [slug, label] of [
  ['cards', 'Cards'],
  ['chats', 'Chats'],
  ['personas', 'Personas'],
  ['lorebooks', 'Lorebooks'],
]) {
  await page.goto(`${BASE}#/playground/${slug}?project=${projectId}`)
  await page.waitForTimeout(700)
  const tab = page.getByRole('link', { name: label })
  check(`${label} is a Playground room`, true, await tab.isVisible())
  check(`  ${label} tab is the current one`, true, (await page.title()).startsWith(label))
}

// One tap from any room to any other — the tab row is always on screen.
await page.goto(`${BASE}#/playground/lorebooks?project=${projectId}`)
await page.waitForTimeout(600)
await page.getByRole('link', { name: 'Chats' }).click()
await page.waitForTimeout(600)
check('one tap between rooms', `/playground/chats?project=${projectId}`, route())

// ── The old addresses ───────────────────────────────────────────────────────
await page.goto(`${BASE}#/playground/cards?project=${projectId}`)
await page.waitForTimeout(700)
await page.getByText('Elenya').first().click()
await page.waitForTimeout(900)
const cardId = route().match(/playground\/cards\/([^?]+)/)?.[1] ?? null
check('opening a character', true, Boolean(cardId))

for (const [from, expected] of [
  [`#/cards?project=${projectId}`, `/playground/cards?project=${projectId}`],
  [`#/cards/${cardId}?project=${projectId}`, `/playground/cards/${cardId}?project=${projectId}`],
  [`#/lorebooks?project=${projectId}`, `/playground/lorebooks?project=${projectId}`],
]) {
  await page.goto(`${BASE}${from}`)
  await page.waitForTimeout(800)
  check(`old ${from.split('?')[0]} lands right`, expected, route())
}

// ── The Chat button means one thing ─────────────────────────────────────────
await page.goto(`${BASE}#/playground/cards/${cardId}?project=${projectId}`)
await page.waitForTimeout(900)
await page.getByRole('button', { name: 'Chat' }).click()
await page.waitForTimeout(1400)
const chatId = route().match(/playground\/chats\/([^?]+)/)?.[1] ?? null
check('Chat opens a conversation', true, Boolean(chatId))

// Pressing it again resumes that same conversation rather than making a second.
await page.goto(`${BASE}#/playground/cards/${cardId}?project=${projectId}`)
await page.waitForTimeout(900)
await page.getByRole('button', { name: 'Chat' }).click()
await page.waitForTimeout(1400)
check('Chat resumes rather than duplicating', chatId, route().match(/chats\/([^?]+)/)?.[1] ?? null)

// The old chat URL has to resolve to a conversation too.
await page.goto(`${BASE}#/cards/${cardId}/chat?project=${projectId}`)
await page.waitForTimeout(1600)
check('old /cards/:id/chat resolves', chatId, route().match(/chats\/([^?]+)/)?.[1] ?? null)

// ── And that conversation now has a home ────────────────────────────────────
await page.goto(`${BASE}#/playground/chats?project=${projectId}`)
await page.waitForTimeout(900)
check('the conversation appears in Chats', true, await page.getByText('Elenya').first().isVisible())

// ── "Cards" is no longer a top-level destination ────────────────────────────
await page.goto(`${BASE}#/playground/cards?project=${projectId}`)
await page.waitForTimeout(700)
await page.getByRole('button', { name: /Open navigation|Menu/i }).first().click()
await page.waitForTimeout(500)
const navText = (await page.locator('[role="dialog"]').innerText()).split('\n').map((s) => s.trim())
check('the rail offers Playground', true, navText.includes('Playground'))
check('the rail no longer offers Cards', false, navText.includes('Cards'))

await browser.close()
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
