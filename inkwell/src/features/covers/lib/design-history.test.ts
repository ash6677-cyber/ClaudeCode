import { describe, expect, it } from 'vitest'

import { emptyHistory, record, redo, undo } from './design-history'

describe('remembering changes', () => {
  it('undoes back to what was there before', () => {
    let h = emptyHistory<string>()
    h = record(h, 'first', 1000)
    h = record(h, 'second', 5000)
    const step = undo(h, 'third')
    expect(step?.snapshot).toBe('second')
    const again = undo(step!.history, step!.snapshot)
    expect(again?.snapshot).toBe('first')
    expect(undo(again!.history, again!.snapshot)).toBeNull()
  })

  it('treats a drag as one edit, not a hundred', () => {
    // The crop is written on every pointer move. Undo must return to where
    // the picture was before the drag, not one pixel back.
    let h = emptyHistory<number>()
    h = record(h, 0, 1000)
    for (let i = 1; i <= 100; i++) h = record(h, i, 1000 + i * 16)
    expect(h.past).toHaveLength(1)
    expect(undo(h, 100)?.snapshot).toBe(0)
  })

  it('keeps a slow continuous gesture as one edit too', () => {
    let h = emptyHistory<number>()
    h = record(h, 0, 1000)
    // Each move is 500ms after the last: the gesture outlives the window but
    // never breaks it, so it stays a single entry.
    for (let i = 1; i <= 10; i++) h = record(h, i, 1000 + i * 500)
    expect(h.past).toHaveLength(1)
  })

  it('starts a new entry once the hand has rested', () => {
    let h = emptyHistory<number>()
    h = record(h, 0, 1000)
    h = record(h, 1, 5000)
    expect(h.past).toHaveLength(2)
  })

  it('redoes what undo took away', () => {
    let h = emptyHistory<string>()
    h = record(h, 'before', 1000)
    const back = undo(h, 'after')!
    const forward = redo(back.history, back.snapshot)!
    expect(forward.snapshot).toBe('after')
    expect(redo(forward.history, forward.snapshot)).toBeNull()
  })

  it('abandons the future on a new edit — redo must never graft a dead branch', () => {
    let h = emptyHistory<string>()
    h = record(h, 'a', 1000)
    const back = undo(h, 'b')!
    h = record(back.history, back.snapshot, 5000)
    expect(redo(h, 'c')).toBeNull()
  })

  it('never coalesces into an entry a redo created', () => {
    let h = emptyHistory<string>()
    h = record(h, 'a', 1000)
    const back = undo(h, 'b')!
    const forward = redo(back.history, back.snapshot)!
    // A change right after the redo is a new edit; swallowing it would make
    // the next undo skip over the redone state entirely.
    h = record(forward.history, forward.snapshot, 1001)
    expect(undo(h, 'c')?.snapshot).toBe('b')
  })

  it('forgets the oldest edits rather than growing without bound', () => {
    let h = emptyHistory<number>()
    for (let i = 0; i < 80; i++) h = record(h, i, i * 10_000, { limit: 50 })
    expect(h.past).toHaveLength(50)
    expect(h.past[0].snapshot).toBe(30)
  })
})
