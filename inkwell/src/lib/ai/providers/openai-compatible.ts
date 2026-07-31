import type { AiProviderConfig } from '@/types'

import { describeHttpError } from '../http-error'
import { parseSSE } from '../sse'
import type { KeyValidationResult, ProviderAdapter, StreamCompletionParams } from '../types'

const DEFAULT_BASE_URLS: Partial<Record<AiProviderConfig['kind'], string>> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
}

function resolveBaseUrl(provider: AiProviderConfig): string {
  return (provider.baseUrl?.trim() || DEFAULT_BASE_URLS[provider.kind] || 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  )
}

/** Covers OpenAI, OpenRouter, and any self-hosted OpenAI-compatible endpoint (Ollama, LM Studio, ...). */
export const openAiCompatibleAdapter: ProviderAdapter = {
  async streamCompletion({ provider, model, messages, temperature, topP, signal, onToken }: StreamCompletionParams) {
    const response = await fetch(`${resolveBaseUrl(provider)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        top_p: topP,
        stream: true,
      }),
      signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(describeHttpError(response.status, text))
    }

    for await (const data of parseSSE(response, signal)) {
      if (data === '[DONE]') break
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) onToken(delta)
      } catch {
        // Ignore a malformed chunk rather than aborting the whole stream.
      }
    }
  },

  async validateKey(provider, model): Promise<KeyValidationResult> {
    try {
      const response = await fetch(`${resolveBaseUrl(provider)}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: model || provider.defaultModel || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      })
      if (response.ok) return { ok: true }
      const text = await response.text().catch(() => '')
      return { ok: false, error: describeHttpError(response.status, text) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
    }
  },
}
