/**
 * Focus mode acceptance, through the real UI.
 *
 * Focus mode's promise is subtractive — take the chrome away and leave the
 * writer alone — which makes its bugs the invisible kind: an exit key that
 * doesn't exist, a save failure nobody sees, a caret left stranded on the
 * button that was just clicked. Each check here is one of those, phrased as
 * the writer would meet it.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/focus-mode-check.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(String(e)))

await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(1200)

// ── A project with one chapter and one long scene ───────────────────────────
const { projectId } = await page.evaluate(async () => {
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

  const projectId = id('p')
  await put('projects', {
    id: projectId,
    createdAt: now,
    updatedAt: now,
    title: 'The Long Watch',
    author: '',
    synopsis: '',
    genre: '',
    targetWordCount: 80000,
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
  const chapterId = id('c')
  await put('chapters', {
    id: chapterId,
    createdAt: now,
    updatedAt: now,
    projectId,
    title: 'Chapter 1',
    order: 0,
    status: 'drafting',
  })
  const paragraphs = Array.from({ length: 18 }, (_, i) => ({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: `Paragraph ${i + 1}. The lamps burned low over the harbour and nobody on the night shift said a word about the ship that had not come in.`,
      },
    ],
  }))
  await put('scenes', {
    id: id('s'),
    createdAt: now,
    updatedAt: now,
    projectId,
    chapterId,
    title: 'Scene 1',
    order: 0,
    content: { type: 'doc', content: paragraphs },
    plainText: paragraphs.map((p) => p.content[0].text).join('\n'),
    wordCount: 18 * 24,
    status: 'drafting',
    povCharacterId: null,
    locationCodexId: null,
    summary: '',
    beats: [],
    labels: [],
    linkedCodexIds: [],
  })
  db.close()
  return { projectId }
})

await page.goto(`${BASE}#/editor?project=${projectId}`)
await page.waitForTimeout(1500)

const pill = page.locator('div.fixed', { hasText: /words/ })
const navRail = page.getByRole('link', { name: 'Projects' })

// ── Entering ─────────────────────────────────────────────────────────────────
await page.getByRole('button', { name: 'Enter focus mode' }).click()
await page.waitForTimeout(400)

check('the nav rail is gone', 0, await navRail.count())
check('the pill is there', 1, await pill.count())
check(
  'the caret went back to the prose, not the button',
  true,
  await page.evaluate(() => document.activeElement?.closest('.editor-prose') !== null),
  'entering focus mode is a promise to let the writer type immediately',
)

// The HUD is there on entry, gone once the hands stay on the keys, and back
// the moment the hand reaches for the mouse. When gone it must also stop
// catching the pointer — nothing invisible may sit over the prose.
const entryOpacity = await pill.evaluate((el) => getComputedStyle(el).opacity)
await page.waitForTimeout(3200)
const idle = await pill.evaluate((el) => ({
  opacity: getComputedStyle(el).opacity,
  pointerEvents: getComputedStyle(el).pointerEvents,
}))
check(
  'the HUD shows on entry and vanishes once the hands stay on the keys',
  true,
  Number(entryOpacity) === 1 && Number(idle.opacity) === 0 && idle.pointerEvents === 'none',
  `entry ${entryOpacity}, idle ${idle.opacity}/${idle.pointerEvents}`,
)
await page.mouse.move(700, 450)
await page.waitForTimeout(350)
const wokenOpacity = await pill.evaluate((el) => getComputedStyle(el).opacity)
check('…and returns the moment the mouse moves', '1', wokenOpacity)

// ── Dim other paragraphs ─────────────────────────────────────────────────────
await page.getByRole('button', { name: 'Focus mode settings' }).click()
await page.getByRole('menuitemcheckbox', { name: 'Dim other paragraphs' }).click()
await page.waitForTimeout(300)
// Radix leaves focus on the trigger; click into the prose to give dimming a
// selection to dim around.
await page.locator('.editor-prose p').nth(3).click()
await page.waitForTimeout(300)

const dimCounts = await page.evaluate(() => {
  const all = document.querySelectorAll('.editor-prose > *').length
  const dimmed = document.querySelectorAll('.editor-prose .pm-dimmed').length
  return { all, dimmed }
})
check(
  'every paragraph but the active one is dimmed',
  dimCounts.all - 1,
  dimCounts.dimmed,
  `${dimCounts.all} blocks`,
)

// ── Typewriter scrolling ─────────────────────────────────────────────────────
await page.getByRole('button', { name: 'Focus mode settings' }).click()
await page.getByRole('menuitemcheckbox', { name: 'Typewriter scrolling' }).click()
await page.waitForTimeout(600)

// Type at the very end of the scene, where an unscrolled caret would sit at
// the bottom edge; typewriter mode owes it a place near 40% of the viewport.
await page.locator('.editor-prose p').nth(17).click()
await page.keyboard.press('Control+End')
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('Enter')
  await page.keyboard.type('The watch changed at four bells and still no sail.')
}
await page.waitForTimeout(400)

const caret = await page.evaluate(() => {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const rect = sel.getRangeAt(0).getBoundingClientRect()
  const container = document.querySelector('.editor-prose')?.closest('.overflow-y-auto')
  const c = container?.getBoundingClientRect()
  return c ? { caretY: rect.top, target: c.top + c.height * 0.4 } : null
})
check(
  'typing at the end keeps the caret pinned near 40% of the view',
  true,
  caret !== null && Math.abs(caret.caretY - caret.target) < 60,
  caret ? `caret ${Math.round(caret.caretY)} vs target ${Math.round(caret.target)}` : 'no caret',
)

// ── Escape, in layers ────────────────────────────────────────────────────────
// With the find bar open, Escape closes the find bar and stays in focus mode.
await page.keyboard.press('Control+f')
await page.waitForTimeout(300)
check('Ctrl+F works inside focus mode', 1, await page.getByPlaceholder('Find in scene').count())
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
check('first Escape closes find, not focus mode', 1, await pill.count())
check('…and the find bar really closed', 0, await page.getByPlaceholder('Find in scene').count())

// A second Escape exits focus mode itself.
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
check('second Escape leaves focus mode', 0, await pill.count())
check('the chrome came back', 1, await navRail.count())

// Ctrl+. re-enters.
await page.keyboard.press('Control+.')
await page.waitForTimeout(400)
check('Ctrl+. re-enters focus mode', 1, await pill.count())

// ── The pill tells the truth about saving ───────────────────────────────────
// The typing above autosaved (800ms debounce); the pill should say so, and
// should be carrying a "+N today" earned by those words.
await page.waitForTimeout(1500)
const pillText = await pill.textContent()
check('the pill reports the save, with a time', true, /Saved · \d/.test(pillText ?? ''), pillText ?? '')
check('the pill counts today’s words', true, /\+\d+ today/.test(pillText ?? ''), pillText ?? '')

await page.screenshot({
  path: `${process.env.OUT_DIR ?? '/tmp/claude-0/-home-user-ClaudeCode/086fa834-67d3-546c-9893-29c222c1aab7/scratchpad'}/focus-mode.png`,
})

check('no uncaught errors along the way', [], consoleErrors)

await browser.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
