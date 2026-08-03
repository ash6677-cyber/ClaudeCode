/**
 * The bin.
 *
 * Deleting was permanent and immediate: `table.delete(id)` and the record was
 * gone. One misclick on a chapter took every scene in it, and the only way
 * back was a backup the writer may never have made. For an app whose whole
 * job is holding the only copy of someone's novel, that was the worst failure
 * mode in it.
 *
 * A delete now marks the record instead of removing it, and the record stops
 * appearing in every ordinary read. Nothing outside this file has to know:
 * the wrapper sits between the app and storage, so a store that calls
 * `db.scenes.toArray()` directly is covered exactly as one going through a
 * repository is.
 *
 * Wrapped *outside* the sync layer on purpose. A soft delete really is an
 * update, so it travels to other devices as one — which means restoring a
 * chapter restores it everywhere, rather than fighting a tombstone that a
 * hard delete would have broadcast.
 */

import type { BaseEntity } from '@/types'

import type { TableLike } from './repository'

/** How long a record stays recoverable before it is fair game to purge. */
export const BIN_RETENTION_DAYS = 30

export interface TrashableTable<T extends BaseEntity> extends TableLike<T> {
  /** Everything in the bin, including records swept up by a cascade. */
  listDeleted(): Promise<T[]>
  /** Reads a record whether or not it is in the bin. */
  getIncludingDeleted(id: string): Promise<T | undefined>
  /** Puts records in the bin, optionally attributing them to a root deletion. */
  softDelete(ids: string[], at: number, deletedWith: string | null): Promise<void>
  /** Takes records back out of the bin. */
  restore(ids: string[]): Promise<void>
  /** Removes records for good. No way back. */
  purge(ids: string[]): Promise<void>
}

export function isDeleted(entity: Pick<BaseEntity, 'deletedAt'>): boolean {
  return typeof entity.deletedAt === 'number'
}

export function createTrashableTable<T extends BaseEntity>(inner: TableLike<T>): TrashableTable<T> {
  return {
    async toArray() {
      return (await inner.toArray()).filter((entity) => !isDeleted(entity))
    },

    async get(id) {
      const entity = await inner.get(id)
      return entity && isDeleted(entity) ? undefined : entity
    },

    add: (entity) => inner.add(entity),
    update: (id, changes) => inner.update(id, changes),

    /**
     * The ordinary delete every existing caller already makes. It bins the
     * record rather than removing it, which is the whole point of this
     * wrapper: no call site had to change for deletes to become undoable.
     */
    async delete(id) {
      return inner.update(id, { deletedAt: Date.now(), deletedWith: null } as Partial<T>)
    },

    async bulkDelete(ids) {
      const at = Date.now()
      for (const id of ids) {
        await inner.update(id, { deletedAt: at, deletedWith: null } as Partial<T>)
      }
    },

    async listDeleted() {
      return (await inner.toArray()).filter(isDeleted)
    },

    getIncludingDeleted: (id) => inner.get(id),

    /**
     * A shared timestamp across everything one action removed, so a chapter
     * and its scenes go into the bin as one event and come back as one.
     */
    async softDelete(ids, at, deletedWith) {
      for (const id of ids) {
        await inner.update(id, { deletedAt: at, deletedWith } as Partial<T>)
      }
    },

    async restore(ids) {
      for (const id of ids) {
        await inner.update(id, { deletedAt: null, deletedWith: null } as Partial<T>)
      }
    },

    async purge(ids) {
      await inner.bulkDelete(ids)
    },
  }
}

/** Records in the bin long enough to be swept. */
export function expiredIds<T extends BaseEntity>(entities: T[], now: number): string[] {
  const cutoff = now - BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000
  return entities
    .filter((entity) => typeof entity.deletedAt === 'number' && entity.deletedAt < cutoff)
    .map((entity) => entity.id)
}
