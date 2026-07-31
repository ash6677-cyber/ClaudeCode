import { create } from 'zustand'

import { personaRepo } from '@/lib/db/repositories'
import type { Persona } from '@/types'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PersonaInput {
  name: string
  description: string
  avatarImageId: string | null
}

interface PersonaStoreState {
  personas: Persona[]
  status: LoadStatus

  loadAll: () => Promise<void>
  createPersona: (input: PersonaInput) => Promise<Persona>
  updatePersona: (id: string, input: PersonaInput) => Promise<void>
  deletePersona: (id: string) => Promise<void>
  setDefaultPersona: (id: string) => Promise<void>
}

export const usePersonaStore = create<PersonaStoreState>((set, get) => ({
  personas: [],
  status: 'idle',

  loadAll: async () => {
    if (get().status === 'loading' || get().status === 'ready') return
    set({ status: 'loading' })
    try {
      const personas = await personaRepo.list()
      set({ personas: personas.sort((a, b) => a.name.localeCompare(b.name)), status: 'ready' })
    } catch {
      set({ status: 'error' })
    }
  },

  createPersona: async (input) => {
    const isFirst = get().personas.length === 0
    const persona = await personaRepo.create({ ...input, isDefault: isFirst })
    set({ personas: [...get().personas, persona].sort((a, b) => a.name.localeCompare(b.name)) })
    return persona
  },

  updatePersona: async (id, input) => {
    await personaRepo.update(id, input)
    set({
      personas: get()
        .personas.map((p) => (p.id === id ? { ...p, ...input } : p))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })
  },

  deletePersona: async (id) => {
    await personaRepo.remove(id)
    set({ personas: get().personas.filter((p) => p.id !== id) })
  },

  setDefaultPersona: async (id) => {
    await Promise.all(
      get().personas.map((p) => personaRepo.update(p.id, { isDefault: p.id === id })),
    )
    set({ personas: get().personas.map((p) => ({ ...p, isDefault: p.id === id })) })
  },
}))
