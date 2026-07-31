import type { AiProviderConfig } from '@/types'

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamCompletionParams {
  provider: AiProviderConfig
  model: string
  messages: AiChatMessage[]
  temperature: number
  topP: number
  signal: AbortSignal
  onToken: (delta: string) => void
}

export interface KeyValidationResult {
  ok: boolean
  error?: string
}

export interface ProviderAdapter {
  streamCompletion(params: StreamCompletionParams): Promise<void>
  validateKey(provider: AiProviderConfig, model?: string): Promise<KeyValidationResult>
}
