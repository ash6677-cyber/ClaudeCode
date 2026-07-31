import type { TableLike } from '@/lib/db/repository'
import type { BaseEntity } from '@/types'

export type LocalChangeKind = 'upsert' | 'delete'

export type LocalChangeListener = (
  table: string,
  id: string,
  kind: LocalChangeKind,
) => void

/**
 * Wraps a table so every local mutation is reported to the sync engine,
 * without any store or repository needing to know sync exists.
 *
 * Remote changes are deliberately applied to the *underlying* table rather
 * than through this wrapper, so an incoming update never gets re-queued as
 * an outgoing one. That's what keeps the two directions from echoing each
 * other indefinitely — no suppression flags or sequence numbers required.
 */
export function createSyncedTable<T extends BaseEntity>(
  name: string,
  inner: TableLike<T>,
  onLocalChange: LocalChangeListener,
): TableLike<T> {
  return {
    toArray: () => inner.toArray(),
    get: (id) => inner.get(id),

    async add(entity) {
      const result = await inner.add(entity)
      onLocalChange(name, entity.id, 'upsert')
      return result
    },

    async update(id, changes) {
      const result = await inner.update(id, changes)
      onLocalChange(name, id, 'upsert')
      return result
    },

    async delete(id) {
      const result = await inner.delete(id)
      onLocalChange(name, id, 'delete')
      return result
    },

    async bulkDelete(ids) {
      const result = await inner.bulkDelete(ids)
      for (const id of ids) onLocalChange(name, id, 'delete')
      return result
    },
  }
}
