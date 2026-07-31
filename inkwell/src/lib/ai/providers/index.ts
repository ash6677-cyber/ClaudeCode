import type { AiProviderKind } from '@/types'

import type { ProviderAdapter } from '../types'
import { anthropicAdapter } from './anthropic'
import { openAiCompatibleAdapter } from './openai-compatible'

const ADAPTERS: Record<AiProviderKind, ProviderAdapter> = {
  openai: openAiCompatibleAdapter,
  openrouter: openAiCompatibleAdapter,
  'openai-compatible': openAiCompatibleAdapter,
  anthropic: anthropicAdapter,
}

export function getProviderAdapter(kind: AiProviderKind): ProviderAdapter {
  return ADAPTERS[kind]
}
