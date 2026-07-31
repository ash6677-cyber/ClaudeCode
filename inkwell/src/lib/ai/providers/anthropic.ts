import { describeHttpError } from '../http-error'
import { parseSSE } from '../sse'
import type { KeyValidationResult, ProviderAdapter, StreamCompletionParams } from '../types'

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'
const ANTHROPIC_VERSION = '2023-06-01'

function resolveBaseUrl(baseUrl: string | null): string {
  return (baseUrl?.trim() || ANTHROPIC_BASE_URL).replace(/\/$/, '')
}

function headers(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    // Required for calls made directly from the browser rather than through a backend.
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

export const anthropicAdapter: ProviderAdapter = {
  async streamCompletion({ provider, model, messages, temperature, topP, signal, onToken }: StreamCompletionParams) {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    const conversation = messages.filter((m) => m.role !== 'system')

    const response = await fetch(`${resolveBaseUrl(provider.baseUrl)}/messages`, {
      method: 'POST',
      headers: headers(provider.apiKey),
      body: JSON.stringify({
        model,
        system: system || undefined,
        messages: conversation,
        temperature,
        top_p: topP,
        max_tokens: 4096,
        stream: true,
      }),
      signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(describeHttpError(response.status, text))
    }

    for await (const data of parseSSE(response, signal)) {
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          onToken(parsed.delta.text)
        }
      } catch {
        // Ignore a malformed chunk rather than aborting the whole stream.
      }
    }
  },

  async validateKey(provider, model): Promise<KeyValidationResult> {
    try {
      const response = await fetch(`${resolveBaseUrl(provider.baseUrl)}/messages`, {
        method: 'POST',
        headers: headers(provider.apiKey),
        body: JSON.stringify({
          model: model || provider.defaultModel || 'claude-3-5-haiku-latest',
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
