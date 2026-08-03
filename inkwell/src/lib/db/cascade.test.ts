import { describe, expect, it } from 'vitest'

import {
  cascadeForChapter,
  cascadeForProject,
  cascadeForScene,
  cascadeSize,
  emptyCascadeSource,
  type CascadeSource,
} from './cascade'

/** A two-project library: `p1` with two chapters, `p2` untouched throughout. */
function library(): CascadeSource {
  return {
    ...emptyCascadeSource(),
    chapters: [
      { id: 'c1', projectId: 'p1' },
      { id: 'c2', projectId: 'p1' },
      { id: 'c9', projectId: 'p2' },
    ],
    scenes: [
      { id: 's1', projectId: 'p1', chapterId: 'c1' },
      { id: 's2', projectId: 'p1', chapterId: 'c1' },
      { id: 's3', projectId: 'p1', chapterId: 'c2' },
      { id: 's9', projectId: 'p2', chapterId: 'c9' },
    ],
    snapshots: [
      { id: 'v1', sceneId: 's1' },
      { id: 'v2', sceneId: 's1' },
      { id: 'v3', sceneId: 's3' },
      { id: 'v9', sceneId: 's9' },
    ],
    covers: [{ id: 'cov1', projectId: 'p1' }],
    goals: [
      { id: 'g1', projectId: 'p1' },
      { id: 'gAll', projectId: null },
    ],
    sessionLogs: [{ id: 'log1', projectId: 'p1' }],
    codexEntries: [
      { id: 'e1', projectId: 'p1' },
      { id: 'eSeries', projectId: null },
    ],
    characterCards: [{ id: 'card1', projectId: 'p1' }],
    cardChats: [{ id: 'chat1', projectId: 'p1' }],
    lorebooks: [{ id: 'lore1', projectId: 'p1' }],
  }
}

describe('cascadeForProject', () => {
  it('takes everything that belongs to the project', () => {
    // Deleting a project used to remove one row and strand all of this.
    const plan = cascadeForProject('p1', library())
    expect(plan.chapters?.sort()).toEqual(['c1', 'c2'])
    expect(plan.scenes?.sort()).toEqual(['s1', 's2', 's3'])
    expect(plan.covers).toEqual(['cov1'])
    expect(plan.characterCards).toEqual(['card1'])
    expect(plan.cardChats).toEqual(['chat1'])
    expect(plan.lorebooks).toEqual(['lore1'])
    expect(plan.sessionLogs).toEqual(['log1'])
  })

  it('reaches snapshots through the scenes that own them', () => {
    // Two levels down, and the level the old chapter delete missed entirely.
    expect(cascadeForProject('p1', library()).snapshots?.sort()).toEqual(['v1', 'v2', 'v3'])
  })

  it('never touches another project', () => {
    const plan = cascadeForProject('p1', library())
    const everything = Object.values(plan).flat()
    for (const survivor of ['c9', 's9', 'v9']) expect(everything).not.toContain(survivor)
  })

  it('spares the library-wide goal', () => {
    // A goal with no project is the writer's overall daily target, not this
    // book's, and deleting one book must not clear it.
    expect(cascadeForProject('p1', library()).goals).toEqual(['g1'])
  })

  it('spares codex entries shared with a series', () => {
    // An entry scoped to the series rather than the project is still needed
    // by the other books in that series.
    expect(cascadeForProject('p1', library()).codexEntries).toEqual(['e1'])
  })

  it('names no table it does not touch', () => {
    const plan = cascadeForProject('p2', library())
    expect(Object.keys(plan).sort()).toEqual(['chapters', 'scenes', 'snapshots'])
  })

  it('is empty for a project that owns nothing', () => {
    expect(cascadeForProject('ghost', library())).toEqual({})
    expect(cascadeSize(cascadeForProject('ghost', library()))).toBe(0)
  })
})

describe('cascadeForChapter', () => {
  it('takes its scenes and their history', () => {
    const plan = cascadeForChapter('c1', library())
    expect(plan.scenes?.sort()).toEqual(['s1', 's2'])
    expect(plan.snapshots?.sort()).toEqual(['v1', 'v2'])
  })

  it('leaves sibling chapters alone', () => {
    const plan = cascadeForChapter('c1', library())
    expect(plan.scenes).not.toContain('s3')
    expect(plan.snapshots).not.toContain('v3')
  })
})

describe('cascadeForScene', () => {
  it('takes the scene’s history with it', () => {
    expect(cascadeForScene('s1', library()).snapshots?.sort()).toEqual(['v1', 'v2'])
  })

  it('is empty for a scene never snapshotted', () => {
    expect(cascadeForScene('s2', library())).toEqual({})
  })
})

describe('cascadeSize', () => {
  it('counts everything a deletion would sweep up', () => {
    // What the confirmation dialog tells the writer before they commit.
    expect(cascadeSize(cascadeForProject('p1', library()))).toBe(15)
  })
})
