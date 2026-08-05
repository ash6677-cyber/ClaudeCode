import { create } from 'zustand'

import { aiPresetRepo, aiProviderRepo } from '@/lib/db/repositories'
import { getProviderAdapter } from '@/lib/ai/providers'
import { presetsAwaitingProvider } from '@/lib/ai/resolve-provider'
import type { AiPreset, AiProviderConfig, AiProviderKind } from '@/types'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ProviderInput {
  kind: AiProviderKind
  label: string
  apiKey: string
  baseUrl: string | null
  defaultModel: string | null
}

export interface PresetInput {
  name: string
  providerId: string | null
  model: string
  temperature: number
  topP: number
  systemPrompt: string
  proseInstructions: string
  contextRules: AiPreset['contextRules']
}

const DEFAULT_PRESETS: PresetInput[] = [
  {
    name: 'Faithful prose',
    providerId: null,
    model: '',
    temperature: 0.7,
    topP: 1,
    systemPrompt: '',
    proseInstructions: 'Stay close to the established voice. Prefer clarity over flourish.',
    contextRules: { precedingParagraphs: 6, includeCodex: true, codexTokenBudget: 1200, includeLorebook: false, lorebookTokenBudget: 0 },
  },
  {
    name: 'Punchy dialogue',
    providerId: null,
    model: '',
    temperature: 0.9,
    topP: 1,
    systemPrompt: '',
    proseInstructions: 'Favor sharp, characterful dialogue and short paragraphs. Cut exposition to a minimum.',
    contextRules: { precedingParagraphs: 6, includeCodex: true, codexTokenBudget: 1200, includeLorebook: false, lorebookTokenBudget: 0 },
  },
  {
    name: 'Descriptive',
    providerId: null,
    model: '',
    temperature: 0.8,
    topP: 1,
    systemPrompt: '',
    proseInstructions: 'Lean into sensory, atmospheric detail. Take time to let a scene breathe.',
    contextRules: { precedingParagraphs: 6, includeCodex: true, codexTokenBudget: 1200, includeLorebook: false, lorebookTokenBudget: 0 },
  },
]

interface AiStoreState {
  providers: AiProviderConfig[]
  presets: AiPreset[]
  status: LoadStatus

  loadAll: () => Promise<void>
  ensureDefaultPresets: () => Promise<void>

  createProvider: (input: ProviderInput) => Promise<AiProviderConfig>
  updateProvider: (id: string, input: ProviderInput) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  validateProvider: (id: string) => Promise<{ ok: boolean; error?: string }>

  createPreset: (input: PresetInput) => Promise<AiPreset>
  updatePreset: (id: string, input: PresetInput) => Promise<void>
  deletePreset: (id: string) => Promise<void>
}

export const useAiStore = create<AiStoreState>((set, get) => ({
  providers: [],
  presets: [],
  status: 'idle',

  loadAll: async () => {
    // Guards against concurrent calls (e.g. two components mounting around the same
    // time, or React StrictMode's double effect-invocation) racing to seed default
    // presets twice. `get()` reads the live store, unlike a component's render-time
    // closure, so the second call sees the flag the first call already set.
    if (get().status === 'loading' || get().status === 'ready') return
    set({ status: 'loading' })
    try {
      const [providers, presets] = await Promise.all([aiProviderRepo.list(), aiPresetRepo.list()])
      set({ providers, presets: presets.sort((a, b) => a.name.localeCompare(b.name)), status: 'ready' })
      await get().ensureDefaultPresets()
    } catch {
      set({ status: 'error' })
    }
  },

  ensureDefaultPresets: async () => {
    if (get().presets.length > 0) return
    const created: AiPreset[] = []
    for (const [i, preset] of DEFAULT_PRESETS.entries()) {
      const entity = await aiPresetRepo.create({ ...preset, isDefault: i === 0 })
      created.push(entity)
    }
    set({ presets: created.sort((a, b) => a.name.localeCompare(b.name)) })
  },

  createProvider: async (input) => {
    const provider = await aiProviderRepo.create({ ...input, enabled: true })
    set({ providers: [...get().providers, provider] })

    // Every preset the app ships with is created before any key exists, so
    // they all start pointing at nothing. Without this, a writer could paste
    // a working key, watch it pass its own connection test, and still get no
    // replies anywhere — with nothing on screen to say why. Only presets that
    // were never given a provider are claimed; one the writer deliberately
    // attached to a local model stays where they put it.
    const orphans = presetsAwaitingProvider(get().presets)
    if (orphans.length > 0) {
      const model = provider.defaultModel?.trim() || ''
      for (const preset of orphans) {
        await aiPresetRepo.update(preset.id, {
          providerId: provider.id,
          model: preset.model?.trim() || model,
        })
      }
      set({
        presets: get().presets.map((preset) =>
          orphans.some((o) => o.id === preset.id)
            ? { ...preset, providerId: provider.id, model: preset.model?.trim() || model }
            : preset,
        ),
      })
    }

    return provider
  },

  updateProvider: async (id, input) => {
    await aiProviderRepo.update(id, input)
    set({ providers: get().providers.map((p) => (p.id === id ? { ...p, ...input } : p)) })
  },

  deleteProvider: async (id) => {
    await aiProviderRepo.remove(id)
    set({ providers: get().providers.filter((p) => p.id !== id) })
  },

  validateProvider: async (id) => {
    const provider = get().providers.find((p) => p.id === id)
    if (!provider) return { ok: false, error: 'Provider not found' }
    const adapter = getProviderAdapter(provider.kind)
    return adapter.validateKey(provider)
  },

  createPreset: async (input) => {
    const preset = await aiPresetRepo.create({ ...input, isDefault: false })
    set({ presets: [...get().presets, preset].sort((a, b) => a.name.localeCompare(b.name)) })
    return preset
  },

  updatePreset: async (id, input) => {
    await aiPresetRepo.update(id, input)
    set({
      presets: get()
        .presets.map((p) => (p.id === id ? { ...p, ...input } : p))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })
  },

  deletePreset: async (id) => {
    await aiPresetRepo.remove(id)
    set({ presets: get().presets.filter((p) => p.id !== id) })
  },
}))
