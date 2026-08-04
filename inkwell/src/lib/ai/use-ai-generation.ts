import { useRef, useState } from 'react'

import {
  backoffMs,
  classifyThrown,
  shouldAutoRetry,
  type AiFailure,
} from '@/lib/ai/failure'
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

/** What the last generation cost, for the status line under it. */
export interface GenerationUsage {
  /** Estimated from the text — providers disagree about what they report. */
  characters: number
  ms: number
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useAiGeneration() {
  const [output, setOutput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [failure, setFailure] = useState<AiFailure | null>(null)
  const [usage, setUsage] = useState<GenerationUsage | null>(null)
  /** Which automatic attempt is in flight, so the UI can say "retrying". */
  const [attempt, setAttempt] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  async function generate(params: GenerateParams): Promise<string> {
    setOutput('')
    setFailure(null)
    setUsage(null)
    setStreaming(true)
    const startedAt = Date.now()
    let accumulated = ''
    const adapter = getProviderAdapter(params.provider.kind)

    try {
      for (let tryNumber = 1; ; tryNumber++) {
        setAttempt(tryNumber)
        const controller = new AbortController()
        abortRef.current = controller
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
          setUsage({ characters: accumulated.length, ms: Date.now() - startedAt })
          return accumulated
        } catch (err) {
          // Stopping is not failing. Whatever arrived before the stop is the
          // writer's, and is returned rather than discarded.
          if (controller.signal.aborted) return accumulated
          const classified = classifyThrown(err)
          // A dropped connection is usually over before anyone finishes
          // reading about it, so it is retried without being announced as a
          // failure. Nothing else is: a wrong key retried is still wrong, and
          // a rate limit retried immediately makes it worse.
          if (shouldAutoRetry(classified, tryNumber) && accumulated === '') {
            await wait(backoffMs(tryNumber))
            continue
          }
          setFailure(classified)
          return accumulated
        }
      }
    } finally {
      setStreaming(false)
      setAttempt(0)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  function reset() {
    setOutput('')
    setFailure(null)
    setUsage(null)
  }

  return {
    output,
    streaming,
    failure,
    /** The message alone, for callers that only ever showed a string. */
    error: failure?.message ?? null,
    usage,
    attempt,
    generate,
    stop,
    reset,
  }
}
