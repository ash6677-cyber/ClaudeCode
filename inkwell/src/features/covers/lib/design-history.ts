/**
 * Undo for the Cover Studio.
 *
 * Session-only on purpose: the design itself is saved continuously, so what
 * undo protects is not the file but the last few minutes of judgement — "that
 * scrim was better before" — and judgement from a previous session is not
 * recoverable by popping a stack anyway.
 *
 * The one real subtlety is coalescing. Dragging the picture writes the crop
 * on every pointer move, and a stack that recorded each of them would give
 * undo the granularity of a film run backwards one frame at a time. So a
 * change arriving hot on the heels of the last one is treated as the same
 * gesture: the state from before the gesture is already on the stack, and
 * that is the state undo should return to.
 */

export interface HistoryEntry<T> {
  at: number
  snapshot: T
}

export interface DesignHistory<T> {
  past: HistoryEntry<T>[]
  future: T[]
}

export const HISTORY_LIMIT = 50
/** Changes closer together than this are one gesture, not two edits. */
export const COALESCE_MS = 800

export function emptyHistory<T>(): DesignHistory<T> {
  return { past: [], future: [] }
}

/**
 * Remembers what the design looked like before a change.
 *
 * Called with the *previous* state, at the moment of the change. A change
 * also makes the future unreachable — redo after a new edit would graft an
 * abandoned branch onto a design it never belonged to.
 */
export function record<T>(
  history: DesignHistory<T>,
  before: T,
  now: number,
  options: { limit?: number; coalesceMs?: number } = {},
): DesignHistory<T> {
  const limit = options.limit ?? HISTORY_LIMIT
  const coalesceMs = options.coalesceMs ?? COALESCE_MS

  const last = history.past[history.past.length - 1]
  if (last && now - last.at < coalesceMs) {
    // Same gesture. Its opening state is already recorded; only the clock
    // moves, so a long slow drag stays one gesture rather than becoming
    // several once it outlives the window.
    return {
      past: [...history.past.slice(0, -1), { ...last, at: now }],
      future: [],
    }
  }

  const past = [...history.past, { at: now, snapshot: before }]
  return { past: past.slice(Math.max(0, past.length - limit)), future: [] }
}

export function undo<T>(
  history: DesignHistory<T>,
  current: T,
): { history: DesignHistory<T>; snapshot: T } | null {
  const last = history.past[history.past.length - 1]
  if (!last) return null
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, current] },
    snapshot: last.snapshot,
  }
}

export function redo<T>(
  history: DesignHistory<T>,
  current: T,
): { history: DesignHistory<T>; snapshot: T } | null {
  const next = history.future[history.future.length - 1]
  if (next === undefined) return null
  return {
    history: {
      // Restored with `at: 0` so the next real change never coalesces into
      // an entry that a redo created — they are different edits by definition.
      past: [...history.past, { at: 0, snapshot: current }],
      future: history.future.slice(0, -1),
    },
    snapshot: next,
  }
}
