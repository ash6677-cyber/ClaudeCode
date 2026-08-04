import type { AiProviderConfig } from '@/types'

import type { AiFailure } from './failure'

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

/**
 * A key test either worked or failed for a reason worth acting on. The reason
 * is the classified failure itself rather than a string, so a rate limit's
 * Retry-After survives the trip to the UI instead of being flattened into
 * prose and guessed at again.
 */
export type KeyValidationResult = { ok: true } | { ok: false; failure: AiFailure }

export interface ProviderAdapter {
  streamCompletion(params: StreamCompletionParams): Promise<void>
  validateKey(provider: AiProviderConfig, model?: string): Promise<KeyValidationResult>
}
