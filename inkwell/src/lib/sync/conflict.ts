import type { Scene, Snapshot } from '@/types'

/**
 * Never losing a paragraph to another device.
 *
 * Sync resolves by `updatedAt`: the newer copy wins. That rule is simple,
 * symmetric and idempotent, which is why it is the right rule — but it has
 * one intolerable consequence. Write two pages on a laptop, write a different
 * two on a phone, and the older side is overwritten with no trace. The words
 * are simply gone, and nothing ever told the writer they existed.
 *
 * So before a remote scene overwrites a local one that says something
 * different, the local text is kept as a snapshot. The scene still resolves
 * the same way — sync is not being made cleverer — but the losing side lands
 * in the history the writer already knows how to read.
 */

const CONFLICT_PREFIX = 'Conflicting edit'

/**
 * Whether the local copy is about to lose words.
 *
 * Deliberately not real conflict detection. Without version vectors there is
 * no way to know whether the local copy is a diverged branch or simply an
 * older ancestor this device never edited — and the difference is invisible
 * from here. So the test is the one thing that can be known for certain: the
 * local text differs from the text that is about to replace it. Keeping an
 * ancestor unnecessarily costs one snapshot; discarding a divergence costs
 * someone's afternoon.
 */
export function localTextWouldBeLost(
  local: Pick<Scene, 'plainText'> | undefined,
  remotePlainText: unknown,
): boolean {
  if (!local) return false
  const mine = (local.plainText ?? '').trim()
  // An empty local scene has nothing to lose, and preserving blank snapshots
  // on every sync would bury the ones that matter.
  if (!mine) return false
  const theirs = typeof remotePlainText === 'string' ? remotePlainText.trim() : ''
  return mine !== theirs
}

/** The label these snapshots carry, so history can single them out. */
export function conflictLabel(at: Date = new Date()): string {
  const when = at.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${CONFLICT_PREFIX} from another device · ${when}`
}

export function isConflictSnapshot(snapshot: Pick<Snapshot, 'label'>): boolean {
  return snapshot.label.startsWith(CONFLICT_PREFIX)
}
