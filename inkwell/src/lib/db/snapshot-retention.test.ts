import { describe, expect, it } from 'vitest'

import { DAY_MS, DEFAULT_RETENTION, snapshotsToSweep } from './snapshot-retention'
import { conflictLabel } from '@/lib/sync/conflict'
import type { Snapshot } from '@/types'

const NOW = Date.UTC(2026, 0, 100)

function snap(id: string, ageDays: number, sceneId = 's1', label = 'Autosave'): Snapshot {
  return {
    id,
    sceneId,
    createdAt: NOW - ageDays * DAY_MS,
    updatedAt: NOW - ageDays * DAY_MS,
    content: null,
    plainText: '',
    wordCount: 0,
    label,
  } as Snapshot
}

const swept = (list: Snapshot[]) => snapshotsToSweep(list, NOW).sort()

describe('snapshot retention', () => {
  it('keeps everything inside the first week', () => {
    const recent = [snap('a', 0.1), snap('b', 1), snap('c', 3), snap('d', 6.9)]
    expect(swept(recent)).toEqual([])
  })

  it('thins older weeks to one a day', () => {
    // Three from the same day, thirty days back: the latest survives.
    const list = [
      snap('newest', 0),
      snap('morning', 30.9),
      snap('noon', 30.5),
      snap('night', 30.1),
    ]
    expect(swept(list)).toEqual(['morning', 'noon'])
  })

  it('keeps one a day across different days', () => {
    const list = [snap('newest', 0), snap('d30', 30), snap('d31', 31), snap('d32', 32)]
    expect(swept(list)).toEqual([])
  })

  it('thins beyond three months to one a week', () => {
    // Seven consecutive days can straddle a week boundary but can never span
    // more than two weeks, so at most two survive however the calendar falls.
    const week = Array.from({ length: 7 }, (_, i) => snap(`d${i}`, 120 + i))
    const gone = swept([snap('newest', 0), ...week])
    expect(gone).not.toContain('newest')
    expect(week.length - gone.length).toBeLessThanOrEqual(2)
    expect(gone.length).toBeGreaterThanOrEqual(5)
  })

  it('never sweeps a scene’s most recent version, however old', () => {
    // A scene abandoned two years ago still has its history — one version.
    expect(swept([snap('only', 700)])).toEqual([])
    // Same day, so the policy would thin them — the newest is still spared.
    expect(swept([snap('older', 700), snap('newer', 699.7)])).toEqual(['older'])
  })

  it('never sweeps a snapshot kept from a sync conflict', () => {
    // These exist because the words were nearly lost once already.
    const list = [
      snap('newest', 0),
      snap('a', 200),
      snap('b', 200.5, 's1', conflictLabel(new Date(NOW - 200.5 * DAY_MS))),
      snap('c', 200.9),
    ]
    const gone = swept(list)
    expect(gone).not.toContain('b')
    expect(gone.length).toBeGreaterThan(0)
  })

  it('treats each scene’s history separately', () => {
    const list = [
      snap('s1-new', 0, 's1'),
      snap('s1-a', 200, 's1'),
      snap('s1-b', 200.5, 's1'),
      snap('s2-new', 0, 's2'),
      snap('s2-a', 200, 's2'),
      snap('s2-b', 200.5, 's2'),
    ]
    const gone = swept(list)
    // One from each scene, not two from whichever came first in the array.
    expect(gone.length).toBe(2)
    expect(gone.some((id) => id.startsWith('s1'))).toBe(true)
    expect(gone.some((id) => id.startsWith('s2'))).toBe(true)
  })

  it('is stable — sweeping twice removes nothing new', () => {
    const list = [snap('newest', 0), snap('a', 200), snap('b', 200.5), snap('c', 200.9)]
    const first = new Set(snapshotsToSweep(list, NOW))
    const survivors = list.filter((s) => !first.has(s.id))
    expect(snapshotsToSweep(survivors, NOW)).toEqual([])
  })

  it('does nothing to an empty history', () => {
    expect(snapshotsToSweep([], NOW, DEFAULT_RETENTION)).toEqual([])
  })
})
