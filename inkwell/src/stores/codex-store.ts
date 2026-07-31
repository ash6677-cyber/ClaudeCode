import { create } from 'zustand'

import { codexRepo } from '@/lib/db/repositories'
import type {
  AiContextInclusion,
  CodexAttribute,
  CodexEntry,
  CodexEntryType,
  CodexRelationship,
} from '@/types'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface CodexEntryInput {
  type: CodexEntryType
  name: string
  aliases: string[]
  summary: string
  tags: string[]
}

interface CodexStoreState {
  projectId: string | null
  entries: CodexEntry[]
  status: LoadStatus
  error: string | null

  loadProject: (projectId: string) => Promise<void>
  createEntry: (input: CodexEntryInput) => Promise<CodexEntry>
  updateEntry: (id: string, changes: Partial<CodexEntry>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>

  addAttribute: (entryId: string, key: string, value: string) => Promise<void>
  updateAttribute: (
    entryId: string,
    attributeId: string,
    key: string,
    value: string,
  ) => Promise<void>
  removeAttribute: (entryId: string, attributeId: string) => Promise<void>

  addRelationship: (entryId: string, targetEntryId: string, label: string) => Promise<void>
  removeRelationship: (entryId: string, relationshipId: string) => Promise<void>

  setAiContext: (
    entryId: string,
    aiContext: AiContextInclusion,
    tokenBudget: number | null,
  ) => Promise<void>
}

export const useCodexStore = create<CodexStoreState>((set, get) => ({
  projectId: null,
  entries: [],
  status: 'idle',
  error: null,

  loadProject: async (projectId) => {
    set({ status: 'loading', error: null, projectId })
    try {
      const all = await codexRepo.list()
      const entries = all
        .filter((e) => e.projectId === projectId)
        .sort((a, b) => a.name.localeCompare(b.name))
      set({ entries, status: 'ready' })
    } catch {
      set({ status: 'error', error: 'Could not load the Codex from local storage.' })
    }
  },

  createEntry: async (input) => {
    const { projectId, entries } = get()
    if (!projectId) throw new Error('No active project')
    const entry = await codexRepo.create({
      projectId,
      seriesId: null,
      type: input.type,
      name: input.name,
      aliases: input.aliases,
      summary: input.summary,
      body: '',
      plainText: '',
      attributes: [],
      relationships: [],
      imageId: null,
      tags: input.tags,
      aiContext: 'when-relevant',
      aiContextTokenBudget: null,
    })
    set({ entries: [...entries, entry].sort((a, b) => a.name.localeCompare(b.name)) })
    return entry
  },

  updateEntry: async (id, changes) => {
    await codexRepo.update(id, changes)
    set({
      entries: get()
        .entries.map((e) => (e.id === id ? { ...e, ...changes } : e))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })
  },

  deleteEntry: async (id) => {
    await codexRepo.remove(id)
    set({ entries: get().entries.filter((e) => e.id !== id) })
  },

  addAttribute: async (entryId, key, value) => {
    const entry = get().entries.find((e) => e.id === entryId)
    if (!entry) return
    const attribute: CodexAttribute = { id: crypto.randomUUID(), key, value }
    await get().updateEntry(entryId, { attributes: [...entry.attributes, attribute] })
  },

  updateAttribute: async (entryId, attributeId, key, value) => {
    const entry = get().entries.find((e) => e.id === entryId)
    if (!entry) return
    await get().updateEntry(entryId, {
      attributes: entry.attributes.map((a) => (a.id === attributeId ? { ...a, key, value } : a)),
    })
  },

  removeAttribute: async (entryId, attributeId) => {
    const entry = get().entries.find((e) => e.id === entryId)
    if (!entry) return
    await get().updateEntry(entryId, {
      attributes: entry.attributes.filter((a) => a.id !== attributeId),
    })
  },

  addRelationship: async (entryId, targetEntryId, label) => {
    const entry = get().entries.find((e) => e.id === entryId)
    if (!entry) return
    const relationship: CodexRelationship = { id: crypto.randomUUID(), targetEntryId, label }
    await get().updateEntry(entryId, { relationships: [...entry.relationships, relationship] })
  },

  removeRelationship: async (entryId, relationshipId) => {
    const entry = get().entries.find((e) => e.id === entryId)
    if (!entry) return
    await get().updateEntry(entryId, {
      relationships: entry.relationships.filter((r) => r.id !== relationshipId),
    })
  },

  setAiContext: async (entryId, aiContext, tokenBudget) => {
    await get().updateEntry(entryId, { aiContext, aiContextTokenBudget: tokenBudget })
  },
}))
