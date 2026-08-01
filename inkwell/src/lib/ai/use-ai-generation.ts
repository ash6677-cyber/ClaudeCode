import { useRef, useState } from 'react'

import { getProviderAdapter } from '@/lib/ai/providers'
import type { AiChatMessage } from '@/lib/ai/types'
import type { AiProviderConfig } from '@/types'

interface GenerateParams {
  provider: AiProviderConfig
  model: string
  messages: AiChatMessage[]
  temperature: number
  topP: number
}

export function useAiGeneration() {
  const [output, setOutput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function generate(params: GenerateParams): Promise<string> {
    setOutput('')
    setError(null)
    setStreaming(true)
    let accumulated = ''
    const controller = new AbortController()
    abortRef.current = controller
    const adapter = getProviderAdapter(params.provider.kind)
    try {
      await adapter.streamCompletion({
        provider: params.provider,
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        topP: params.topP,
        signal: controller.signal,
        onToken: (delta) => {
          accumulated += delta
          setOutput(accumulated)
        },
      })
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
    return accumulated
  }

  function stop() {
    abortRef.current?.abort()
  }

  function reset() {
    setOutput('')
    setError(null)
  }

  return { output, streaming, error, generate, stop, reset }
}
