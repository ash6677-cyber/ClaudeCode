import { describe, expect, it } from 'vitest'

import { currentStreak, dailyTotals, wordsToday } from '@/stores/stats-store'
import type { SessionLog } from '@/types'

const ONE_DAY = 24 * 60 * 60 * 1000

function midnightToday(): number {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** A session that happened `daysAgo` days back, mid-morning so it sits
 * squarely inside its calendar day rather than on a boundary. */
function session(daysAgo: number, wordsWritten: number, projectId = 'p1'): SessionLog {
  const startedAt = midnightToday() - daysAgo * ONE_DAY + 9 * 60 * 60 * 1000
  return {
    id: `s-${daysAgo}-${projectId}-${wordsWritten}`,
    createdAt: startedAt,
    updatedAt: startedAt,
    projectId,
    wordsWritten,
    startedAt,
    endedAt: startedAt + 30 * 60 * 1000,
  }
}

describe('dailyTotals', () => {
  it('returns an unbroken axis of days, oldest first, zero-filled', () => {
    const totals = dailyTotals([session(0, 100), session(3, 250)], 5)

    expect(totals).toHaveLength(5)
    expect(totals.map((t) => t.words)).toEqual([0, 250, 0, 0, 100])
    // Strictly ascending, exactly one day apart.
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i].day - totals[i - 1].day).toBe(ONE_DAY)
    }
  })

  it('sums several sessions that fall on the same calendar day', () => {
    const totals = dailyTotals([session(1, 400), session(1, 350, 'p2'), session(1, 50)], 2)

    expect(totals[0].words).toBe(800)
    expect(totals[1].words).toBe(0)
  })

  it('scopes to a single project when one is given', () => {
    const sessions = [session(0, 400, 'p1'), session(0, 900, 'p2')]

    expect(wordsToday(dailyTotals(sessions, 7))).toBe(1300)
    expect(wordsToday(dailyTotals(sessions, 7, 'p1'))).toBe(400)
    expect(wordsToday(dailyTotals(sessions, 7, 'p2'))).toBe(900)
    expect(wordsToday(dailyTotals(sessions, 7, 'nobody'))).toBe(0)
  })

  it('ignores sessions older than the window', () => {
    expect(dailyTotals([session(40, 5000)], 30).every((t) => t.words === 0)).toBe(true)
  })
})

describe('currentStreak', () => {
  const target = 500

  it('counts consecutive target-meeting days ending today', () => {
    const totals = dailyTotals([session(0, 600), session(1, 500), session(2, 900)], 5)
    expect(currentStreak(totals, target)).toBe(3)
  })

  it('keeps the streak alive before you have written today', () => {
    // Nothing written today yet — yesterday is the anchor, so a writer
    // checking their stats over breakfast isn't told the streak is broken.
    const totals = dailyTotals([session(1, 700), session(2, 800)], 5)
    expect(currentStreak(totals, target)).toBe(2)
  })

  it('breaks on the first day that missed the target', () => {
    const totals = dailyTotals([session(0, 600), session(1, 100), session(2, 900)], 5)
    expect(currentStreak(totals, target)).toBe(1)
  })

  it('is zero when the most recent two days both missed', () => {
    const totals = dailyTotals([session(1, 100), session(2, 900)], 5)
    expect(currentStreak(totals, target)).toBe(0)
  })

  it('is zero with no target, however much was written', () => {
    const totals = dailyTotals([session(0, 5000), session(1, 5000)], 5)
    expect(currentStreak(totals, 0)).toBe(0)
  })

  it('is zero for an empty window', () => {
    expect(currentStreak([], target)).toBe(0)
  })

  it('counts every day when the whole window met the target', () => {
    const totals = dailyTotals(
      Array.from({ length: 5 }, (_, i) => session(i, 600)),
      5,
    )
    expect(currentStreak(totals, target)).toBe(5)
  })
})

describe('wordsToday', () => {
  it('reads the most recent bucket', () => {
    expect(wordsToday(dailyTotals([session(0, 120), session(1, 999)], 3))).toBe(120)
  })

  it('is zero for an empty window', () => {
    expect(wordsToday([])).toBe(0)
  })
})
