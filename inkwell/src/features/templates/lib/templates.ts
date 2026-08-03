/**
 * Manuscript templates: the shape a book starts in.
 *
 * A new project used to open on an empty tree and an invitation to add a
 * chapter, which is a strange first thing to ask of someone who has just told
 * you they are writing a novel. A template lays out the divisions a novel
 * actually has — a prologue, then chapter one, then the rest — so the writer
 * begins by writing rather than by building a scaffold they already knew the
 * shape of.
 *
 * Everything here is pure. Expanding a template produces a plan; creating the
 * records from that plan is somebody else's job, which is what makes the
 * numbering and the naming testable without a database.
 */

import type {
  ChapterKind,
  ChapterNumbering,
  ManuscriptTemplate,
  TemplatePart,
} from '@/types'

export const CHAPTER_KIND_LABEL: Record<ChapterKind, string> = {
  prologue: 'Prologue',
  chapter: 'Chapter',
  interlude: 'Interlude',
  part: 'Part',
  epilogue: 'Epilogue',
  act: 'Act',
  poem: 'Poem',
  entry: 'Entry',
}

/** Kinds that take a number. A book has chapter twelve, not prologue two. */
const NUMBERED: ReadonlySet<ChapterKind> = new Set<ChapterKind>([
  'chapter',
  'part',
  'interlude',
  'act',
  'poem',
  'entry',
])

export function isNumbered(kind: ChapterKind): boolean {
  return NUMBERED.has(kind)
}

/** A missing kind is an ordinary chapter — every one written before kinds. */
export function chapterKind(chapter: { kind?: ChapterKind }): ChapterKind {
  return chapter.kind ?? 'chapter'
}

/**
 * Whether the title already says what kind of division this is.
 *
 * Almost every one does — "Prologue", "Chapter Nine", "Part Two" — and
 * labelling those again is worse than useless: in the manuscript tree the tag
 * squeezed "Prologue" down to "Pr…" to make room for the word PROLOGUE beside
 * it. A tag earns its space only on a division whose title does not give it
 * away, like a prologue the writer called "Before".
 */
export function titleStatesKind(title: string, kind: ChapterKind): boolean {
  return title.trim().toLowerCase().startsWith(CHAPTER_KIND_LABEL[kind].toLowerCase())
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

/**
 * "Chapter Forty-Three", the way a printed novel writes it.
 *
 * Words are the house style of almost every published novel, which is why
 * they are the default and why this exists at all rather than the numbering
 * being a choice between digits and Roman.
 */
export function numberToWords(n: number): string {
  if (!Number.isFinite(n) || n < 1) return String(n)
  if (n >= 1000) return String(n)
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`)
  if (rest > 0) {
    if (rest < 20) parts.push(ONES[rest])
    else {
      const tens = TENS[Math.floor(rest / 10)]
      const ones = ONES[rest % 10]
      parts.push(ones ? `${tens}-${ones}` : tens)
    }
  }
  return parts.join(' ')
}

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

export function numberToRoman(n: number): string {
  if (!Number.isFinite(n) || n < 1) return String(n)
  let left = Math.floor(n)
  let out = ''
  for (const [value, glyph] of ROMAN) {
    while (left >= value) {
      out += glyph
      left -= value
    }
  }
  return out
}

export function formatNumber(n: number, numbering: ChapterNumbering): string {
  if (numbering === 'digits') return String(n)
  if (numbering === 'roman') return numberToRoman(n)
  return numberToWords(n)
}

export interface PlannedChapter {
  kind: ChapterKind
  title: string
  /** Titles of the scenes to create inside it, in order. */
  scenes: string[]
}

export interface ExpandOptions {
  /**
   * A chapters-only project still stores its prose in a scene — exactly one,
   * which the editor writes into directly. Asking a template for three scenes
   * per chapter would give such a project two it can never reach.
   */
  scenesPerChapter?: 'template' | 'one'
}

/**
 * Turns a template into the chapters and scenes to create.
 *
 * Numbering runs per kind across the whole template, not per part: a template
 * with three chapters, an interlude and nine more chapters numbers those nine
 * four through twelve, because that is what the book will say.
 */
export function expandTemplate(
  template: Pick<ManuscriptTemplate, 'numbering' | 'parts'>,
  options: ExpandOptions = {},
): PlannedChapter[] {
  const seen = new Map<ChapterKind, number>()
  const out: PlannedChapter[] = []

  for (const part of template.parts) {
    const count = Math.max(0, Math.floor(part.count))
    for (let i = 0; i < count; i++) {
      const next = (seen.get(part.kind) ?? 0) + 1
      seen.set(part.kind, next)

      const numbered = isNumbered(part.kind)
      const title = part.title.includes('{n}')
        ? part.title.replaceAll('{n}', formatNumber(next, template.numbering))
        : // Two prologues would otherwise both be called "Prologue"; one is
          // left alone, because "Prologue 1" is not a thing any book says.
          numbered || next > 1
          ? `${part.title} ${formatNumber(next, template.numbering)}`
          : part.title

      const sceneCount =
        options.scenesPerChapter === 'one' ? 1 : Math.max(1, Math.floor(part.scenesEach))
      out.push({
        kind: part.kind,
        title: title.trim(),
        scenes: Array.from({ length: sceneCount }, (_, s) => `Scene ${s + 1}`),
      })
    }
  }

  return out
}

/** How many records a template would create, for a preview that says so. */
export function templateSize(plan: PlannedChapter[]): { chapters: number; scenes: number } {
  return {
    chapters: plan.length,
    scenes: plan.reduce((sum, chapter) => sum + chapter.scenes.length, 0),
  }
}

function part(
  kind: ChapterKind,
  title: string,
  count: number,
  scenesEach: number,
): TemplatePart {
  return { id: `${kind}-${title}-${count}`, kind, title, count, scenesEach }
}

/**
 * The templates that ship with the app.
 *
 * Kept deliberately short. Anything more specific than these is a matter of
 * how one writer works, which is what custom formats are for — a long list of
 * near-identical built-ins would be a worse answer to the same problem.
 */
export const BUILT_IN_TEMPLATES: (Pick<
  ManuscriptTemplate,
  'name' | 'description' | 'numbering' | 'structureMode' | 'parts'
> & { id: string })[] = [
  {
    id: 'builtin:blank',
    name: 'Blank',
    description: 'Nothing at all. Build the manuscript yourself as you go.',
    numbering: 'words',
    parts: [],
  },
  {
    id: 'builtin:standard-novel',
    name: 'Standard novel',
    description: 'A prologue, chapter one, and an epilogue. The rest as you write it.',
    numbering: 'words',
    parts: [
      part('prologue', 'Prologue', 1, 1),
      part('chapter', 'Chapter {n}', 1, 1),
      part('epilogue', 'Epilogue', 1, 1),
    ],
  },
  {
    id: 'builtin:three-act',
    name: 'Three acts',
    description: 'Three parts of four chapters each, numbered straight through.',
    numbering: 'words',
    parts: [
      part('part', 'Part {n}', 1, 1),
      part('chapter', 'Chapter {n}', 4, 1),
      part('part', 'Part {n}', 1, 1),
      part('chapter', 'Chapter {n}', 4, 1),
      part('part', 'Part {n}', 1, 1),
      part('chapter', 'Chapter {n}', 4, 1),
    ],
  },
  {
    // Roman numerals because that is how a screenplay's acts are set, and
    // scenes inside acts because that is the one thing a screenplay's
    // structure genuinely is: the act holds the scenes.
    id: 'builtin:screenplay',
    name: 'Screenplay',
    description: 'Three acts of scenes, weighted the way a feature is.',
    numbering: 'roman',
    structureMode: 'scenes',
    parts: [
      part('act', 'Act {n}', 1, 4),
      part('act', 'Act {n}', 1, 6),
      part('act', 'Act {n}', 1, 4),
    ],
  },
  {
    id: 'builtin:stage-script',
    name: 'Stage script',
    description: 'Two acts of three scenes, as a play is staged.',
    numbering: 'roman',
    structureMode: 'scenes',
    parts: [part('act', 'Act {n}', 2, 3)],
  },
  {
    // A poem is one whole thing. Split into scenes, every poem in the
    // collection would carry a lone "Scene 1" beneath it and nothing else.
    id: 'builtin:poetry',
    name: 'Poetry collection',
    description: 'Six poems to open a collection, each one whole.',
    numbering: 'words',
    structureMode: 'chapters-only',
    parts: [part('poem', 'Poem {n}', 6, 1)],
  },
  {
    // Numbered rather than dated: a template cannot know when the diary
    // starts, and "Entry One" is a placeholder that asks to be renamed to a
    // date, where "1 January" would quietly claim to be one.
    id: 'builtin:diary',
    name: 'Diary',
    description: 'A week of entries, each one an unbroken sitting.',
    numbering: 'words',
    structureMode: 'chapters-only',
    parts: [part('entry', 'Entry {n}', 7, 1)],
  },
]

export const DEFAULT_TEMPLATE_ID = 'builtin:standard-novel'

/** A starting point for a writer making their own format. */
export function blankCustomTemplate(): Pick<
  ManuscriptTemplate,
  'name' | 'description' | 'numbering' | 'parts'
> {
  return {
    name: 'My format',
    description: '',
    numbering: 'words',
    parts: [
      { id: crypto.randomUUID(), kind: 'prologue', title: 'Prologue', count: 1, scenesEach: 1 },
      { id: crypto.randomUUID(), kind: 'chapter', title: 'Chapter {n}', count: 1, scenesEach: 1 },
    ],
  }
}
