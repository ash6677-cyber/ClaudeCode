/**
 * Word-level diff between two drafts of a scene.
 *
 * Snapshots have always been saved and listed, but the only thing you could
 * do with one was restore it — which meant restoring blind, because nothing
 * showed what was about to be thrown away. This answers the question a writer
 * actually asks of an old version: what is different?
 *
 * Diffed by word rather than by character or by line. Characters produce
 * unreadable confetti inside a rewritten sentence; lines mark a whole
 * paragraph changed because one adjective moved. Words are the unit prose is
 * revised in, so they are the unit the marks should use.
 *
 * Pure, and tested as such — no editor, no DOM.
 */

export type DiffKind = 'same' | 'added' | 'removed'

export interface DiffPart {
  kind: DiffKind
  /** The words, joined back into readable text including their spacing. */
  text: string
}

export interface DiffSummary {
  wordsAdded: number
  wordsRemoved: number
  /** True when the two drafts are word-for-word identical. */
  unchanged: boolean
}

/**
 * Splits into words while keeping the whitespace attached.
 *
 * Each token carries its own trailing space, so the parts can be concatenated
 * straight back into prose. Splitting the spacing out separately means every
 * gap becomes its own token to diff, which doubles the work and produces
 * marks around invisible things.
 */
export function tokenise(text: string): string[] {
  return text.match(/\S+\s*/g) ?? []
}

/** Compares tokens ignoring the trailing space, so a reflow isn't an edit. */
function sameWord(a: string, b: string): boolean {
  return a.trimEnd() === b.trimEnd()
}

/**
 * Longest common subsequence, in linear space.
 *
 * A scene runs to a couple of thousand words, and the full O(n·m) table for
 * two of them is millions of cells held at once. Hirschberg's divide and
 * conquer gets the same alignment in O(min(n,m)) space, which is what keeps
 * this safe to run on a long chapter without the tab going pale.
 */
function lcsLengths(a: string[], b: string[]): number[] {
  const row = new Array<number>(b.length + 1).fill(0)
  for (const token of a) {
    let previousDiagonal = 0
    for (let j = 0; j < b.length; j++) {
      const previousRow = row[j + 1]
      row[j + 1] = sameWord(token, b[j])
        ? previousDiagonal + 1
        : Math.max(row[j + 1], row[j])
      previousDiagonal = previousRow
    }
  }
  return row
}

/** Indices of `a` and `b` that align, as pairs, via Hirschberg. */
function align(a: string[], b: string[], offsetA: number, offsetB: number, out: [number, number][]) {
  if (a.length === 0 || b.length === 0) return

  if (a.length === 1) {
    const index = b.findIndex((token) => sameWord(token, a[0]))
    if (index !== -1) out.push([offsetA, offsetB + index])
    return
  }

  const mid = Math.floor(a.length / 2)
  const left = lcsLengths(a.slice(0, mid), b)
  const right = lcsLengths(a.slice(mid).reverse(), [...b].reverse())

  let best = 0
  let bestSplit = 0
  for (let j = 0; j <= b.length; j++) {
    const total = left[j] + right[b.length - j]
    if (total > best) {
      best = total
      bestSplit = j
    }
  }

  align(a.slice(0, mid), b.slice(0, bestSplit), offsetA, offsetB, out)
  align(a.slice(mid), b.slice(bestSplit), offsetA + mid, offsetB + bestSplit, out)
}

/**
 * The change from `before` to `after`, as a run of parts in reading order.
 *
 * Consecutive parts of the same kind are merged, so a rewritten sentence is
 * one removal followed by one addition rather than forty of each.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenise(before)
  const b = tokenise(after)

  const pairs: [number, number][] = []
  align(a, b, 0, 0, pairs)

  const parts: DiffPart[] = []
  const push = (kind: DiffKind, text: string) => {
    if (!text) return
    const last = parts[parts.length - 1]
    if (last && last.kind === kind) last.text += text
    else parts.push({ kind, text })
  }

  let i = 0
  let j = 0
  for (const [ai, bj] of pairs) {
    push('removed', a.slice(i, ai).join(''))
    push('added', b.slice(j, bj).join(''))
    // The matched token is taken from `after`, so the surviving text carries
    // the newer spacing and reassembles into the current draft exactly.
    push('same', b[bj])
    i = ai + 1
    j = bj + 1
  }
  push('removed', a.slice(i).join(''))
  push('added', b.slice(j).join(''))

  return parts
}

export function summariseDiff(parts: DiffPart[]): DiffSummary {
  let wordsAdded = 0
  let wordsRemoved = 0
  for (const part of parts) {
    const words = tokenise(part.text).length
    if (part.kind === 'added') wordsAdded += words
    if (part.kind === 'removed') wordsRemoved += words
  }
  return { wordsAdded, wordsRemoved, unchanged: wordsAdded === 0 && wordsRemoved === 0 }
}
