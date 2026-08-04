import { describe, expect, it } from 'vitest'

import {
  contextItem,
  excluded,
  makePlan,
  omittedItems,
  sentItems,
  trimToTokens,
} from './context-plan'
import { estimateTokens } from './token-estimate'

describe('a context plan', () => {
  it('separates what will be sent from what will not', () => {
    const plan = makePlan([
      contextItem('a', 'Character', 'Mira is a salt trader.'),
      excluded('b', 'Sea lore', 'The tide runs east.', 'No keyword in the recent conversation.'),
    ])
    expect(sentItems(plan).map((i) => i.id)).toEqual(['a'])
    expect(omittedItems(plan).map((i) => i.id)).toEqual(['b'])
  })

  it('counts the two sides separately', () => {
    // The size of what the model will not know is a number worth seeing.
    const kept = contextItem('a', 'A', 'one two three four five')
    const dropped = excluded('b', 'B', 'six seven eight', 'over budget')
    const plan = makePlan([kept, dropped])
    expect(plan.includedTokens).toBe(kept.tokens)
    expect(plan.excludedTokens).toBe(dropped.tokens)
  })

  it('counts a trimmed item as sent, because it is', () => {
    const plan = makePlan([
      contextItem('a', 'A', 'kept', { outcome: 'trimmed', reason: 'Cut at the budget.' }),
    ])
    expect(plan.includedTokens).toBeGreaterThan(0)
    expect(plan.excludedTokens).toBe(0)
    expect(sentItems(plan)).toHaveLength(1)
  })

  it('is empty rather than undefined when nothing was considered', () => {
    expect(makePlan([])).toEqual({ items: [], includedTokens: 0, excludedTokens: 0 })
  })
})

describe('trimToTokens', () => {
  it('leaves text that already fits completely alone', () => {
    const text = 'A short line.'
    expect(trimToTokens(text, 100)).toEqual({ text, trimmed: false })
  })

  it('cuts to roughly the budget and says that it did', () => {
    const text = 'word '.repeat(400)
    const result = trimToTokens(text, 20)
    expect(result.trimmed).toBe(true)
    expect(estimateTokens(result.text)).toBeLessThanOrEqual(30)
  })

  it('cuts on a word rather than through one', () => {
    const result = trimToTokens('alpha bravo charlie delta echo foxtrot golf hotel', 4)
    expect(result.text.endsWith(' ')).toBe(false)
    // Whatever survived, it is whole words.
    for (const word of result.text.split(' ')) {
      expect('alpha bravo charlie delta echo foxtrot golf hotel').toContain(word)
    }
  })

  it('treats a budget of zero as "nothing fits", and says so', () => {
    expect(trimToTokens('anything', 0)).toEqual({ text: '', trimmed: true })
    expect(trimToTokens('', 0)).toEqual({ text: '', trimmed: false })
  })
})
