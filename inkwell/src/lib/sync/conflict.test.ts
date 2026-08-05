import { describe, expect, it } from 'vitest'

import { conflictLabel, isConflictSnapshot, localTextWouldBeLost } from './conflict'
import type { Scene, Snapshot } from '@/types'

const scene = (plainText: string) => ({ plainText }) as Pick<Scene, 'plainText'>

describe('localTextWouldBeLost', () => {
  it('is true when the incoming text says something different', () => {
    // Two pages written on a laptop, two different ones on a phone. One side
    // is about to vanish, and this is the only chance to keep it.
    expect(localTextWouldBeLost(scene('Mira crossed the bridge.'), 'Mira waited.')).toBe(true)
  })

  it('is false when the two agree', () => {
    expect(localTextWouldBeLost(scene('Same words.'), 'Same words.')).toBe(false)
  })

  it('ignores surrounding whitespace, which is not a lost paragraph', () => {
    expect(localTextWouldBeLost(scene('  Same words. '), 'Same words.')).toBe(false)
  })

  it('is false for an empty local scene', () => {
    // Nothing to lose, and a blank snapshot on every sync would bury the ones
    // that matter.
    expect(localTextWouldBeLost(scene(''), 'Anything')).toBe(false)
    expect(localTextWouldBeLost(scene('   '), 'Anything')).toBe(false)
  })

  it('is false when there is no local scene at all', () => {
    expect(localTextWouldBeLost(undefined, 'Anything')).toBe(false)
  })

  it('is true when the incoming copy has no usable text', () => {
    // A remote row that arrives blank or malformed would erase real words.
    expect(localTextWouldBeLost(scene('Real words.'), '')).toBe(true)
    expect(localTextWouldBeLost(scene('Real words.'), undefined)).toBe(true)
    expect(localTextWouldBeLost(scene('Real words.'), 42)).toBe(true)
  })
})

describe('the conflict label', () => {
  it('says where it came from and when', () => {
    const label = conflictLabel(new Date(2026, 4, 20, 14, 5))
    expect(label).toMatch(/another device/i)
    expect(label).toMatch(/20/)
  })

  it('is recognisable again afterwards, which is what protects it', () => {
    expect(isConflictSnapshot({ label: conflictLabel() } as Snapshot)).toBe(true)
    expect(isConflictSnapshot({ label: 'Autosave' } as Snapshot)).toBe(false)
    expect(isConflictSnapshot({ label: 'Before AI rewrite' } as Snapshot)).toBe(false)
  })
})
