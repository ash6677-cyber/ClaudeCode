import type { BaseEntity } from './base'

export type AiProviderKind = 'openai' | 'anthropic' | 'openrouter' | 'openai-compatible'

export interface AiProviderConfig extends BaseEntity {
  kind: AiProviderKind
  label: string
  apiKey: string
  baseUrl: string | null
  defaultModel: string | null
  enabled: boolean
}

export interface AiContextRules {
  precedingParagraphs: number
  includeCodex: boolean
  codexTokenBudget: number
  includeLorebook: boolean
  lorebookTokenBudget: number
}

export interface AiPreset extends BaseEntity {
  name: string
  providerId: string | null
  model: string
  temperature: number
  topP: number
  systemPrompt: string
  proseInstructions: string
  contextRules: AiContextRules
  isDefault: boolean
}

export type AiActionKind =
  'continue' | 'rewrite' | 'describe' | 'brainstorm' | 'summarise' | 'beats-to-prose'
