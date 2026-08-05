import { snapshotsToSweep } from '@/lib/db/snapshot-retention'
import { db } from '@/lib/db/schema'

/**
 * Thins scene history to the retention policy, once a session.
 *
 * Deliberately a hard delete rather than a trip through the bin. These are
 * versions the policy has already decided are redundant — a scene still keeps
 * its newest, its dailies and its weeklies — and routing them through the bin
 * would fill it with thousands of records nobody will ever look at, burying
 * the deletions a writer actually wants to undo.
 */
export async function sweepSnapshots(now = Date.now()): Promise<number> {
  try {
    const all = await db.snapshots.toArray()
    const doomed = snapshotsToSweep(all, now)
    // `purge`, not `bulkDelete`: every table here is wrapped for soft
    // delete, so the ordinary delete would move a thousand redundant versions
    // into the bin rather than out of the library — using more room than
    // before and burying the deletions a writer actually wants to undo.
    if (doomed.length > 0) await db.snapshots.purge(doomed)
    return doomed.length
  } catch {
    // Housekeeping. A failure here must never stop the app from opening.
    return 0
  }
}
