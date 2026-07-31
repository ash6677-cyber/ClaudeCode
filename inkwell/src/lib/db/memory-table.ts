import type { TableLike } from './repository'

/** In-memory Map-backed table satisfying the same minimal interface Dexie's
 * EntityTable does, so `createRepository` can't tell the difference. Every
 * mutation calls `onChange` so the caller can schedule a debounced disk save. */
export class MemoryTable<T extends { id: string }> implements TableLike<T> {
  private readonly store: Map<string, T>
  private readonly onChange: () => void

  constructor(store: Map<string, T>, onChange: () => void) {
    this.store = store
    this.onChange = onChange
  }

  async toArray(): Promise<T[]> {
    return Array.from(this.store.values())
  }

  async get(id: string): Promise<T | undefined> {
    return this.store.get(id)
  }

  async add(entity: T): Promise<unknown> {
    this.store.set(entity.id, entity)
    this.onChange()
    return entity.id
  }

  async update(id: string, changes: Partial<T>): Promise<unknown> {
    const existing = this.store.get(id)
    if (!existing) return 0
    this.store.set(id, { ...existing, ...changes })
    this.onChange()
    return 1
  }

  async delete(id: string): Promise<unknown> {
    const existed = this.store.delete(id)
    if (existed) this.onChange()
    return undefined
  }

  async bulkDelete(ids: string[]): Promise<unknown> {
    let changed = false
    for (const id of ids) changed = this.store.delete(id) || changed
    if (changed) this.onChange()
    return undefined
  }
}
