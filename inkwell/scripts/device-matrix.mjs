/**
 * The device matrix (plan §8.5): every route, at phone sizes, measured.
 *
 * Three things are checked on each screen, because each is a bug a writer
 * would hit and none of them is visible from a desktop window:
 *
 *  - horizontal overflow, which is the app being wider than the phone;
 *  - interactive elements below the 44px that a fingertip actually needs;
 *  - controls sitting inside the safe-area insets, where an installed PWA
 *    puts the home indicator and the notch on top of them.
 *
 * Reported rather than asserted by default. `--strict` turns the findings
 * into an exit code once a surface is meant to be clean.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/device-matrix.mjs [--strict] [--only=reader]
 */
const { chromium, devices } = await import(
  process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
)
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5410/'

const strict = process.argv.includes('--strict')
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]

/** The smallest phone still in real use, and a current one. */
const SIZES = [
  { name: '360×640', viewport: { width: 360, height: 640 } },
  { name: '390×844', viewport: { width: 390, height: 844 } },
]

/**
 * Insets an installed app actually gets on a notched phone, in CSS px.
 *
 * A headless browser has no notch, so these are pushed in through the same
 * variables the stylesheet reads. That is the whole reason `.pad-safe-*` goes
 * via variables rather than calling `env()` directly — otherwise the one
 * piece of layout that only exists on a real device could never be checked.
 */
const INSETS = { top: 47, right: 0, bottom: 34, left: 0 }

const MIN_TOUCH = 44

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] })

/**
 * Measures one screen.
 *
 * Runs in the page so it can read layout directly. Elements that are hidden,
 * zero-sized or inside a closed dialog are skipped — they are not something a
 * finger can miss.
 */
async function audit(page) {
  return page.evaluate(
    ({ MIN_TOUCH, INSETS }) => {
      const doc = document.documentElement
      const overflow = Math.max(0, doc.scrollWidth - doc.clientWidth)

      const interactive = [
        ...document.querySelectorAll(
          'button, a[href], [role="button"], [role="tab"], [role="option"], input:not([type="hidden"]), select, textarea, summary',
        ),
      ]

      const small = []
      const underInset = []
      for (const el of interactive) {
        const style = getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        // Off-screen entirely (a closed sheet, a virtualised row).
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue

        const label =
          el.getAttribute('aria-label') ||
          el.textContent?.trim().slice(0, 28) ||
          el.getAttribute('placeholder') ||
          el.tagName.toLowerCase()

        // A control marked `touch-target` carries an invisible 44px hit box,
        // so the finger gets what it needs even though the paint is smaller.
        const expanded = el.classList.contains('touch-target')
        const hitW = expanded ? Math.max(r.width, MIN_TOUCH) : r.width
        const hitH = expanded ? Math.max(r.height, MIN_TOUCH) : r.height
        // Half a pixel of slack: fractional layout routinely lands on 43.99,
        // and calling that a defect is noise rather than a finding.
        if (hitW < MIN_TOUCH - 0.5 || hitH < MIN_TOUCH - 0.5) {
          small.push({ label, w: Math.round(r.width), h: Math.round(r.height) })
        }
        // Only chrome pinned to an edge can collide with an inset; something
        // in a scrolling middle can always be scrolled clear.
        const pinned = style.position === 'fixed' || style.position === 'sticky'
        const inChrome = el.closest('[data-edge-chrome]') !== null
        if (pinned || inChrome) {
          if (r.top < INSETS.top) underInset.push({ label, edge: 'top', px: Math.round(r.top) })
          if (innerHeight - r.bottom < INSETS.bottom) {
            underInset.push({ label, edge: 'bottom', px: Math.round(innerHeight - r.bottom) })
          }
        }
      }
      return { overflow, small, underInset, interactive: interactive.length }
    },
    { MIN_TOUCH, INSETS },
  )
}

const findings = []

for (const size of SIZES) {
  const ctx = await browser.newContext({
    ...devices['iPhone 12'],
    viewport: size.viewport,
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()

  // Pretend to be an installed app on a notched phone for the whole run.
  await page.addInitScript((insets) => {
    addEventListener('DOMContentLoaded', () => {
      const r = document.documentElement.style
      r.setProperty('--safe-top', `${insets.top}px`)
      r.setProperty('--safe-bottom', `${insets.bottom}px`)
      r.setProperty('--safe-left', `${insets.left}px`)
      r.setProperty('--safe-right', `${insets.right}px`)
    })
  }, INSETS)

  // One book with a little of everything, so screens are not empty states.
  await page.goto(`${BASE}#/projects`)
  await page.waitForTimeout(900)
  const projectId = await page.evaluate(async () => {
    const open = indexedDB.open('inkwell')
    const db = await new Promise((r) => {
      open.onsuccess = () => r(open.result)
    })
    const now = Date.now()
    const id = (p) => `${p}-${Math.random().toString(36).slice(2, 10)}`
    const put = (store, value) =>
      new Promise((res) => {
        const tx = db.transaction(store, 'readwrite')
        tx.objectStore(store).put(value)
        tx.oncomplete = res
      })
    const pid = id('p')
    await put('projects', {
      id: pid, createdAt: now, updatedAt: now, title: 'The Salt Road', author: 'A. Richards',
      synopsis: '', genre: '', targetWordCount: 80000, coverId: null, seriesId: null,
      seriesOrder: 0, status: 'drafting',
      settings: { defaultAiPresetId: null, pov: 'third-limited', tense: 'past', measureWidthCh: 68, structureMode: 'scenes' },
    })
    for (let c = 0; c < 3; c++) {
      const cid = id('ch')
      await put('chapters', { id: cid, createdAt: now, updatedAt: now, projectId: pid, title: `Chapter ${c + 1}`, order: c, status: 'draft' })
      await put('scenes', {
        id: id('sc'), createdAt: now, updatedAt: now, chapterId: cid, projectId: pid,
        title: 'Scene 1', order: 0, content: null,
        plainText: 'The caravan came down out of the hills at dusk, and the salt on the wind tasted of somewhere else entirely. '.repeat(12),
        wordCount: 240, status: 'draft', povCharacterId: null, locationCodexId: null,
        summary: 'They arrive.', beats: [], labels: [], linkedCodexIds: [],
      })
    }
    await put('codexEntries', {
      id: id('e'), createdAt: now, updatedAt: now, projectId: pid, seriesId: null, type: 'character',
      name: 'Mira', aliases: [], summary: 'A salt trader.', body: null, plainText: 'Blunt.',
      attributes: [], relationships: [], imageId: null, tags: ['cast'],
      aiContext: 'when-relevant', aiContextTokenBudget: null,
    })
    await put('characterCards', {
      id: id('c'), createdAt: now, updatedAt: now, projectId: pid, codexEntryId: null,
      displayName: 'Mira', avatarImageId: null, cropSettings: null, description: 'A salt trader.',
      personality: 'Blunt.', scenario: '', firstMessage: 'You again.', exampleDialogue: [],
      systemPromptOverride: null, voiceNotes: '', tags: ['cast'],
    })
    db.close()
    return pid
  })
  await page.reload()
  await page.waitForTimeout(1000)

  const routes = [
    ['Projects', '#/projects'],
    ['Book Creator', '#/book-creator'],
    ['Editor', `#/editor?project=${projectId}`],
    ['Read', `#/read?project=${projectId}`],
    ['Almanac', `#/almanac?project=${projectId}`],
    ['Playground · Cards', `#/playground/cards?project=${projectId}`],
    ['Playground · Chats', `#/playground/chats?project=${projectId}`],
    ['Playground · Personas', `#/playground/personas?project=${projectId}`],
    ['Playground · Lorebooks', `#/playground/lorebooks?project=${projectId}`],
    ['Planning', `#/planning?project=${projectId}`],
    ['Cover Studio', `#/covers?project=${projectId}`],
    ['Series', '#/series'],
    ['Stats', `#/stats?project=${projectId}`],
    ['Settings', '#/settings'],
  ].filter(([name]) => !only || name.toLowerCase().includes(only.toLowerCase()))

  for (const [name, hash] of routes) {
    await page.goto(`${BASE}${hash}`)
    await page.waitForTimeout(1100)
    const result = await audit(page)
    findings.push({ size: size.name, route: name, ...result })
  }

  await ctx.close()
}

// ── Report ──────────────────────────────────────────────────────────────────
let problems = 0
for (const f of findings) {
  const issues = []
  if (f.overflow > 0) issues.push(`overflows by ${f.overflow}px`)
  if (f.small.length) issues.push(`${f.small.length} under ${MIN_TOUCH}px`)
  if (f.underInset.length) issues.push(`${f.underInset.length} under a safe-area inset`)
  if (issues.length === 0) {
    console.log(`ok   ${f.size}  ${f.route}`)
    continue
  }
  problems += 1
  console.log(`FAIL ${f.size}  ${f.route} — ${issues.join(' · ')}`)
  for (const s of f.small.slice(0, 6)) console.log(`        small: ${s.label} (${s.w}×${s.h})`)
  if (f.small.length > 6) console.log(`        …and ${f.small.length - 6} more`)
  for (const u of f.underInset.slice(0, 4)) console.log(`        inset: ${u.label} — ${u.edge} at ${u.px}px`)
}

console.log(`\n${findings.length} screens · ${findings.length - problems} clean · ${problems} with findings`)
await browser.close()
process.exit(strict && problems > 0 ? 1 : 0)
