/**
 * Which key actually gets used.
 *
 * The presets that ship with the app are created before any key exists, so
 * every one of them has `providerId: null`. Nothing filled that in later,
 * which meant a writer could paste a working key, save it, watch it pass its
 * connection test — and still get no replies, because the preset the chat
 * used was pointing at nothing. There was no message explaining this and no
 * obvious place to fix it.
 *
 * So resolution falls back rather than failing: a preset that names a
 * provider gets it, and one that names none gets the first key that works.
 * Pure, and used by every route that needs a model, so the editor, the
 * wizard, and the chat can never disagree about which key is in play.
 */

import type { AiPreset, AiProviderConfig } from '@/types'

export interface ResolvedProvider {
  provider: AiProviderConfig
  model: string
  /** True when the preset had no provider of its own and this is a fallback. */
  borrowed: boolean
}

function usable(provider: AiProviderConfig): boolean {
  return provider.enabled !== false && Boolean(provider.apiKey?.trim())
}

export function resolveProvider(
  preset: AiPreset | undefined,
  providers: AiProviderConfig[],
): ResolvedProvider | null {
  const available = providers.filter(usable)
  if (available.length === 0) return null

  const named = preset?.providerId ? available.find((p) => p.id === preset.providerId) : undefined
  const provider = named ?? available[0]
  const model = preset?.model?.trim() || provider.defaultModel?.trim() || ''
  return { provider, model, borrowed: !named }
}

/** Whether replies are possible at all right now. */
export function canGenerate(
  preset: AiPreset | undefined,
  providers: AiProviderConfig[],
): boolean {
  const resolved = resolveProvider(preset, providers)
  return Boolean(resolved && resolved.model)
}

/**
 * Presets that should be pointed at a newly added key.
 *
 * Only the ones that were never given a provider — a writer who deliberately
 * attached preset "Punchy dialogue" to their local model has said something,
 * and adding a second key must not silently move it.
 */
export function presetsAwaitingProvider(presets: AiPreset[]): AiPreset[] {
  return presets.filter((preset) => !preset.providerId)
}
