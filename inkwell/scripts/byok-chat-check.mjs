/**
 * Bring-your-own-key and character memory, end to end (real UI, real database,
 * fake AI service).
 *
 * The question this answers is the only one that matters for either feature:
 * a writer pastes a key, opens a character, and asks them something — does a
 * reply come back, and does the character know what happened to them in the
 * book?
 *
 * A local stand-in for the AI service plays the part of OpenRouter. It does
 * not pretend to be clever; it records exactly what it was sent and answers
 * with a fixed line. That makes the interesting assertion possible: not "did
 * the model mention the heart attack", which would be a test of somebody
 * else's model, but "was the heart attack in what we sent it", which is the
 * part this app is responsible for.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/byok-chat-check.mjs
 */
import { createServer } from 'node:http'

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
)
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5410/'
const FAKE_PORT = Number(process.env.FAKE_AI_PORT ?? 5411)

let failures = 0
const check = (name, expected, actual, note = '') => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual)
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'} · ${name} → ${JSON.stringify(actual)}` +
      `${ok ? '' : ` — expected ${JSON.stringify(expected)}`}${note ? ` · ${note}` : ''}`,
  )
}

// ── A stand-in for the AI service ────────────────────────────────────────────
const seen = []
const REPLY = 'I am still here, and I remember.'

const fake = createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    res.end()
    return
  }
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    let parsed = null
    try {
      parsed = JSON.parse(body || '{}')
    } catch {
      parsed = null
    }
    seen.push({ url: req.url, authorization: req.headers.authorization ?? '', body: parsed })

    // Streamed the way an OpenAI-compatible service does, because that is the
    // path the app actually takes when a writer sends a message.
    if (parsed?.stream) {
      res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream' })
      for (const word of REPLY.split(' ')) {
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: `${word} ` } }] })}\n\n`,
        )
      }
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        id: 'fake',
        choices: [{ message: { role: 'assistant', content: REPLY }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
    )
  })
})
await new Promise((resolve) => fake.listen(FAKE_PORT, '127.0.0.1', resolve))
const FAKE_URL = `http://127.0.0.1:${FAKE_PORT}/v1`

const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(String(e)))

await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(1200)

// ── A book with something having happened in it ──────────────────────────────
const { projectId, cardId, chatId } = await page.evaluate(async () => {
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
    title: 'The Salt Road',
    author: 'A Writer',
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

  const chapterId = id('ch')
  await put('chapters', {
    id: chapterId,
    createdAt: now,
    updatedAt: now,
    projectId,
    title: 'Chapter One',
    order: 0,
    status: 'drafting',
    kind: 'chapter',
  })

  const scene = (order, title, plainText) =>
    put('scenes', {
      id: id('sc'),
      createdAt: now,
      updatedAt: now,
      chapterId,
      projectId,
      title,
      order,
      content: null,
      plainText,
      wordCount: plainText.split(/\s+/).length,
      status: 'drafting',
      povCharacterId: null,
      locationCodexId: null,
      summary: '',
      beats: [],
      labels: [],
      linkedCodexIds: [],
    })

  // The two events the character is expected to know about, and one that has
  // nothing to do with her, so "knows the book" does not just mean "was sent
  // the whole book".
  await scene(0, 'The market', 'Rain all morning. Mira called Charlotte a bitch in front of the whole market. Charlotte did not answer her.')
  await scene(1, 'The inn', 'Tomas locked the inn at midnight and counted the till twice.')
  await scene(2, 'The hill', 'Charlotte carried the water up the hill alone. Her hands would not stop shaking.')

  const codexEntryId = id('e')
  await put('codexEntries', {
    id: codexEntryId,
    createdAt: now,
    updatedAt: now,
    projectId,
    seriesId: null,
    type: 'character',
    name: 'Charlotte',
    aliases: ['Lottie'],
    summary: 'A salt trader.',
    body: null,
    plainText: '',
    attributes: [],
    relationships: [],
    imageId: null,
    tags: [],
    aiContext: 'when-relevant',
    aiContextTokenBudget: null,
  })

  const cardId = id('c')
  await put('characterCards', {
    id: cardId,
    createdAt: now,
    updatedAt: now,
    projectId,
    codexEntryId,
    displayName: 'Charlotte',
    avatarImageId: null,
    cropSettings: null,
    design: { frame: 'plain', finish: 'matte', accent: null, gloss: 0.2, vignette: 0.2 },
    description: 'A salt trader on the coast road, thirty-two, tired.',
    personality: 'Guarded. Says less than she means.',
    scenario: 'The caravan has halted for the night.',
    firstMessage: 'You again.',
    exampleDialogue: [],
    systemPromptOverride: null,
    voiceNotes: 'clipped',
    tags: [],
  })

  // A conversation already open, so the composer is on screen from the start.
  const chatId = id('chat')
  await put('cardChats', {
    id: chatId,
    createdAt: now,
    updatedAt: now,
    cardId,
    projectId,
    mode: 'roleplay',
    title: 'Chat 1',
    personaId: null,
    aiPresetId: null,
    messages: [],
  })

  db.close()
  return { projectId, cardId, chatId }
})

check('a book with three scenes was set up', true, Boolean(projectId && cardId))

// ── Before any key: the chat says so, and offers the fix where you are ───────
await page.goto(`${BASE}#/playground/chats/${chatId}?project=${projectId}`)
await page.waitForTimeout(1800)

check(
  'with no key, the chat says so in words rather than failing silently',
  true,
  await page.getByText(/No AI connected/).isVisible(),
)
check(
  'and offers to fix it right there, not on some other page',
  true,
  await page.getByRole('button', { name: /Connect an AI/ }).isVisible(),
)

// ── Pasting a key ────────────────────────────────────────────────────────────
await page.getByRole('button', { name: /Connect an AI/ }).click()
await page.waitForTimeout(600)

const dialog = page.locator('[role="dialog"]')
await dialog.locator('input[type="password"]').fill('sk-or-v1-pretend-key')
await page.waitForTimeout(500)
check(
  'a pasted key names its own service — nobody has to be asked',
  'true',
  await dialog.getByRole('button', { name: /^OpenRouter/ }).getAttribute('aria-pressed'),
  'the key begins sk-or-v1-, which only OpenRouter issues',
)
check(
  'and it offers a link to where keys come from',
  true,
  await dialog.getByRole('link', { name: /Get a key/ }).isVisible(),
)

// Point it at the stand-in service instead of the real one.
await dialog.getByRole('button', { name: /Advanced/ }).click()
await page.waitForTimeout(300)
await dialog.locator('input#\\:r0\\:-base-url, input[placeholder*="usual one"]').first().fill(FAKE_URL)
await page.waitForTimeout(300)

await dialog.getByRole('button', { name: /Check it works/ }).click()
await page.waitForTimeout(1500)
check(
  'the key can be checked before it is trusted with anything',
  true,
  await dialog.getByText(/Working —/).isVisible(),
)

await dialog.getByRole('button', { name: /^Connect$/ }).click()
await page.waitForTimeout(1500)

check(
  'the warning is gone the moment a key is connected',
  false,
  await page
    .getByText(/No AI connected/)
    .isVisible()
    .catch(() => false),
  'the shipped presets point at no provider, so this used to stay broken after adding a key',
)

// ── Asking the character something ───────────────────────────────────────────
seen.length = 0
const composer = page.locator('textarea').last()
await composer.fill('How are you holding up?')
await page.getByRole('button', { name: 'Send message' }).click()
await page.waitForTimeout(3000)

check('a reply came back', true, (await page.getByText(REPLY.trim()).count()) > 0)

const sent = seen.find((r) => r.body?.messages)
check('the request actually went to the service', true, Boolean(sent))
check(
  'and carried the key, so the writer is paying their own bill',
  true,
  sent?.authorization?.includes('sk-or-v1-pretend-key') ?? false,
)

const system = sent?.body?.messages?.find((m) => m.role === 'system')?.content ?? ''

// ── What the character was told ──────────────────────────────────────────────
check(
  'the character was told what happened to her in the book',
  true,
  system.includes('called Charlotte a bitch'),
  'the scene the author wrote, in the author’s own words',
)
check(
  'including the most recent thing, not only the first',
  true,
  system.includes('carried the water up the hill'),
)
check(
  'and not scenes she is not in',
  false,
  system.includes('Tomas locked the inn'),
  'sending the whole book would make this pass for the wrong reason',
)
check(
  'the passages are framed as her memories, not as reference material',
  true,
  /your memories/i.test(system),
)
check(
  'she is told to be useful to the person writing her',
  true,
  /Be genuinely useful/.test(system) && /writing the book you are in/.test(system),
)
check(
  'and to say so when she is asked about something that has not happened',
  true,
  /Do not know what you could not know/.test(system),
)
check('her own card is still in there', true, system.includes('A salt trader on the coast road'))

// ── The key reaches the rest of the app too ──────────────────────────────────
await page.goto(`${BASE}#/settings`)
await page.waitForTimeout(1200)
const aiTab = page.getByRole('tab', { name: /AI/ }).first()
if (await aiTab.isVisible().catch(() => false)) {
  await aiTab.click()
  await page.waitForTimeout(800)
}
const presetProviders = await page.evaluate(async () => {
  const open = indexedDB.open('inkwell')
  const db = await new Promise((res) => {
    open.onsuccess = () => res(open.result)
  })
  const all = await new Promise((res) => {
    const req = db.transaction('aiPresets').objectStore('aiPresets').getAll()
    req.onsuccess = () => res(req.result)
  })
  db.close()
  return all.filter((p) => typeof p.deletedAt !== 'number').map((p) => Boolean(p.providerId))
})
check(
  'every shipped preset adopted the new key instead of staying blank',
  true,
  presetProviders.length > 0 && presetProviders.every(Boolean),
  `${presetProviders.length} presets`,
)

check('no uncaught errors along the way', [], consoleErrors)

await browser.close()
fake.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
