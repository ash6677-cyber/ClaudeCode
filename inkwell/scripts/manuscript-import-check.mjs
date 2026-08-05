/**
 * Manuscript import acceptance (plan §22.1), driven through the real UI with
 * real files against a real IndexedDB.
 *
 * The parser is unit-tested; what cannot be unit-tested is whether a writer
 * can actually get their book in. So this builds a genuine .docx — a zip with
 * Word's own heading styles inside it — drops it on the dialog, and then reads
 * the database to see whether the chapters that appear are the chapters the
 * document had.
 *
 * The check that matters most is the negative one: that looking at the preview
 * writes nothing. A structure guess shown and then declined must leave the
 * library exactly as it was.
 *
 *   INKWELL_BASE_PATH=/ npm run build
 *   (cd dist && python3 -m http.server 5410 --bind 127.0.0.1 &)
 *   node scripts/manuscript-import-check.mjs
 */
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
)
const { default: JSZip } = await import('jszip')

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

// ── A real Word document ─────────────────────────────────────────────────────
// Not a fixture checked in as bytes: built here, so what the reader is asked
// to cope with is legible in the same file as the assertions about it.

const xmlEscape = (s) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])

const wordParagraph = (text, style) => {
  const props = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''
  // Word splits a sentence across runs whenever formatting changes; splitting
  // one here on purpose keeps the reader honest about rejoining them.
  const runs = text
    .split(' ')
    .map((word, i) => `<w:r><w:t xml:space="preserve">${xmlEscape(i ? ` ${word}` : word)}</w:t></w:r>`)
    .join('')
  return `<w:p>${props}${runs}</w:p>`
}

async function buildDocx(blocks) {
  const body = blocks.map(([text, style]) => wordParagraph(text, style)).join('')
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  )
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

const docxBuffer = await buildDocx([
  ['The Salt Road', 'Title'],
  ['Chapter One', 'Heading1'],
  ['The bridge', 'Heading2'],
  ['The caravan came down out of the hills at dusk.', null],
  ['Mira counted the carts twice.', null],
  ['* * *', null],
  ['By dark the salt was gone.', null],
  ['Chapter Two', 'Heading1'],
  ['Tomas was waiting at the inn.', null],
])

const files = {
  docx: {
    name: 'the-salt-road.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: docxBuffer,
  },
  markdown: {
    name: 'plain_manuscript.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      `# Chapter One\n\nShe crossed at dusk.\n\n# Chapter Two\n\nThe inn was full.\n`,
      'utf8',
    ),
  },
  text: {
    name: 'dividers.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(`First scene.\n\n***\n\nSecond scene.\n\n***\n\nThird scene.\n`, 'utf8'),
  },
  wrong: {
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not really a png', 'utf8'),
  },
}

// ── Driving it ───────────────────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 960 } })
const page = await ctx.newPage()

const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(String(e)))

await page.goto(`${BASE}#/projects`)
await page.waitForTimeout(1200)

/** The manuscript as the app's own database holds it. */
async function readLibrary() {
  return page.evaluate(async () => {
    const open = indexedDB.open('inkwell')
    const db = await new Promise((res) => {
      open.onsuccess = () => res(open.result)
    })
    const all = (store) =>
      new Promise((res) => {
        const req = db.transaction(store).objectStore(store).getAll()
        req.onsuccess = () => res(req.result.filter((r) => typeof r.deletedAt !== 'number'))
      })
    const [projects, chapters, scenes] = await Promise.all([
      all('projects'),
      all('chapters'),
      all('scenes'),
    ])
    db.close()
    // Reading order, not table order: a scene means nothing without the
    // chapter it sits in, so sort by the chapter's place and then its own.
    const chapterOrder = new Map(chapters.map((c) => [c.id, c.order]))
    return {
      projects: projects.map((p) => ({ id: p.id, title: p.title, author: p.author })),
      chapters: chapters
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ id: c.id, projectId: c.projectId, title: c.title, order: c.order })),
      scenes: scenes
        .slice()
        .sort(
          (a, b) =>
            (chapterOrder.get(a.chapterId) ?? 0) - (chapterOrder.get(b.chapterId) ?? 0) ||
            a.order - b.order,
        )
        .map((s) => ({
          chapterId: s.chapterId,
          title: s.title,
          order: s.order,
          text: s.plainText,
          words: s.wordCount,
          paragraphs: (s.content?.content ?? []).length,
        })),
    }
  })
}

async function openImport() {
  await page.goto(`${BASE}#/projects`)
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: /Import( a manuscript)?$/ }).first().click()
  await page.waitForTimeout(400)
}

async function drop(file) {
  await page.locator('[role="dialog"] input[type=file]').setInputFiles(file)
  await page.waitForTimeout(900)
}

const empty = await readLibrary()
check('starting from an empty library', [0, 0, 0], [
  empty.projects.length,
  empty.chapters.length,
  empty.scenes.length,
])

// ── The Word document ────────────────────────────────────────────────────────
await openImport()
await drop(files.docx)

const previewLines = await page.locator('[role="dialog"] li').allInnerTexts()
check('a .docx is read into the chapters its headings declared', 2, previewLines.length)
check(
  'chapter titles come from the document, not from counting',
  true,
  previewLines[0].includes('Chapter One') && previewLines[1].includes('Chapter Two'),
  JSON.stringify(previewLines.map((l) => l.split('\n')[0])),
)
check(
  'the preview says how the structure was worked out',
  true,
  await page.getByText(/taken from the document’s own headings/).isVisible(),
)
check(
  'a divider inside a chapter becomes a second scene',
  true,
  /2 scenes/.test(previewLines[0]),
  previewLines[0].replace(/\n/g, ' | '),
)
check(
  'the document’s own title page beats the filename',
  'The Salt Road',
  await page.locator('#import-title').inputValue(),
  'the file is named "the-salt-road", so a filename guess would be lower case',
)
check(
  'a Word title block does not become chapter one',
  false,
  previewLines.some((l) => l.includes('The Salt Road')),
)

// The promise the dialog makes in words: nothing has been created yet.
const duringPreview = await readLibrary()
check('looking at the preview writes nothing', [0, 0, 0], [
  duringPreview.projects.length,
  duringPreview.chapters.length,
  duringPreview.scenes.length,
])

// Declining must also leave nothing behind.
await page.getByRole('button', { name: 'Cancel' }).click()
await page.waitForTimeout(500)
const afterCancel = await readLibrary()
check('cancelling leaves the library untouched', [0, 0, 0], [
  afterCancel.projects.length,
  afterCancel.chapters.length,
  afterCancel.scenes.length,
])

// ── Committing it ────────────────────────────────────────────────────────────
await openImport()
await drop(files.docx)
await page.locator('#import-title').fill('The Salt Road')
await page.locator('#import-author').fill('Mira Vance')
await page.getByRole('button', { name: /Create the book/ }).click()
await page.waitForTimeout(1800)

check(
  'a finished import opens the book it just made',
  true,
  page.url().includes('#/editor?project='),
  page.url().split('#')[1],
)

const imported = await readLibrary()
check('one book was created', ['The Salt Road', 'Mira Vance'], [
  imported.projects[0]?.title,
  imported.projects[0]?.author,
])
check(
  'the chapters are the document’s chapters, in order',
  ['Chapter One', 'Chapter Two'],
  imported.chapters.map((c) => c.title),
)
check(
  'scenes keep the names their headings gave them',
  ['The bridge', 'Scene 2', 'Scene 1'],
  imported.scenes.map((s) => s.title),
)
check(
  'the scenes belong to the chapters they were written under',
  [2, 1],
  imported.chapters.map((c) => imported.scenes.filter((s) => s.chapterId === c.id).length),
)
check(
  'runs split by Word are rejoined into whole sentences',
  'The caravan came down out of the hills at dusk.\n\nMira counted the carts twice.',
  imported.scenes.find((s) => s.title === 'The bridge')?.text,
)
check(
  'paragraphs arrive as paragraphs, not one wall of text',
  2,
  imported.scenes.find((s) => s.title === 'The bridge')?.paragraphs,
)
check(
  'the divider line is never left in the prose',
  false,
  imported.scenes.some((s) => /\*\s*\*\s*\*/.test(s.text)),
)
check(
  'word counts are the words a writer would count',
  [15, 6, 6],
  imported.scenes.map((s) => s.words),
)

// The imported book must open and render, not merely exist in a table.
await page.waitForTimeout(600)
check(
  'the imported chapters are readable in the editor',
  true,
  await page.getByText('Chapter One').first().isVisible(),
)

// ── Markdown, and appending is not the default ───────────────────────────────
await openImport()
await drop(files.markdown)
await page.locator('#import-title').fill('Second Book')
await page.getByRole('button', { name: /Create the book/ }).click()
await page.waitForTimeout(1600)

const two = await readLibrary()
check('a second import makes a second book, not more of the first', 2, two.projects.length)
check(
  'each book keeps only its own chapters',
  [2, 2],
  two.projects.map((p) => two.chapters.filter((c) => c.projectId === p.id).length),
)
check(
  'chapter order restarts inside the new book',
  [0, 1],
  two.chapters
    .filter((c) => c.projectId === two.projects[1].id)
    .map((c) => c.order)
    .sort(),
)

// ── Plain text with dividers ─────────────────────────────────────────────────
await openImport()
await drop(files.text)
check(
  'dividers alone make scenes, and are not mistaken for chapters',
  1,
  await page.locator('[role="dialog"] li').count(),
)
check(
  'the preview admits it found no headings',
  true,
  await page.getByText(/divider lines were read as scene breaks/).isVisible(),
)
check(
  'every run between dividers is a scene',
  true,
  /3 scenes/.test((await page.locator('[role="dialog"] li').first().innerText()).replace(/\n/g, ' ')),
)
await page.getByRole('button', { name: 'Cancel' }).click()
await page.waitForTimeout(400)

// ── A file that is not a manuscript ──────────────────────────────────────────
await openImport()
await drop(files.wrong)
check(
  'an unsupported file is refused in words, not by silence',
  true,
  await page.getByText('That file type is not supported', { exact: true }).first().isVisible(),
)
check(
  'and the drop zone is still there to try again with',
  true,
  await page.getByText(/Choose a file, or drop one here/).isVisible(),
)
check('nothing was written by the refusal', 2, (await readLibrary()).projects.length)

check('no uncaught errors along the way', [], consoleErrors)

await browser.close()
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
