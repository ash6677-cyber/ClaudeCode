/** Yields each `data:` payload from a server-sent-events stream, stopping cleanly on abort. */
export async function* parseSSE(response: Response, signal: AbortSignal): AsyncGenerator<string> {
  if (!response.body) throw new Error('This provider returned no response body to stream.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const onAbort = () => reader.cancel().catch(() => {})
  signal.addEventListener('abort', onAbort)

  try {
    while (true) {
      if (signal.aborted) return
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data) yield data
      }
    }
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}
