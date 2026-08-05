/**
 * Data safety acceptance (plan §21.1, §21.2, §21.4).
 *
 * Two of these are hard to believe without seeing: that scene history is
 * thinned to a policy rather than growing forever, and that a library with a
 * deliberately broken record says so. Both are driven through the real app
 * against a real IndexedDB, seeded with histories months deep.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/data-safety-check.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
const page = await ctx.newPage()

await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(900)

/** A book with one scene, a year of history, and one deliberate orphan. */
const seeded = await page.evaluate(async () => {
  const open = indexedDB.open('inkwell')
  const db = await new Promise((r) => {
    open.onsuccess = () => r(open.result)
  })
  const DAY = 24 * 60 * 60 * 1000
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
    id: pid, createdAt: now, updatedAt: now, title: 'The Salt Road', author: '',
    synopsis: '', genre: '', targetWordCount: 80000, coverId: null, seriesId: null,
    seriesOrder: 0, status: 'drafting',
    settings: { defaultAiPresetId: null, pov: 'third-limited', tense: 'past', measureWidthCh: 68, structureMode: 'scenes' },
  })
  const cid = id('ch')
  await put('chapters', { id: cid, createdAt: now, updatedAt: now, projectId: pid, title: 'Chapter 1', order: 0, status: 'draft' })
  const sid = id('sc')
  await put('scenes', {
    id: sid, createdAt: now, updatedAt: now, chapterId: cid, projectId: pid,
    title: 'Scene 1', order: 0, content: null, plainText: 'Words.', wordCount: 1,
    status: 'draft', povCharacterId: null, locationCodexId: null, summary: '',
    beats: [], labels: [], linkedCodexIds: [],
  })

  // Four a day for a year. Nobody would keep this, which is the point.
  let total = 0
  for (let day = 0; day < 365; day++) {
    for (let n = 0; n < 4; n++) {
      const at = now - day * DAY - n * 60 * 60 * 1000
      await put('snapshots', {
        id: id('sn'), createdAt: at, updatedAt: at, sceneId: sid,
        content: null, plainText: `Version ${day}.${n}`, wordCount: 2, label: 'Autosave',
      })
      total++
    }
  }
  // One saved from a sync conflict, a year deep, which must survive anyway.
  const conflictAt = now - 300 * DAY
  await put('snapshots', {
    id: 'conflict-keeper', createdAt: conflictAt, updatedAt: conflictAt, sceneId: sid,
    content: null, plainText: 'Nearly lost.', wordCount: 2,
    label: 'Conflicting edit from another device · 1 Jan, 09:00',
  })
  // An orphan: a card pointing at an Almanac entry that does not exist.
  await put('characterCards', {
    id: id('c'), createdAt: now, updatedAt: now, projectId: pid,
    codexEntryId: 'entry-that-never-existed', displayName: 'Mira',
    avatarImageId: null, cropSettings: null, description: '', personality: '',
    scenario: '', firstMessage: '', exampleDialogue: [], systemPromptOverride: null,
    voiceNotes: '', tags: [],
  })

  db.close()
  return { total: total + 1 }
})
check('seeded a year of history', 1461, seeded.total)

const countSnapshots = () =>
  page.evaluate(async () => {
    const open = indexedDB.open('inkwell')
    const db = await new Promise((r) => {
      open.onsuccess = () => r(open.result)
    })
    const all = await new Promise((r) => {
      const q = db.transaction('snapshots').objectStore('snapshots').getAll()
      q.onsuccess = () => r(q.result)
    })
    db.close()
    return { total: all.length, keptConflict: all.some((s) => s.id === 'conflict-keeper') }
  })

// ── The sweep runs at boot ──────────────────────────────────────────────────
await page.reload()
await page.waitForTimeout(3000)
const after = await countSnapshots()
check('history is thinned, not left to grow', true, after.total < 200, `${seeded.total} → ${after.total}`)
check('  but not emptied', true, after.total > 50, `${after.total} kept`)
check('  and the conflict copy survives a year', true, after.keptConflict)

// Running again changes nothing — the policy is a fixed point, not a drip.
await page.reload()
await page.waitForTimeout(3000)
const twice = await countSnapshots()
check('sweeping twice removes nothing new', after.total, twice.total)

// ── The library check finds the orphan and says which ───────────────────────
await page.goto(`${BASE}#/settings?tab=data`)
await page.waitForTimeout(1200)
await page.getByRole('button', { name: /Run check/i }).click()
await page.waitForTimeout(2000)
check('the check names the broken link', true, await page.getByText(/Almanac entry that is gone/i).isVisible())
check('  and names the record, not just a number', true, await page.getByText(/Mira/).first().isVisible())
check('  and reports the counts', true, await page.getByText(/Saved versions/i).isVisible())

await browser.close()
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
