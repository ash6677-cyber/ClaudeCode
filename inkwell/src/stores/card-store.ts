import { create } from 'zustand'

import { cardRepo } from '@/lib/db/repositories'
import type { CharacterCard, ExampleDialogueLine } from '@/types'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface CardInput {
  displayName: string
  codexEntryId: string | null
  tags: string[]
}

interface CardStoreState {
  projectId: string | null
  cards: CharacterCard[]
  status: LoadStatus
  error: string | null

  loadProject: (projectId: string) => Promise<void>
  createCard: (input: CardInput) => Promise<CharacterCard>
  updateCard: (id: string, changes: Partial<CharacterCard>) => Promise<void>
  deleteCard: (id: string) => Promise<void>

  addDialogueLine: (cardId: string, input: string, response: string) => Promise<void>
  updateDialogueLine: (cardId: string, lineId: string, input: string, response: string) => Promise<void>
  removeDialogueLine: (cardId: string, lineId: string) => Promise<void>
}

export const useCardStore = create<CardStoreState>((set, get) => ({
  projectId: null,
  cards: [],
  status: 'idle',
  error: null,

  loadProject: async (projectId) => {
    set({ status: 'loading', error: null, projectId })
    try {
      const all = await cardRepo.list()
      const cards = all
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
      set({ cards, status: 'ready' })
    } catch {
      set({ status: 'error', error: 'Could not load character cards from local storage.' })
    }
  },

  createCard: async (input) => {
    const { projectId, cards } = get()
    if (!projectId) throw new Error('No active project')
    const card = await cardRepo.create({
      projectId,
      codexEntryId: input.codexEntryId,
      displayName: input.displayName,
      avatarImageId: null,
      cropSettings: null,
      description: '',
      personality: '',
      scenario: '',
      firstMessage: '',
      exampleDialogue: [],
      systemPromptOverride: null,
      voiceNotes: '',
      tags: input.tags,
    })
    set({ cards: [...cards, card].sort((a, b) => a.displayName.localeCompare(b.displayName)) })
    return card
  },

  updateCard: async (id, changes) => {
    await cardRepo.update(id, changes)
    set({
      cards: get()
        .cards.map((c) => (c.id === id ? { ...c, ...changes } : c))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    })
  },

  deleteCard: async (id) => {
    await cardRepo.remove(id)
    set({ cards: get().cards.filter((c) => c.id !== id) })
  },

  addDialogueLine: async (cardId, input, response) => {
    const card = get().cards.find((c) => c.id === cardId)
    if (!card) return
    const line: ExampleDialogueLine = { id: crypto.randomUUID(), input, response }
    await get().updateCard(cardId, { exampleDialogue: [...card.exampleDialogue, line] })
  },

  updateDialogueLine: async (cardId, lineId, input, response) => {
    const card = get().cards.find((c) => c.id === cardId)
    if (!card) return
    await get().updateCard(cardId, {
      exampleDialogue: card.exampleDialogue.map((l) =>
        l.id === lineId ? { ...l, input, response } : l,
      ),
    })
  },

  removeDialogueLine: async (cardId, lineId) => {
    const card = get().cards.find((c) => c.id === cardId)
    if (!card) return
    await get().updateCard(cardId, {
      exampleDialogue: card.exampleDialogue.filter((l) => l.id !== lineId),
    })
  },
}))
