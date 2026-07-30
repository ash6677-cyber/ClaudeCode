import type { EntityTable } from 'dexie'
import type { BaseEntity } from '@/types'

/**
 * Typed CRUD wrapper around a Dexie table. UI code and stores should only
 * ever talk to the app through repositories like this one — never to Dexie
 * directly — so persistence can change later without touching feature code.
 */
export function createRepository<T extends BaseEntity>(table: EntityTable<T, 'id'>) {
  return {
    async list(): Promise<T[]> {
      return table.toArray()
    },
    async get(id: string): Promise<T | undefined> {
      // Dexie's IDType<T, 'id'> can't be proven equal to `string` for a generic T,
      // even though every BaseEntity's id is a string at runtime.
      return table.get(id as never)
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
      await table.update(id as never, { ...changes, updatedAt: Date.now() } as never)
    },
    async remove(id: string): Promise<void> {
      await table.delete(id as never)
    },
    async bulkRemove(ids: string[]): Promise<void> {
      await table.bulkDelete(ids as never[])
    },
  }
}

export type Repository<T extends BaseEntity> = ReturnType<typeof createRepository<T>>
