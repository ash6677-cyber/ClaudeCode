import { describe, expect, it } from 'vitest'

import { planImport } from './import-characters'
import { runImport, undoImport, type ImportDeps } from './run-import'
import type { CharacterCard, CodexEntry, ImageAsset } from '@/types'

function entry(changes: Partial<CodexEntry> & { name: string }): CodexEntry {
  return {
    id: `e-${changes.name.toLowerCase()}`,
    createdAt: 0,
    updatedAt: 0,
    projectId: 'p1',
    seriesId: null,
    type: 'character',
    aliases: [],
    summary: '',
    body: null,
    plainText: '',
    attributes: [],
    relationships: [],
    imageId: null,
    tags: [],
    aiContext: 'when-relevant',
    aiContextTokenBudget: null,
    ...changes,
  } as CodexEntry
}

function card(changes: Partial<CharacterCard> & { displayName: string }): CharacterCard {
  return {
    id: `c-${changes.displayName.toLowerCase()}`,
    createdAt: 1,
    updatedAt: 1,
    projectId: 'p1',
    codexEntryId: null,
    avatarImageId: null,
    cropSettings: null,
    description: '',
    personality: '',
    scenario: '',
    firstMessage: '',
    exampleDialogue: [],
    systemPromptOverride: null,
    voiceNotes: '',
    tags: [],
    ...changes,
  } as CharacterCard
}

/** A database small enough to hold in your hand and compare byte for byte. */
function fakeDb(initial: CharacterCard[] = [], images: ImageAsset[] = []) {
  const cards = new Map(initial.map((c) => [c.id, structuredClone(c)]))
  const assets = new Map(images.map((i) => [i.id, i]))
  let n = 0
  const deps: ImportDeps = {
    cards: {
      async create(data) {
        const made = { ...data, id: `new-${++n}`, createdAt: 100, updatedAt: 100 } as CharacterCard
        cards.set(made.id, made)
        return made
      },
      async update(id, changes) {
        const existing = cards.get(id)
        if (!existing) throw new Error(`no card ${id}`)
        cards.set(id, { ...existing, ...changes, updatedAt: 200 })
      },
      async bulkRemove(ids) {
        // The real table bins rather than deletes, and binned records are
        // filtered out of every list — so removing them here is the same
        // thing as far as anything that reads the grid is concerned.
        for (const id of ids) cards.delete(id)
      },
    },
    images: {
      async get(id) {
        return assets.get(id)
      },
      async create(data) {
        const made = { ...data, id: `img-${++n}`, createdAt: 100, updatedAt: 100 } as ImageAsset
        assets.set(made.id, made)
        return made
      },
      async remove(id) {
        assets.delete(id)
      },
    },
  }
  return { deps, cards, assets }
}

const asset = (id: string): ImageAsset =>
  ({
    id,
    createdAt: 0,
    updatedAt: 0,
    blob: new Blob(['x']),
    mimeType: 'image/png',
    width: 10,
    height: 10,
    fileName: `${id}.png`,
  }) as ImageAsset

describe('runImport', () => {
  it('creates a card carrying every mapped field', async () => {
    const { deps, cards } = fakeDb()
    const plan = planImport(
      [entry({ name: 'Mira', summary: 'A salt trader.', plainText: 'Blunt.', tags: ['lead'] })],
      [],
      'skip',
    )
    const out = await runImport(plan, { projectId: 'p1', linked: true }, deps)
    expect(out).toMatchObject({ created: 1, replaced: 0, skipped: 0, failed: [] })
    const made = [...cards.values()][0]
    expect(made).toMatchObject({
      displayName: 'Mira',
      description: 'A salt trader.',
      personality: 'Blunt.',
      tags: ['lead'],
      codexEntryId: 'e-mira',
      projectId: 'p1',
    })
  })

  it('leaves the link off when the writer asked for a snapshot', async () => {
    const { deps, cards } = fakeDb()
    await runImport(planImport([entry({ name: 'Mira' })], [], 'skip'), { projectId: 'p1', linked: false }, deps)
    expect([...cards.values()][0].codexEntryId).toBeNull()
  })

  it('copies the portrait rather than sharing it', async () => {
    // Sharing the id would mean deleting the Almanac entry blanks the card's
    // face, and cropping one crops the other.
    const { deps, cards, assets } = fakeDb([], [asset('src')])
    await runImport(
      planImport([entry({ name: 'Mira', imageId: 'src' })], [], 'skip'),
      { projectId: 'p1', linked: true },
      deps,
    )
    const made = [...cards.values()][0]
    expect(made.avatarImageId).not.toBe('src')
    expect(assets.has(made.avatarImageId!)).toBe(true)
    expect(assets.has('src')).toBe(true)
  })

  it('reports progress once per entry', async () => {
    const { deps } = fakeDb()
    const seen: number[] = []
    const plan = planImport([entry({ name: 'A' }), entry({ name: 'B' })], [], 'skip')
    await runImport(
      plan,
      { projectId: 'p1', linked: true, onProgress: (done, total) => seen.push(done / total) },
      deps,
    )
    expect(seen).toEqual([0.5, 1])
  })

  it('keeps going when one entry fails, and says which', async () => {
    const { deps } = fakeDb()
    const failing: ImportDeps = {
      ...deps,
      cards: {
        ...deps.cards,
        async create(data) {
          if (data.displayName === 'B') throw new Error('disk full')
          return deps.cards.create(data)
        },
      },
    }
    const plan = planImport(
      [entry({ name: 'A' }), entry({ name: 'B' }), entry({ name: 'C' })],
      [],
      'skip',
    )
    const out = await runImport(plan, { projectId: 'p1', linked: true }, failing)
    expect(out.created).toBe(2)
    expect(out.failed).toEqual([{ name: 'B', message: 'disk full' }])
  })
})

describe('replace', () => {
  it('refreshes the written fields and touches nothing else', async () => {
    // A card that lost its look, its scenario or its example dialogue on a
    // refresh would make "Update" unusable.
    const existing = card({
      displayName: 'Mira',
      description: 'old',
      personality: 'old',
      scenario: 'The caravan halts.',
      firstMessage: 'You again.',
      voiceNotes: 'clipped',
      design: { frame: 'shard', finish: 'holo', accent: null, gloss: 0.8, vignette: 0.5 },
    })
    const { deps, cards } = fakeDb([existing])
    const plan = planImport(
      [entry({ name: 'Mira', summary: 'new', plainText: 'new prose' })],
      [existing],
      'replace',
    )
    await runImport(plan, { projectId: 'p1', linked: true }, deps)
    const after = cards.get(existing.id)!
    expect(after).toMatchObject({ description: 'new', personality: 'new prose' })
    expect(after.scenario).toBe('The caravan halts.')
    expect(after.firstMessage).toBe('You again.')
    expect(after.voiceNotes).toBe('clipped')
    expect(after.design).toEqual(existing.design)
  })
})

describe('undoImport', () => {
  it('leaves the grid exactly as it was after a mixed run', async () => {
    const untouched = card({ displayName: 'Tomas', description: 'innkeeper' })
    const replaced = card({
      displayName: 'Mira',
      description: 'hers',
      personality: 'hers',
      tags: ['lead'],
      design: { frame: 'arch', finish: 'satin', accent: null, gloss: 0.4, vignette: 0.7 },
    })
    const { deps, cards } = fakeDb([untouched, replaced])
    const before = structuredClone([...cards.values()])

    const plan = planImport(
      [
        entry({ name: 'Mira', summary: 'from the almanac', plainText: 'almanac prose', tags: ['x'] }),
        entry({ name: 'Elenya', summary: 'new person' }),
      ],
      [untouched, replaced],
      'replace',
    )
    const out = await runImport(plan, { projectId: 'p1', linked: true }, deps)
    expect([out.created, out.replaced]).toEqual([1, 1])
    expect(cards.size).toBe(3)

    await undoImport(out.journal, deps)

    // Everything but the bookkeeping timestamp is back where it started.
    const after = [...cards.values()]
    expect(after.length).toBe(before.length)
    for (const original of before) {
      const now = cards.get(original.id)!
      expect({ ...now, updatedAt: original.updatedAt }).toEqual(original)
    }
  })

  it('restores a replaced portrait and drops the copy it made', async () => {
    const replaced = card({ displayName: 'Mira', avatarImageId: 'hers' })
    const { deps, cards, assets } = fakeDb([replaced], [asset('hers'), asset('src')])
    const plan = planImport([entry({ name: 'Mira', imageId: 'src' })], [replaced], 'replace')
    const out = await runImport(plan, { projectId: 'p1', linked: true }, deps)

    const copied = cards.get(replaced.id)!.avatarImageId!
    expect(copied).not.toBe('hers')

    await undoImport(out.journal, deps)
    expect(cards.get(replaced.id)!.avatarImageId).toBe('hers')
    expect(assets.has('hers')).toBe(true)
    // The copy is referenced by nothing now, so it goes.
    expect(assets.has(copied)).toBe(false)
  })

  it('is safe to run against a journal where nothing happened', async () => {
    const { deps, cards } = fakeDb([card({ displayName: 'Mira' })])
    const out = await runImport(planImport([], [], 'skip'), { projectId: 'p1', linked: true }, deps)
    await undoImport(out.journal, deps)
    expect(cards.size).toBe(1)
  })
})
