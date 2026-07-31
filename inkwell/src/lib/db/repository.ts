import type { BaseEntity } from '@/types'

/** Minimal table shape `createRepository` needs — satisfied structurally by
 * both a real Dexie `EntityTable` and the in-memory `MemoryTable` used by the
 * desktop shell, so the same repository code works against either backend. */
export interface TableLike<T> {
  toArray(): Promise<T[]>
  get(id: string): Promise<T | undefined>
  add(entity: T): Promise<unknown>
  update(id: string, changes: Partial<T>): Promise<unknown>
  delete(id: string): Promise<unknown>
  bulkDelete(ids: string[]): Promise<unknown>
}

/**
 * Typed CRUD wrapper around a table. UI code and stores should only ever
 * talk to the app through repositories like this one — never to the
 * underlying storage directly — so persistence can change (as it does
 * between the browser build's IndexedDB and the desktop build's disk-backed
 * store) without touching feature code.
 */
export function createRepository<T extends BaseEntity>(table: TableLike<T>) {
  return {
    async list(): Promise<T[]> {
      return table.toArray()
    },
    async get(id: string): Promise<T | undefined> {
      return table.get(id)
    },
    async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
      const now = Date.now()
      const entity = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      } as T
      await table.add(entity)
      return entity
    },
    async update(id: string, changes: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<void> {
      await table.update(id, { ...changes, updatedAt: Date.now() } as Partial<T>)
    },
    async remove(id: string): Promise<void> {
      await table.delete(id)
    },
    async bulkRemove(ids: string[]): Promise<void> {
      await table.bulkDelete(ids)
    },
  }
}

export type Repository<T extends BaseEntity> = ReturnType<typeof createRepository<T>>
