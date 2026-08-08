/**
 * The sample book: what a brand-new writer sees instead of an empty screen.
 *
 * A blank library asks a newcomer to imagine what the app can do; a small,
 * finished-feeling book *shows* them. Underlined names that open the
 * Almanac, a scene with beats planned, statuses in three states, summaries
 * in the side panel — every feature demonstrates itself, in a story short
 * enough to actually read.
 *
 * It seeds exactly once, and only into a library that has never held a
 * book — not even a deleted one. A writer who empties their library did
 * not ask for a sample; a writer who deletes the sample never sees it
 * again. Both are one flag and one look in the bin.
 */

import { chapterRepo, codexRepo, projectRepo, sceneRepo } from '@/lib/db/repositories'
import { db } from '@/lib/db/schema'
import { usePreferencesStore } from '@/stores/preferences-store'
import type { RichContent, SceneStatus } from '@/types'

export const SAMPLE_BOOK_TITLE = 'The Last Ferry Inn'

/**
 * Playwright and friends identify themselves via `navigator.webdriver`.
 * Every acceptance harness opens the Projects page against an empty
 * library, and each is written against the world it seeds for itself — a
 * sample book arriving uninvited underneath them all would make every
 * test partly about this feature. Automation opts *in* through the
 * localStorage hook instead, and scripts/sample-book-check.mjs does.
 */
function automationOptedOut(): boolean {
  return navigator.webdriver === true && !localStorage.getItem('inkwell-sample-under-test')
}

function doc(...paragraphs: string[]): { content: RichContent; plainText: string; words: number } {
  const plainText = paragraphs.join('\n')
  return {
    content: {
      type: 'doc',
      content: paragraphs.map((text) => ({
        type: 'paragraph',
        content: [{ type: 'text', text }],
      })),
    },
    plainText,
    words: plainText.split(/\s+/).filter(Boolean).length,
  }
}

interface SampleScene {
  title: string
  status: SceneStatus
  summary: string
  beats: string[]
  paragraphs: string[]
}

interface SampleChapter {
  title: string
  scenes: SampleScene[]
}

const CHAPTERS: SampleChapter[] = [
  {
    title: 'Arrivals',
    scenes: [
      {
        title: 'The night ledger',
        status: 'done',
        summary: 'Maren closes the inn for the night and finds one line too many in the ledger.',
        beats: [],
        paragraphs: [
          'The Last Ferry Inn kept two ledgers. The day ledger held what anyone would expect — rooms let, ale poured, the goat’s ongoing war with the herb garden. The night ledger Maren kept in the drawer that stuck, and she wrote in it only what the fog left on her doorstep.',
          'Tonight it had left a boot. One boot, laces done up neatly, standing on the step as if its owner had simply evaporated out of it, and Maren wrote: one boot, brown, no guest to match. Then she read the line above, in handwriting that was not hers and never had been.',
          'Room for the crossing, it said. The usual arrangement. — E.V.',
          'Edda Voss had founded this inn, had raised Maren in it, and had been dead for eleven years. Which, on this coast, did not entirely rule her out.',
        ],
      },
      {
        title: 'A room for no one',
        status: 'revised',
        summary: 'The best room is made up for a guest who never seems to arrive — as it is every year.',
        beats: [],
        paragraphs: [
          'Maren made up the corner room the way Edda’s note asked, the way she did every year on this same foggy Thursday: sheets turned down, window cracked an inch no matter the weather, and the lamp lit but shaded, so the light would reach the water without dazzling anyone on it.',
          'No one would check in. No one ever did. But some mornings the sheets were creased and the glass by the bed held an inch less water, and once — only once — there had been sand on the sill, the coarse black kind that belonged to no beach on this side of Sorrow’s Crossing.',
          'She left the door unlocked and did not look back at it. That part wasn’t in the note. That part was just manners.',
        ],
      },
    ],
  },
  {
    title: 'The Crossing',
    scenes: [
      {
        title: 'What the fog charges',
        status: 'drafting',
        summary:
          'Maren rows out to meet the Ferryman and pay the inn’s yearly fare. Drafting — the beats below are the plan.',
        beats: [
          'Maren rows out past the third buoy, where the fog starts keeping accounts.',
          'The Ferryman’s lantern answers hers — one flash for a fare owed, two for a fare paid.',
          'She names this year’s passenger aloud, and the fog decides whether to take the name or the boat.',
        ],
        paragraphs: [
          'The fog over Sorrow’s Crossing did not roll in. It was simply there, the way a closed door is there, and past the third buoy Maren shipped her oars and let the current introduce her.',
          'Somewhere ahead, the Ferryman lit his lantern. Old Tam, her grandmother had called him, fondly, the way you’d speak of a difficult neighbour — never to his face, and never twice in one night.',
        ],
      },
    ],
  },
  {
    title: 'Departures',
    scenes: [
      {
        title: 'The morning after',
        status: 'outline',
        summary:
          'Outlined only: the corner room is empty, the boot is gone, and the night ledger has a new line — in Maren’s own handwriting, dated next year.',
        beats: [],
        paragraphs: [
          'Not written yet. This scene is only outlined — its summary in the side panel says where it’s going. Some writers draft in order; some leave lighthouses like this one to row toward.',
        ],
      },
    ],
  },
]

const CAST = [
  {
    type: 'character' as const,
    name: 'Maren Voss',
    aliases: ['Maren'],
    summary:
      'Keeper of the Last Ferry Inn. Practical to a fault, which on this coast is a survival trait. Writes down what the fog leaves and charges it no rent.',
    attributes: [
      { key: 'Age', value: '34' },
      { key: 'Role', value: 'Innkeeper, night-ledger keeper' },
    ],
    relationshipTo: 'Edda Voss',
    relationshipLabel: 'granddaughter of',
  },
  {
    type: 'character' as const,
    name: 'Edda Voss',
    aliases: ['Edda'],
    summary:
      'Founded the inn. Died eleven years ago, which has not noticeably slowed her correspondence. Her arrangements with the Crossing predate the harbour, and possibly the coastline.',
    attributes: [{ key: 'Status', value: 'Dead (allegedly)' }],
    relationshipTo: null,
    relationshipLabel: null,
  },
  {
    type: 'character' as const,
    name: 'The Ferryman',
    aliases: ['Old Tam'],
    summary:
      'Works the far side of Sorrow’s Crossing. Payment accepted in names, never in coin. It is considered unwise to be the one who starts the conversation.',
    attributes: [{ key: 'Fare', value: 'One name, spoken aloud' }],
    relationshipTo: null,
    relationshipLabel: null,
  },
  {
    type: 'location' as const,
    name: 'Sorrow’s Crossing',
    aliases: ['the Crossing'],
    summary:
      'The strait below the inn. Charted depth: disputed. The fog over it keeps accounts, and the third buoy marks where its jurisdiction begins.',
    attributes: [{ key: 'Weather', value: 'Fog, contractual' }],
    relationshipTo: null,
    relationshipLabel: null,
  },
]

async function librarySawAnyBookEver(): Promise<boolean> {
  const [live, binned] = await Promise.all([projectRepo.list(), db.projects.listDeleted()])
  return live.length > 0 || binned.length > 0
}

async function seed(): Promise<void> {
  const project = await projectRepo.create({
    title: SAMPLE_BOOK_TITLE,
    author: 'Inkwell',
    synopsis:
      'A little book that came with the app. Click an underlined name, open a scene’s details from the toolbar, try focus mode (Ctrl+.), and edit anything — it’s yours. When you’re done exploring, delete it from the Projects page; your own books live safely beside it.',
    genre: 'Sample book',
    targetWordCount: 1000,
    coverId: null,
    seriesId: null,
    seriesOrder: 0,
    themeId: null,
    status: 'drafting',
    settings: {
      defaultAiPresetId: null,
      pov: 'third-limited',
      tense: 'past',
      measureWidthCh: 68,
      structureMode: 'scenes',
    },
  })

  for (const [chapterIndex, chapter] of CHAPTERS.entries()) {
    const chapterRow = await chapterRepo.create({
      projectId: project.id,
      title: chapter.title,
      order: chapterIndex,
      status: 'drafting',
    })
    for (const [sceneIndex, scene] of chapter.scenes.entries()) {
      const { content, plainText, words } = doc(...scene.paragraphs)
      await sceneRepo.create({
        projectId: project.id,
        chapterId: chapterRow.id,
        title: scene.title,
        order: sceneIndex,
        content,
        plainText,
        wordCount: words,
        status: scene.status,
        povCharacterId: null,
        locationCodexId: null,
        summary: scene.summary,
        beats: scene.beats.map((text, order) => ({
          id: crypto.randomUUID(),
          text,
          order,
          generated: false,
        })),
        labels: [],
        linkedCodexIds: [],
      })
    }
  }

  const idByName = new Map<string, string>()
  for (const member of CAST) {
    const row = await codexRepo.create({
      projectId: project.id,
      seriesId: null,
      type: member.type,
      name: member.name,
      aliases: member.aliases,
      summary: member.summary,
      body: null,
      plainText: '',
      attributes: member.attributes.map((a) => ({ id: crypto.randomUUID(), ...a })),
      relationships: [],
      imageId: null,
      tags: [],
      aiContext: 'when-relevant',
      aiContextTokenBudget: null,
    })
    idByName.set(member.name, row.id)
  }
  for (const member of CAST) {
    const target = member.relationshipTo ? idByName.get(member.relationshipTo) : undefined
    if (!target || !member.relationshipLabel) continue
    await codexRepo.update(idByName.get(member.name)!, {
      relationships: [
        { id: crypto.randomUUID(), targetEntryId: target, label: member.relationshipLabel },
      ],
    })
  }
}

/** Memoised so a double-mounted effect cannot seed the book twice. */
let seedOnce: Promise<boolean> | null = null

export function maybeSeedSampleBook(): Promise<boolean> {
  seedOnce ??= (async () => {
    const prefs = usePreferencesStore.getState()
    if (prefs.sampleBookOffered) return false
    if (automationOptedOut()) return false
    if (await librarySawAnyBookEver()) {
      // A library with history gets no sample, now or ever: mark it so a
      // future emptied-out library is not mistaken for a fresh one.
      prefs.markSampleBookOffered()
      return false
    }
    await seed()
    prefs.markSampleBookOffered()
    return true
  })()
  return seedOnce
}
