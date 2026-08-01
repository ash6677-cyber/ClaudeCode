import { create } from 'zustand'

import { lorebookRepo } from '@/lib/db/repositories'
import type { Lorebook, LorebookEntry } from '@/types'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type LorebookEntryInput = Omit<LorebookEntry, 'id'>

interface LorebookStoreState {
  projectId: string | null
  lorebooks: Lorebook[]
  status: LoadStatus
  error: string | null

  loadProject: (projectId: string) => Promise<void>
  createLorebook: (name: string) => Promise<Lorebook>
  renameLorebook: (id: string, name: string) => Promise<void>
  deleteLorebook: (id: string) => Promise<void>

  addEntry: (lorebookId: string, input: LorebookEntryInput) => Promise<void>
  updateEntry: (lorebookId: string, entryId: string, input: LorebookEntryInput) => Promise<void>
  removeEntry: (lorebookId: string, entryId: string) => Promise<void>
}

export const useLorebookStore = create<LorebookStoreState>((set, get) => ({
  projectId: null,
  lorebooks: [],
  status: 'idle',
  error: null,

  loadProject: async (projectId) => {
    set({ status: 'loading', error: null, projectId })
    try {
      const all = await lorebookRepo.list()
      const lorebooks = all
        .filter((l) => l.projectId === projectId)
        .sort((a, b) => a.name.localeCompare(b.name))
      set({ lorebooks, status: 'ready' })
    } catch {
      set({ status: 'error', error: 'Could not load lorebooks from local storage.' })
    }
  },

  createLorebook: async (name) => {
    const { projectId, lorebooks } = get()
    if (!projectId) throw new Error('No active project')
    const lorebook = await lorebookRepo.create({ projectId, name, entries: [] })
    set({ lorebooks: [...lorebooks, lorebook].sort((a, b) => a.name.localeCompare(b.name)) })
    return lorebook
  },

  renameLorebook: async (id, name) => {
    await lorebookRepo.update(id, { name })
    set({
      lorebooks: get()
        .lorebooks.map((l) => (l.id === id ? { ...l, name } : l))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })
  },

  deleteLorebook: async (id) => {
    await lorebookRepo.remove(id)
    set({ lorebooks: get().lorebooks.filter((l) => l.id !== id) })
  },

  addEntry: async (lorebookId, input) => {
    const lorebook = get().lorebooks.find((l) => l.id === lorebookId)
    if (!lorebook) return
    const entry: LorebookEntry = { ...input, id: crypto.randomUUID() }
    const entries = [...lorebook.entries, entry]
    await lorebookRepo.update(lorebookId, { entries })
    set({
      lorebooks: get().lorebooks.map((l) => (l.id === lorebookId ? { ...l, entries } : l)),
    })
  },

  updateEntry: async (lorebookId, entryId, input) => {
    const lorebook = get().lorebooks.find((l) => l.id === lorebookId)
    if (!lorebook) return
    const entries = lorebook.entries.map((e) => (e.id === entryId ? { ...input, id: entryId } : e))
    await lorebookRepo.update(lorebookId, { entries })
    set({
      lorebooks: get().lorebooks.map((l) => (l.id === lorebookId ? { ...l, entries } : l)),
    })
  },

  removeEntry: async (lorebookId, entryId) => {
    const lorebook = get().lorebooks.find((l) => l.id === lorebookId)
    if (!lorebook) return
    const entries = lorebook.entries.filter((e) => e.id !== entryId)
    await lorebookRepo.update(lorebookId, { entries })
    set({
      lorebooks: get().lorebooks.map((l) => (l.id === lorebookId ? { ...l, entries } : l)),
    })
  },
}))
