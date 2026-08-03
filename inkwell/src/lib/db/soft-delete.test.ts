import { beforeEach, describe, expect, it } from 'vitest'

import { MemoryTable } from './memory-table'
import { createTrashableTable, expiredIds, BIN_RETENTION_DAYS } from './soft-delete'

interface Row {
  id: string
  createdAt: number
  updatedAt: number
  title: string
  deletedAt?: number | null
  deletedWith?: string | null
}

const row = (id: string, title = id): Row => ({ id, createdAt: 1, updatedAt: 1, title })

let store: Map<string, Row>
let raw: MemoryTable<Row>
let table: ReturnType<typeof createTrashableTable<Row>>

beforeEach(async () => {
  store = new Map()
  raw = new MemoryTable(store, () => undefined)
  table = createTrashableTable<Row>(raw)
  for (const id of ['a', 'b', 'c']) await table.add(row(id))
})

describe('an ordinary delete', () => {
  it('hides the record without destroying it', async () => {
    // The point of the whole wrapper: no existing call site changed, and yet
    // nothing is actually gone.
    await table.delete('b')

    expect((await table.toArray()).map((r) => r.id)).toEqual(['a', 'c'])
    expect(await table.get('b')).toBeUndefined()
    expect(await table.getIncludingDeleted('b')).toMatchObject({ id: 'b', title: 'b' })
    expect(store.size).toBe(3)
  })

  it('puts the record in the bin as its own entry', async () => {
    await table.delete('b')
    const binned = await table.listDeleted()
    expect(binned.map((r) => r.id)).toEqual(['b'])
    expect(binned[0].deletedWith).toBeNull()
    expect(typeof binned[0].deletedAt).toBe('number')
  })

  it('leaves everything else alone', async () => {
    await table.delete('b')
    expect(await table.get('a')).toMatchObject({ id: 'a' })
    expect(await table.get('c')).toMatchObject({ id: 'c' })
  })
})

describe('restore', () => {
  it('brings a record back exactly as it was', async () => {
    await table.update('b', { title: 'edited' })
    await table.delete('b')
    await table.restore(['b'])

    expect(await table.get('b')).toMatchObject({ id: 'b', title: 'edited' })
    expect((await table.toArray()).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(await table.listDeleted()).toEqual([])
  })

  it('clears the attribution as well as the timestamp', async () => {
    // Left set, the record would come back already claiming to belong to a
    // deletion that no longer exists, and a later restore of that root would
    // try to bring it back a second time.
    await table.softDelete(['b'], Date.now(), 'root-1')
    await table.restore(['b'])
    const restored = await table.getIncludingDeleted('b')
    expect(restored?.deletedAt).toBeNull()
    expect(restored?.deletedWith).toBeNull()
  })
})

describe('a cascade', () => {
  it('bins dependants under one timestamp and one root', async () => {
    const at = 1_700_000_000_000
    await table.softDelete(['a'], at, null)
    await table.softDelete(['b', 'c'], at, 'a')

    const binned = await table.listDeleted()
    expect(binned.every((r) => r.deletedAt === at)).toBe(true)
    // Only the root is something a person chose to delete; the rest went with
    // it and must not be offered as separate things to restore.
    expect(binned.filter((r) => r.deletedWith === null).map((r) => r.id)).toEqual(['a'])
  })
})

describe('purge', () => {
  it('is the only thing that actually removes data', async () => {
    await table.delete('b')
    expect(store.size).toBe(3)

    await table.purge(['b'])
    expect(store.size).toBe(2)
    expect(await table.getIncludingDeleted('b')).toBeUndefined()
  })
})

describe('records written before the bin existed', () => {
  it('are treated as live, not as deleted', async () => {
    // Nothing in an existing library carries `deletedAt`. If absent were read
    // as anything but "live", the wrapper would hide the user's entire
    // library the first time it shipped.
    store.set('legacy', { id: 'legacy', createdAt: 1, updatedAt: 1, title: 'legacy' })
    expect((await table.toArray()).map((r) => r.id)).toContain('legacy')
    expect(await table.get('legacy')).toBeDefined()
  })
})

describe('expiredIds', () => {
  const day = 24 * 60 * 60 * 1000
  const now = 1_700_000_000_000

  it('finds only what has been in the bin past the retention window', () => {
    const rows: Row[] = [
      { ...row('old'), deletedAt: now - (BIN_RETENTION_DAYS + 1) * day },
      { ...row('fresh'), deletedAt: now - 2 * day },
      row('live'),
    ]
    expect(expiredIds(rows, now)).toEqual(['old'])
  })

  it('keeps a record sitting exactly on the boundary', () => {
    const rows: Row[] = [{ ...row('edge'), deletedAt: now - BIN_RETENTION_DAYS * day }]
    expect(expiredIds(rows, now)).toEqual([])
  })
})
