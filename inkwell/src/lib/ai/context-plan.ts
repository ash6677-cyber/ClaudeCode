import { estimateTokens } from './token-estimate'

/**
 * What the model is about to see, and what it isn't.
 *
 * A writer whose character "forgot" something has no way to find out why. The
 * answer is always in the prompt — an entry that didn't match a keyword, a
 * lorebook trimmed at a budget, a Codex entry set to never — but until now
 * none of that left the builder. Every feature assembled its own prompt and
 * reported, at best, a total token count.
 *
 * So the builders return this instead: every piece considered, whether it made
 * it in, and if not, why not in words a person can act on. Exclusions are the
 * whole point. A list of what *was* sent explains nothing about the thing that
 * is missing.
 */

export type ContextOutcome = 'included' | 'trimmed' | 'excluded'

export interface ContextItem {
  /** Stable within a plan, for React keys and tests. */
  id: string
  label: string
  /** What actually goes in the prompt — already trimmed if it was trimmed. */
  content: string
  tokens: number
  outcome: ContextOutcome
  /**
   * Why, in the writer's terms. Required for anything not simply included:
   * "no reason given" is the state this module exists to abolish.
   */
  reason?: string
  /** Where it came from — a lorebook's name, an Almanac entry, the preset. */
  source?: string
}

export interface ContextPlan {
  items: ContextItem[]
  /** Tokens that will actually be sent. */
  includedTokens: number
  /** Tokens considered and left out — the size of what the model won't know. */
  excludedTokens: number
}

export function contextItem(
  id: string,
  label: string,
  content: string,
  extra: Partial<Omit<ContextItem, 'id' | 'label' | 'content' | 'tokens'>> = {},
): ContextItem {
  return {
    id,
    label,
    content,
    tokens: estimateTokens(content),
    outcome: 'included',
    ...extra,
  }
}

/** An item that was considered and left out, with the reason it was. */
export function excluded(
  id: string,
  label: string,
  content: string,
  reason: string,
  source?: string,
): ContextItem {
  return { ...contextItem(id, label, content, { outcome: 'excluded', reason }), source }
}

export function makePlan(items: ContextItem[]): ContextPlan {
  let includedTokens = 0
  let excludedTokens = 0
  for (const item of items) {
    if (item.outcome === 'excluded') excludedTokens += item.tokens
    else includedTokens += item.tokens
  }
  return { items, includedTokens, excludedTokens }
}

/** Only what is actually going to be sent. */
export function sentItems(plan: ContextPlan): ContextItem[] {
  return plan.items.filter((i) => i.outcome !== 'excluded')
}

export function omittedItems(plan: ContextPlan): ContextItem[] {
  return plan.items.filter((i) => i.outcome === 'excluded')
}

/**
 * Trims text to roughly a token budget.
 *
 * Cuts on a word so the model is not handed half a word, and reports what the
 * trim cost — a silent truncation is exactly the kind of thing a writer would
 * otherwise blame on the character.
 */
export function trimToTokens(text: string, budget: number): { text: string; trimmed: boolean } {
  if (budget <= 0) return { text: '', trimmed: text.trim().length > 0 }
  if (estimateTokens(text) <= budget) return { text, trimmed: false }
  const approxChars = Math.max(0, Math.floor(budget * 4))
  const cut = text.slice(0, approxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return { text: (lastSpace > approxChars * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd(), trimmed: true }
}
