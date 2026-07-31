import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'

import type { TableLike } from '@/lib/db/repository'
import { firestore } from '@/lib/firebase/config'
import { decodeEntity, encodeEntity, isTombstone, tombstoneFor } from '@/lib/sync/entity-codec'
import type { LocalChangeKind } from '@/lib/sync/synced-table'
import type { BaseEntity } from '@/types'

/**
 * Every table that participates in cloud sync.
 *
 * `aiProviders` is deliberately absent: those records hold the user's raw
 * provider API keys. Keys stay on the device that entered them — syncing
 * them would copy live credentials into a database, which is a materially
 * different security promise than syncing manuscripts.
 */
export const SYNCED_TABLES = [
  'projects',
  'series',
  'chapters',
  'scenes',
  'snapshots',
  'codexEntries',
  'characterCards',
  'cardChats',
  'personas',
  'lorebooks',
  'covers',
  'aiPresets',
  'imageAssets',
  'goals',
  'sessionLogs',
] as const

export type SyncedTableName = (typeof SYNCED_TABLES)[number]

export type SyncStatus = 'off' | 'connecting' | 'syncing' | 'idle' | 'error'

export interface SyncSnapshot {
  status: SyncStatus
  lastSyncedAt: number | null
  pendingCount: number
  error: string | null
}

type AnyTable = TableLike<BaseEntity>

const PUSH_DEBOUNCE_MS = 800
/** Firestore hard-caps a batch at 500 writes; stay under it with margin. */
const BATCH_LIMIT = 400

function isSyncedTable(name: string): name is SyncedTableName {
  return (SYNCED_TABLES as readonly string[]).includes(name)
}

class SyncEngine {
  private uid: string | null = null
  private readonly tables = new Map<SyncedTableName, AnyTable>()
  private readonly pending = new Map<SyncedTableName, Map<string, LocalChangeKind>>()
  private unsubscribes: Unsubscribe[] = []
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<(snapshot: SyncSnapshot) => void>()
  private remoteListeners = new Set<(tables: SyncedTableName[]) => void>()
  private remoteTouched = new Set<SyncedTableName>()
  private remoteNotifyTimer: ReturnType<typeof setTimeout> | null = null
  private state: SyncSnapshot = {
    status: 'off',
    lastSyncedAt: null,
    pendingCount: 0,
    error: null,
  }

  /** Registers the *raw* (unwrapped) table so remote changes can be applied
   * without being re-queued as local ones. */
  registerTable(name: string, table: AnyTable) {
    if (isSyncedTable(name)) this.tables.set(name, table)
  }

  subscribe(listener: (snapshot: SyncSnapshot) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): SyncSnapshot {
    return this.state
  }

  /**
   * Fires after remote changes have been written into local storage.
   *
   * Stores keep their own in-memory copy loaded through repositories, so
   * writing straight to the table is invisible to them — without this, a
   * synced project would sit in IndexedDB while the UI kept showing the
   * stale list until the next remount. Batched, because one remote save
   * commonly lands as several document events.
   */
  onRemoteApplied(listener: (tables: SyncedTableName[]) => void): () => void {
    this.remoteListeners.add(listener)
    return () => this.remoteListeners.delete(listener)
  }

  private markRemoteApplied(table: SyncedTableName) {
    this.remoteTouched.add(table)
    if (this.remoteNotifyTimer) clearTimeout(this.remoteNotifyTimer)
    this.remoteNotifyTimer = setTimeout(() => {
      this.remoteNotifyTimer = null
      const tables = [...this.remoteTouched]
      this.remoteTouched.clear()
      if (tables.length === 0) return
      for (const listener of this.remoteListeners) listener(tables)
    }, 250)
  }

  private setState(patch: Partial<SyncSnapshot>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener(this.state)
  }

  private countPending(): number {
    let total = 0
    for (const ids of this.pending.values()) total += ids.size
    return total
  }

  notifyLocalChange(table: string, id: string, kind: LocalChangeKind) {
    if (!this.uid || !isSyncedTable(table)) return
    let forTable = this.pending.get(table)
    if (!forTable) {
      forTable = new Map()
      this.pending.set(table, forTable)
    }
    forTable.set(id, kind)
    this.setState({ pendingCount: this.countPending() })
    this.schedulePush()
  }

  private schedulePush() {
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null
      void this.flush()
    }, PUSH_DEBOUNCE_MS)
  }

  async start(uid: string) {
    if (this.uid === uid) return
    this.stop()
    this.uid = uid
    this.setState({ status: 'connecting', error: null })
    try {
      await this.reconcile()
      this.listenForRemoteChanges()
      this.setState({ status: 'idle', lastSyncedAt: Date.now(), error: null })
    } catch (err) {
      this.setState({ status: 'error', error: describeSyncError(err) })
    }
  }

  stop() {
    for (const unsubscribe of this.unsubscribes) unsubscribe()
    this.unsubscribes = []
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }
    if (this.remoteNotifyTimer) {
      clearTimeout(this.remoteNotifyTimer)
      this.remoteNotifyTimer = null
    }
    this.remoteTouched.clear()
    this.pending.clear()
    this.uid = null
    this.setState({ status: 'off', pendingCount: 0, error: null, lastSyncedAt: null })
  }

  /** Forces an immediate reconcile — used by the "Sync now" button. */
  async syncNow() {
    if (!this.uid) return
    this.setState({ status: 'syncing', error: null })
    try {
      await this.flush()
      await this.reconcile()
      this.setState({ status: 'idle', lastSyncedAt: Date.now(), error: null })
    } catch (err) {
      this.setState({ status: 'error', error: describeSyncError(err) })
    }
  }

  private remoteCollection(table: SyncedTableName) {
    return collection(firestore, 'users', this.uid!, table)
  }

  /**
   * Two-way merge on connect. For every id present locally, remotely, or
   * both, the copy with the newer `updatedAt` wins — the same rule in both
   * directions, so it doesn't matter which device connects first. Ties keep
   * the remote copy, which makes the operation idempotent.
   */
  private async reconcile() {
    this.setState({ status: 'syncing' })

    for (const table of SYNCED_TABLES) {
      const localTable = this.tables.get(table)
      if (!localTable) continue

      const [remoteDocs, localEntities] = await Promise.all([
        getDocs(this.remoteCollection(table)),
        localTable.toArray(),
      ])

      const localById = new Map(localEntities.map((entity) => [entity.id, entity]))
      const remoteById = new Map<string, Record<string, unknown>>()
      for (const snapshot of remoteDocs.docs) {
        remoteById.set(snapshot.id, snapshot.data() as Record<string, unknown>)
      }

      const toPushIds: string[] = []

      for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
        const local = localById.get(id)
        const remote = remoteById.get(id)

        if (local && !remote) {
          toPushIds.push(id)
          continue
        }
        if (!local && remote) {
          if (!isTombstone(remote)) await this.applyRemote(table, id, remote)
          continue
        }
        if (!local || !remote) continue

        const remoteUpdatedAt = typeof remote.updatedAt === 'number' ? remote.updatedAt : 0
        if (remoteUpdatedAt >= local.updatedAt) {
          if (isTombstone(remote)) {
            await localTable.delete(id)
            this.markRemoteApplied(table)
          } else {
            await this.applyRemote(table, id, remote)
          }
        } else {
          toPushIds.push(id)
        }
      }

      if (toPushIds.length > 0) await this.pushEntities(table, toPushIds)
    }
  }

  /** Writes a remote entity into local storage via the raw table, so it is
   * never mistaken for a local edit and pushed straight back. */
  private async applyRemote(
    table: SyncedTableName,
    id: string,
    remoteDoc: Record<string, unknown>,
  ) {
    const localTable = this.tables.get(table)
    if (!localTable) return

    let chunks: string[] = []
    if (remoteDoc._chunked) {
      const chunkDocs = await getDocs(
        collection(firestore, 'users', this.uid!, table, id, 'chunks'),
      )
      chunks = chunkDocs.docs
        .map((snapshot) => ({
          index: Number(snapshot.id),
          data: String((snapshot.data() as { data?: string }).data ?? ''),
        }))
        .sort((a, b) => a.index - b.index)
        .map((chunk) => chunk.data)
    }

    const entity = decodeEntity(table, remoteDoc, chunks)
    const existing = await localTable.get(id)
    if (existing) await localTable.update(id, entity)
    else await localTable.add(entity)
    this.markRemoteApplied(table)
  }

  private async pushEntities(table: SyncedTableName, ids: string[]) {
    const localTable = this.tables.get(table)
    if (!localTable || !this.uid) return

    let batch = writeBatch(firestore)
    let batched = 0

    for (const id of ids) {
      const entity = await localTable.get(id)
      if (!entity) continue

      const { doc: encoded, chunks } = await encodeEntity(table, entity)
      const ref = doc(firestore, 'users', this.uid, table, id)

      if (chunks.length > 0) {
        // Chunked payloads are written outside the batch: a single large
        // asset can exceed the batch's own size budget on its own.
        await setDoc(ref, encoded)
        await Promise.all(
          chunks.map((data, index) =>
            setDoc(doc(firestore, 'users', this.uid!, table, id, 'chunks', String(index)), {
              data,
            }),
          ),
        )
        continue
      }

      batch.set(ref, encoded)
      batched += 1
      if (batched >= BATCH_LIMIT) {
        await batch.commit()
        batch = writeBatch(firestore)
        batched = 0
      }
    }

    if (batched > 0) await batch.commit()
  }

  private async flush() {
    if (!this.uid || this.pending.size === 0) return

    const work = new Map(this.pending)
    this.pending.clear()
    this.setState({ status: 'syncing', pendingCount: 0 })

    try {
      for (const [table, ids] of work) {
        const upserts: string[] = []
        const deletes: string[] = []
        for (const [id, kind] of ids) {
          if (kind === 'delete') deletes.push(id)
          else upserts.push(id)
        }

        if (upserts.length > 0) await this.pushEntities(table, upserts)

        for (const id of deletes) {
          // Soft-delete: a hard delete would be indistinguishable from
          // "this device hasn't uploaded it yet", and the record would come
          // straight back on the next reconcile from another device.
          await setDoc(doc(firestore, 'users', this.uid, table, id), tombstoneFor(id))
        }
      }
      this.setState({ status: 'idle', lastSyncedAt: Date.now(), error: null })
    } catch (err) {
      // Re-queue so nothing is silently dropped; Firestore's own offline
      // queue covers connectivity blips, this covers everything else.
      for (const [table, ids] of work) {
        const existing = this.pending.get(table) ?? new Map<string, LocalChangeKind>()
        for (const [id, kind] of ids) if (!existing.has(id)) existing.set(id, kind)
        this.pending.set(table, existing)
      }
      this.setState({
        status: 'error',
        error: describeSyncError(err),
        pendingCount: this.countPending(),
      })
    }
  }

  private listenForRemoteChanges() {
    for (const table of SYNCED_TABLES) {
      if (!this.tables.has(table)) continue
      const unsubscribe = onSnapshot(
        this.remoteCollection(table),
        (snapshot) => {
          void (async () => {
            for (const change of snapshot.docChanges()) {
              // Skip our own writes that haven't round-tripped yet — the
              // local copy is already the source of this event.
              if (change.doc.metadata.hasPendingWrites) continue
              await this.applyRemoteChange(table, change.doc.id, change.doc.data())
            }
          })()
        },
        (err) => this.setState({ status: 'error', error: describeSyncError(err) }),
      )
      this.unsubscribes.push(unsubscribe)
    }
  }

  private async applyRemoteChange(
    table: SyncedTableName,
    id: string,
    data: Record<string, unknown>,
  ) {
    const localTable = this.tables.get(table)
    if (!localTable) return

    const local = await localTable.get(id)
    const remoteUpdatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : 0
    if (local && remoteUpdatedAt < local.updatedAt) return

    if (isTombstone(data)) {
      if (local) {
        await localTable.delete(id)
        this.markRemoteApplied(table)
      }
      return
    }
    await this.applyRemote(table, id, data)
    this.setState({ lastSyncedAt: Date.now() })
  }
}

function describeSyncError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  if (code.includes('permission-denied')) {
    return 'Sync was denied by the server. Check that Firestore security rules are deployed.'
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return 'Can’t reach the sync server. Your work is saved locally and will sync when you’re back online.'
  }
  if (code.includes('failed-precondition')) {
    return 'Cloud sync needs a Firestore database to be created for this Firebase project.'
  }
  return 'Sync hit an unexpected problem. Your work is safe locally.'
}

export const syncEngine = new SyncEngine()
